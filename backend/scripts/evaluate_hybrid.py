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

FEATURE_COLS = [
    "caption_length",
    "hashtag_count",
    "aesthetic_score",
    "scene_confidence",
    "sentiment_proxy",
    "brand_fit",
    "mood_match",
]
TARGET = "engagement_score"
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


def retrain_production_model(df_clip: pd.DataFrame, out_joblib: Path, out_json: Path) -> dict:
    clean = df_clip.dropna(subset=FEATURE_COLS + [TARGET])
    X = clean[FEATURE_COLS].values
    y = clean[TARGET].values
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE
    )

    model = GradientBoostingRegressor(
        n_estimators=120,
        max_depth=4,
        learning_rate=0.08,
        random_state=RANDOM_STATE,
    )
    model.fit(X_train, y_train)
    pred = np.clip(model.predict(X_test), 0, 100)
    metrics = {**_metrics(y_test, pred), "n_train": len(X_train), "n_test": len(X_test)}

    bundle = {
        "model": model,
        "feature_cols": FEATURE_COLS,
        "metrics": {**metrics, "clip_features": True, "training_domain": "kim_www20"},
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
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser(description="Hybrid Kim train + Kharwal domain-transfer evaluation")
    parser.add_argument("--kim-csv", default="data/instagram_kim.csv")
    parser.add_argument("--transfer-csv", default="data/instagram_data.csv")
    parser.add_argument("--clip", action="store_true")
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--out-dir", default="models")
    parser.add_argument("--retrain", action="store_true")
    parser.add_argument("--image-col", default="image_path")
    args = parser.parse_args()

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
        metrics = retrain_production_model(
            kim_features,
            out_dir / "engagement.joblib",
            out_dir / "engagement.json",
        )
        print(f"\nProduction model retrained on Kim (n={len(kim_features)}). Hold-out MAE={metrics['mae']:.3f}")


if __name__ == "__main__":
    main()
