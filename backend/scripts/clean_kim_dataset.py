"""
Clean instagram_kim.csv before engagement model training.

Usage:
  cd backend
  python scripts/clean_kim_dataset.py
  python scripts/clean_kim_dataset.py --in data/instagram_kim.csv --out data/instagram_kim_clean.csv
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

VALID_CATEGORIES = {
    "beauty",
    "family",
    "fashion",
    "fitness",
    "food",
    "interior",
    "pet",
    "travel",
    "other",
}


def clean_kim(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    report: dict[str, int] = {"input_rows": len(df)}

    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]

    if "post_id" in df.columns:
        df["post_id"] = df["post_id"].astype(str).str.strip()
        df = df.drop_duplicates(subset=["post_id"], keep="first")
    report["after_dedupe"] = len(df)

    for col in ("Caption", "Hashtags", "username", "category", "image_path"):
        if col in df.columns:
            df[col] = df[col].fillna("").astype(str).str.strip()

    df = df[df["Caption"].str.len() > 0]
    report["after_nonempty_caption"] = len(df)

    df["Likes"] = pd.to_numeric(df["Likes"], errors="coerce").fillna(0).clip(lower=0)
    df["Comments"] = pd.to_numeric(df["Comments"], errors="coerce").fillna(0).clip(lower=0)
    df["sponsored"] = pd.to_numeric(df.get("sponsored", 0), errors="coerce").fillna(0).astype(int)
    df["timestamp"] = pd.to_numeric(df.get("timestamp", 0), errors="coerce").fillna(0).astype(int)

    df = df[(df["Likes"] + df["Comments"]) > 0]
    report["after_engagement_filter"] = len(df)

    df["category"] = df["category"].str.lower()
    df.loc[~df["category"].isin(VALID_CATEGORIES), "category"] = "other"

    df["image_path"] = ""
    report["output_rows"] = len(df)
    return df.reset_index(drop=True), report


def main() -> None:
    parser = argparse.ArgumentParser(description="Clean Kim Instagram CSV for training")
    parser.add_argument("--in", dest="in_path", default="data/instagram_kim.csv")
    parser.add_argument("--out", dest="out_path", default="data/instagram_kim_clean.csv")
    args = parser.parse_args()

    in_path = Path(args.in_path)
    out_path = Path(args.out_path)
    if not in_path.is_file():
        raise SystemExit(f"Input not found: {in_path}")

    df = pd.read_csv(in_path, encoding="latin-1")
    cleaned, report = clean_kim(df)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    cleaned.to_csv(out_path, index=False)

    print(f"Input:  {in_path} ({report['input_rows']:,} rows)")
    print(f"Output: {out_path} ({report['output_rows']:,} rows)")
    for step in ("after_dedupe", "after_nonempty_caption", "after_engagement_filter"):
        print(f"  {step}: {report[step]:,}")
    print(f"Categories: {cleaned['category'].value_counts().to_dict()}")


if __name__ == "__main__":
    main()
