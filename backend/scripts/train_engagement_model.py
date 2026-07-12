"""
Train engagement regressor and save model bundle for the API.

Workflow with YOUR dataset:
  1. Put CSV in backend/data/your_dataset.csv
  2. python scripts/prepare_engagement_dataset.py --csv data/your_dataset.csv --out data/training_features.csv
  3. python scripts/train_engagement_model.py --csv data/training_features.csv --out models/engagement.joblib
  4. Set ENGAGEMENT_MODEL_PATH=models/engagement.joblib in backend/.env
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True, help="Prepared features CSV (or raw if columns match)")
    parser.add_argument("--out", default="models/engagement.joblib")
    parser.add_argument("--skip-prepare", action="store_true", help="CSV already has feature columns")
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.is_file():
        raise SystemExit(f"File not found: {csv_path}")

    df = pd.read_csv(csv_path)

    # Auto-run prepare if raw Instagram columns detected
    if not args.skip_prepare and TARGET not in df.columns:
        from prepare_engagement_dataset import prepare

        print("Raw dataset detected — extracting features…")
        df = prepare(df)

    missing = [c for c in FEATURE_COLS + [TARGET] if c not in df.columns]
    if missing:
        raise SystemExit(
            f"Missing columns: {missing}\n"
            "Run: python scripts/prepare_engagement_dataset.py --csv YOUR_FILE.csv"
        )

    df = df.dropna(subset=FEATURE_COLS + [TARGET])
    print(f"Training on {len(df)} samples")

    X = df[FEATURE_COLS].values
    y = df[TARGET].values
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = GradientBoostingRegressor(
        n_estimators=120,
        max_depth=4,
        learning_rate=0.08,
        random_state=42,
    )
    model.fit(X_train, y_train)
    pred = model.predict(X_test)

    mae = mean_absolute_error(y_test, pred)
    rmse = mean_squared_error(y_test, pred) ** 0.5
    r2 = r2_score(y_test, pred)
    print(f"Test MAE:  {mae:.2f}")
    print(f"Test RMSE: {rmse:.2f}")
    print(f"Test R²:   {r2:.3f}")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    bundle = {
        "model": model,
        "feature_cols": FEATURE_COLS,
        "metrics": {"mae": mae, "rmse": rmse, "r2": r2, "n_train": len(X_train), "n_test": len(X_test)},
    }
    joblib.dump(bundle, out)

    metrics_path = out.with_suffix(".metrics.json")
    metrics_path.write_text(json.dumps(bundle["metrics"], indent=2))
    print(f"Model saved → {out}")
    print(f"Metrics saved → {metrics_path}")
    print("\nEnable in API: ENGAGEMENT_MODEL_PATH=" + str(out))


if __name__ == "__main__":
    main()
