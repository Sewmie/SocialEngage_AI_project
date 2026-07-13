"""
Hybrid evaluation: train on Kim WWW'20 sample, domain-transfer test on Kharwal 119.

Table A — Kim held-out 80/20 (primary training domain, image CLIP when available)
Table B — Kharwal n=119 full-set transfer (educational/data-science niche, never seen in training)

Both use score_mode=kim (likes + comments target) for aligned cross-dataset comparison.

Usage:
  cd backend
  python scripts/convert_kim_dataset.py --kim-root data/kim_raw --out data/instagram_kim.csv
  python scripts/evaluate_hybrid.py --clip --retrain
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(BACKEND_ROOT))
sys.path.insert(0, str(SCRIPT_DIR))

from prepare_engagement_dataset import prepare  # noqa: E402
from feature_columns import FEATURE_COLS, TARGET, TARGET_LIKES  # noqa: E402
from clean_kim_dataset import followers_p99, normalize_followers  # noqa: E402

RANDOM_STATE = 42


def _metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(mean_squared_error(y_true, y_pred) ** 0.5)
    r2 = float(r2_score(y_true, y_pred))
    return {"mae": round(mae, 3), "rmse": round(rmse, 3), "r2": round(r2, 3)}


def _train_eval_frame(
    frame: pd.DataFrame,
    regressor: str,
    test_size: float,
    fit_on_all: bool = False,
) -> dict:
    clean = frame.dropna(subset=FEATURE_COLS + [TARGET])
    X = clean[FEATURE_COLS].values
    y = clean[TARGET].values

    if fit_on_all:
        X_train, y_train = X, y
        X_test, y_test = X, y
    else:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=RANDOM_STATE
        )

    if regressor == "gradient_boosting":
        model = GradientBoostingRegressor(
            n_estimators=120,
            max_depth=4,
            learning_rate=0.08,
            random_state=RANDOM_STATE,
        )
    elif regressor == "ridge":
        model = Ridge(alpha=1.0, random_state=RANDOM_STATE)
    else:
        raise ValueError(regressor)

    model.fit(X_train, y_train)
    pred = np.clip(model.predict(X_test), 0, 100)
    return {**_metrics(y_test, pred), "model": model, "n_train": len(X_train), "n_test": len(X_test)}


def _comparison_rows(
    frame: pd.DataFrame,
    label: str,
    test_size: float,
    use_clip: bool,
    fit_on_all: bool = False,
) -> list[dict]:
    rows = []
    for reg in ("gradient_boosting", "ridge"):
        result = _train_eval_frame(frame, reg, test_size=test_size, fit_on_all=fit_on_all)
        rows.append(
            {
                "evaluation_set": label,
                "feature_set": "clip_enriched" if use_clip else "baseline_placeholders",
                "regressor": reg,
                "mae": result["mae"],
                "rmse": result["rmse"],
                "r2": result["r2"],
                "n_train": result["n_train"],
                "n_test": result["n_test"],
            }
        )

    clean = frame.dropna(subset=FEATURE_COLS + [TARGET])
    y = clean[TARGET].values
    if fit_on_all:
        y_train, y_test = y, y
    else:
        y_train, y_test = train_test_split(y, test_size=test_size, random_state=RANDOM_STATE)
    mean_m = _metrics(y_test, np.full_like(y_test, y_train.mean()))
    rows.append(
        {
            "evaluation_set": label,
            "feature_set": "mean_baseline",
            "regressor": "constant_mean",
            **mean_m,
            "n_train": int(len(y_train)),
            "n_test": int(len(y_test)),
        }
    )
    return rows


def _transfer_eval(
    model: GradientBoostingRegressor,
    transfer_frame: pd.DataFrame,
) -> dict:
    clean = transfer_frame.dropna(subset=FEATURE_COLS + [TARGET])
    X = clean[FEATURE_COLS].values
    y = clean[TARGET].values
    pred = np.clip(model.predict(X), 0, 100)
    mean_pred = np.full_like(y, float(y.mean()))
    return {
        "clip_gbr": _metrics(y, pred),
        "mean_baseline": _metrics(y, mean_pred),
        "n_posts": int(len(y)),
    }


def _likes_calibration(df: pd.DataFrame) -> dict:
    if TARGET_LIKES not in df.columns:
        return {}
    likes = pd.to_numeric(df[TARGET_LIKES], errors="coerce").fillna(0).clip(lower=0)
    comments = (
        pd.to_numeric(df["comments"], errors="coerce").fillna(0).clip(lower=0)
        if "comments" in df.columns
        else pd.Series([0.0] * len(df))
    )
    ratio = (comments / likes.replace(0, np.nan)).replace([np.inf, -np.inf], np.nan).median()
    return {
        "likes_p33": float(likes.quantile(0.33)),
        "likes_p66": float(likes.quantile(0.66)),
        "likes_p99": float(likes.quantile(0.99)) or 1.0,
        "comments_p99": float(comments.quantile(0.99)) or 1.0,
        "comments_per_like_median": float(ratio) if pd.notna(ratio) else 0.0,
    }


def retrain_production_model(
    df_clip: pd.DataFrame,
    out_joblib: Path,
    out_json: Path,
    *,
    followers_p99: float | None = None,
    default_followers: float | None = None,
) -> dict:
    clean = df_clip.dropna(subset=FEATURE_COLS + [TARGET])
    X = clean[FEATURE_COLS].values
    y = clean[TARGET].values
    likes_raw = (
        pd.to_numeric(clean[TARGET_LIKES], errors="coerce").fillna(0).clip(lower=0).values
        if TARGET_LIKES in clean.columns
        else None
    )

    if likes_raw is not None:
        X_train, X_test, y_train, y_test, likes_train, likes_test = train_test_split(
            X, y, likes_raw, test_size=0.2, random_state=RANDOM_STATE
        )
        y_log_train = np.log1p(likes_train)
        y_log_test = np.log1p(likes_test)
    else:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=RANDOM_STATE
        )
        likes_test = None
        y_log_train = None

    model = GradientBoostingRegressor(
        n_estimators=120,
        max_depth=4,
        learning_rate=0.08,
        random_state=RANDOM_STATE,
    )
    model.fit(X_train, y_train)
    pred = np.clip(model.predict(X_test), 0, 100)
    metrics = {**_metrics(y_test, pred), "n_train": len(X_train), "n_test": len(X_test)}
    importances = {
        col: round(float(val), 4)
        for col, val in zip(FEATURE_COLS, model.feature_importances_, strict=False)
    }

    likes_model = None
    likes_metrics: dict = {}
    likes_calibration = _likes_calibration(clean)
    if likes_raw is not None and y_log_train is not None and likes_test is not None:
        likes_model = GradientBoostingRegressor(
            n_estimators=120,
            max_depth=4,
            learning_rate=0.08,
            random_state=RANDOM_STATE,
        )
        likes_model.fit(X_train, y_log_train)
        likes_pred = np.expm1(np.clip(likes_model.predict(X_test), 0, None))
        likes_metrics = _metrics(likes_test, likes_pred)
        likes_metrics = {
            "likes_mae": likes_metrics["mae"],
            "likes_rmse": likes_metrics["rmse"],
            "likes_r2": likes_metrics["r2"],
        }

    bundle = {
        "model": model,
        "likes_model": likes_model,
        "feature_cols": FEATURE_COLS,
        "metrics": {
            **metrics,
            **likes_metrics,
            "clip_features": True,
            "training_domain": "kim_www20",
            "feature_importances_gbr": importances,
        },
        "feature_stats": {
            "followers_p99": followers_p99,
            "default_followers": default_followers,
            **likes_calibration,
        },
    }
    out_joblib.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, out_joblib)

    ridge = Ridge(alpha=1.0)
    ridge.fit(X_train, y_train)
    linear_bundle = {
        "type": "linear",
        "feature_cols": FEATURE_COLS,
        "weights": [round(float(w), 6) for w in ridge.coef_],
        "bias": round(float(ridge.intercept_), 6),
        "metrics": {**metrics, "clip_features": True, "training_domain": "kim_www20"},
    }
    out_json.write_text(json.dumps(linear_bundle, indent=2))
    out_joblib.with_suffix(".metrics.json").write_text(json.dumps(bundle["metrics"], indent=2))
    return {**metrics, **likes_metrics}


def main() -> None:
    parser = argparse.ArgumentParser(description="Hybrid Kim train + Kharwal domain-transfer evaluation")
    parser.add_argument("--kim-csv", default="data/instagram_kim.csv")
    parser.add_argument("--transfer-csv", default="data/instagram_data.csv")
    parser.add_argument("--clip", action="store_true")
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--out-dir", default="models")
    parser.add_argument("--retrain", action="store_true")
    parser.add_argument(
        "--retrain-only",
        action="store_true",
        help="Retrain from data/training_features_kim.csv (add followers via --refresh-followers)",
    )
    parser.add_argument(
        "--refresh-followers",
        action="store_true",
        help="Merge log_followers_norm into existing training_features_kim.csv from kim CSV",
    )
    parser.add_argument("--image-col", default="image_path")
    args = parser.parse_args()

    features_path = BACKEND_ROOT / "data" / "training_features_kim.csv"

    if args.refresh_followers:
        kim_path = Path(args.kim_csv)
        if not kim_path.is_file():
            raise SystemExit(f"Kim CSV not found: {kim_path}")
        if not features_path.is_file():
            raise SystemExit(f"Features file not found: {features_path}")

        kim_df = pd.read_csv(kim_path, encoding="latin-1")
        features_df = pd.read_csv(features_path)
        if len(kim_df) != len(features_df):
            raise SystemExit(
                f"Row mismatch: kim={len(kim_df)} features={len(features_df)}. "
                "Re-run full evaluate_hybrid --clip first."
            )
        p99 = followers_p99(kim_df)
        default = float(pd.to_numeric(kim_df.get("followers", 0), errors="coerce").fillna(0).replace(0, pd.NA).dropna().median() or 0)
        features_df["log_followers_norm"] = [
            normalize_followers(float(f), p99, default=default)
            for f in pd.to_numeric(kim_df.get("followers", 0), errors="coerce").fillna(0)
        ]
        if "Likes" in kim_df.columns and len(kim_df) == len(features_df):
            features_df[TARGET_LIKES] = pd.to_numeric(kim_df["Likes"], errors="coerce").fillna(0).clip(lower=0)
        if "Comments" in kim_df.columns and len(kim_df) == len(features_df):
            features_df["comments"] = pd.to_numeric(kim_df["Comments"], errors="coerce").fillna(0).clip(lower=0)
        features_df.to_csv(features_path, index=False)
        print(f"Added log_followers_norm → {features_path} (p99={p99:,.0f}, default={default:,.0f})")
        if not args.retrain_only:
            return

    if args.retrain_only:
        if not features_path.is_file():
            raise SystemExit(f"Missing {features_path}")
        features_df = pd.read_csv(features_path)
        if "log_followers_norm" not in features_df.columns:
            raise SystemExit("Run with --refresh-followers first to add log_followers_norm")
        if TARGET_LIKES not in features_df.columns:
            kim_path = Path(args.kim_csv)
            if kim_path.is_file():
                kim_df = pd.read_csv(kim_path, encoding="latin-1")
                if "Likes" in kim_df.columns and len(kim_df) == len(features_df):
                    features_df[TARGET_LIKES] = pd.to_numeric(kim_df["Likes"], errors="coerce").fillna(0).clip(lower=0)
                if "Comments" in kim_df.columns and len(kim_df) == len(features_df):
                    features_df["comments"] = pd.to_numeric(kim_df["Comments"], errors="coerce").fillna(0).clip(lower=0)
        kim_df = pd.read_csv(Path(args.kim_csv), encoding="latin-1") if Path(args.kim_csv).is_file() else pd.DataFrame()
        p99 = followers_p99(kim_df) if not kim_df.empty and "followers" in kim_df.columns else None
        default = (
            float(pd.to_numeric(kim_df["followers"], errors="coerce").replace(0, pd.NA).dropna().median())
            if not kim_df.empty and "followers" in kim_df.columns
            else None
        )
        metrics = retrain_production_model(
            features_df,
            Path(args.out_dir) / "engagement.joblib",
            Path(args.out_dir) / "engagement.json",
            followers_p99=p99,
            default_followers=default,
        )
        print(f"\nProduction model retrained (followers + likes). Hold-out MAE={metrics['mae']:.3f}")
        if metrics.get("likes_mae") is not None:
            print(f"Likes prediction MAE={metrics['likes_mae']:.1f}  R²={metrics.get('likes_r2', 0):.3f}")
        return

    kim_path = Path(args.kim_csv)
    transfer_path = Path(args.transfer_csv)
    if not kim_path.is_file():
        raise SystemExit(
            f"Kim CSV not found: {kim_path}\n"
            "Run: python scripts/convert_kim_dataset.py --kim-root data/kim_raw"
        )
    if not transfer_path.is_file():
        raise SystemExit(f"Transfer CSV not found: {transfer_path}")

    kim_raw = pd.read_csv(kim_path, encoding="latin-1")
    transfer_raw = pd.read_csv(transfer_path, encoding="latin-1")
    print(f"Kim training posts: {len(kim_raw)}")
    print(f"Transfer posts:     {len(transfer_raw)}")

    kim_features = prepare(
        kim_raw,
        use_clip=args.clip,
        image_col=args.image_col,
        score_mode="kim",
    )
    transfer_features = prepare(
        transfer_raw,
        use_clip=args.clip,
        image_col=None,
        score_mode="kim",
    )

    comparisons = []
    comparisons.extend(
        _comparison_rows(kim_features, "kim_held_out", args.test_size, args.clip)
    )

    best_kim = _train_eval_frame(kim_features, "gradient_boosting", args.test_size)
    gbr_model: GradientBoostingRegressor = best_kim["model"]
    transfer_result = _transfer_eval(gbr_model, transfer_features)

    transfer_rows = [
        {
            "evaluation_set": "kharwal_domain_transfer",
            "feature_set": "clip_enriched" if args.clip else "baseline_placeholders",
            "regressor": "gradient_boosting",
            **transfer_result["clip_gbr"],
            "n_train": best_kim["n_train"],
            "n_test": transfer_result["n_posts"],
        },
        {
            "evaluation_set": "kharwal_domain_transfer",
            "feature_set": "mean_baseline",
            "regressor": "constant_mean",
            **transfer_result["mean_baseline"],
            "n_train": best_kim["n_train"],
            "n_test": transfer_result["n_posts"],
        },
    ]
    comparisons.extend(transfer_rows)

    importances = dict(
        zip(
            FEATURE_COLS,
            [round(float(v), 4) for v in gbr_model.feature_importances_],
        )
    )

    kim_gbr = next(
        r
        for r in comparisons
        if r["evaluation_set"] == "kim_held_out"
        and r["feature_set"] == ("clip_enriched" if args.clip else "baseline_placeholders")
        and r["regressor"] == "gradient_boosting"
    )
    transfer_gbr = transfer_rows[0]

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "training_dataset": str(kim_path),
        "transfer_dataset": str(transfer_path),
        "n_kim_posts": len(kim_raw),
        "n_transfer_posts": len(transfer_raw),
        "score_mode": "kim",
        "clip_features": args.clip,
        "image_col": args.image_col,
        "test_size": args.test_size,
        "random_state": RANDOM_STATE,
        "citation": "Kim et al. (WWW'20) Instagram Influencer Dataset",
        "comparisons": comparisons,
        "kim_best_gbr": kim_gbr,
        "kharwal_transfer_gbr": transfer_gbr,
        "transfer_vs_kim_delta": {
            "mae_change": round(transfer_gbr["mae"] - kim_gbr["mae"], 3),
            "r2_change": round(transfer_gbr["r2"] - kim_gbr["r2"], 3),
        },
        "feature_importances_gbr": importances,
    }

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    report_path = out_dir / "hybrid_evaluation_report.json"
    report_path.write_text(json.dumps(report, indent=2))

    kim_table = pd.DataFrame([r for r in comparisons if r["evaluation_set"] == "kim_held_out"])
    transfer_table = pd.DataFrame(transfer_rows)
    kim_table.to_csv(out_dir / "kim_evaluation_table.csv", index=False)
    transfer_table.to_csv(out_dir / "kharwal_transfer_table.csv", index=False)
    pd.DataFrame(comparisons).to_csv(out_dir / "hybrid_evaluation_table.csv", index=False)

    kim_features.to_csv(BACKEND_ROOT / "data" / "training_features_kim.csv", index=False)

    print("\n=== Table A: Kim held-out (80/20) ===")
    for row in kim_table.to_dict("records"):
        print(
            f"  {row['feature_set']:22} {row['regressor']:20} "
            f"MAE={row['mae']:.3f}  R²={row['r2']:.3f}"
        )

    print("\n=== Table B: Kharwal domain transfer (n=119, Kim-trained GBR) ===")
    print(
        f"  clip_enriched          gradient_boosting   "
        f"MAE={transfer_gbr['mae']:.3f}  R²={transfer_gbr['r2']:.3f}"
    )
    print(
        f"  mean_baseline          constant_mean       "
        f"MAE={transfer_rows[1]['mae']:.3f}  R²={transfer_rows[1]['r2']:.3f}"
    )

    print(f"\nReports:\n  {report_path}\n  {out_dir / 'kim_evaluation_table.csv'}\n  {out_dir / 'kharwal_transfer_table.csv'}")

    if args.retrain and args.clip:
        p99 = followers_p99(kim_raw) if "followers" in kim_raw.columns else None
        default = (
            float(pd.to_numeric(kim_raw["followers"], errors="coerce").replace(0, pd.NA).dropna().median())
            if "followers" in kim_raw.columns
            else None
        )
        metrics = retrain_production_model(
            kim_features,
            out_dir / "engagement.joblib",
            out_dir / "engagement.json",
            followers_p99=p99,
            default_followers=default,
        )
        print(f"\nProduction model retrained on Kim (n={len(kim_features)}). Hold-out MAE={metrics['mae']:.3f}")


if __name__ == "__main__":
    main()
