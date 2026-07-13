"""
Clean instagram_kim.csv before engagement model training.

Usage:
  cd backend
  python scripts/clean_kim_dataset.py
  python scripts/clean_kim_dataset.py --in data/instagram_kim.csv --out data/instagram_kim_clean.csv
"""

from __future__ import annotations

import argparse
import math
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


def _resolve_influencers_path(explicit: str | None) -> Path | None:
    if explicit:
        path = Path(explicit)
        return path if path.is_file() else None
    candidates = [
        Path("data/kim_raw/influencers.txt"),
        Path(__file__).resolve().parents[4] / "fyp" / "backend" / "data" / "kim_raw" / "influencers.txt",
    ]
    for path in candidates:
        if path.is_file():
            return path
    return None


def load_follower_map(influencers_path: Path) -> dict[str, int]:
    """username (lower) → follower count from Kim influencers.txt."""
    mapping: dict[str, int] = {}
    for raw in influencers_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("=") or line.lower().startswith("username"):
            continue
        parts = line.split("\t") if "\t" in line else line.split(",")
        if len(parts) < 3:
            continue
        username = parts[0].strip().lower()
        try:
            followers = int(str(parts[2]).replace(",", "").strip())
        except ValueError:
            continue
        if username and followers > 0:
            mapping[username] = followers
    return mapping


def attach_followers(df: pd.DataFrame, influencers_path: Path | None) -> pd.DataFrame:
    if not influencers_path or not influencers_path.is_file():
        print("Warning: influencers.txt not found — followers column will be empty")
        df["followers"] = 0
        return df

    follower_map = load_follower_map(influencers_path)
    if "username" not in df.columns:
        df["followers"] = 0
        return df

    df["followers"] = (
        df["username"].astype(str).str.strip().str.lower().map(follower_map).fillna(0).astype(int)
    )
    matched = int((df["followers"] > 0).sum())
    print(f"Followers joined: {matched:,}/{len(df):,} posts ({matched / max(len(df), 1):.1%})")
    return df


def clean_kim(df: pd.DataFrame, influencers_path: Path | None = None) -> tuple[pd.DataFrame, dict]:
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
    df = attach_followers(df, influencers_path)
    report["output_rows"] = len(df)
    return df.reset_index(drop=True), report


def followers_p99(df: pd.DataFrame) -> float:
    if "followers" not in df.columns:
        return 1.0
    series = pd.to_numeric(df["followers"], errors="coerce").fillna(0)
    positive = series[series > 0]
    if positive.empty:
        return 1.0
    return float(positive.quantile(0.99)) or 1.0


def normalize_followers(followers: float, p99: float, default: float = 0.0) -> float:
    value = float(followers) if followers and followers > 0 else default
    if value <= 0:
        return 0.0
    denom = math.log1p(max(p99, 1.0))
    return round(min(1.0, math.log1p(value) / denom), 4)


def main() -> None:
    parser = argparse.ArgumentParser(description="Clean Kim Instagram CSV for training")
    parser.add_argument("--in", dest="in_path", default="data/instagram_kim.csv")
    parser.add_argument("--out", dest="out_path", default="data/instagram_kim_clean.csv")
    parser.add_argument(
        "--influencers",
        default="",
        help="Path to Kim influencers.txt (auto-detected if omitted)",
    )
    args = parser.parse_args()

    in_path = Path(args.in_path)
    out_path = Path(args.out_path)
    if not in_path.is_file():
        raise SystemExit(f"Input not found: {in_path}")

    influencers_path = _resolve_influencers_path(args.influencers or None)
    if influencers_path:
        print(f"Influencers: {influencers_path}")

    df = pd.read_csv(in_path, encoding="latin-1")
    cleaned, report = clean_kim(df, influencers_path)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    cleaned.to_csv(out_path, index=False)

    print(f"Input:  {in_path} ({report['input_rows']:,} rows)")
    print(f"Output: {out_path} ({report['output_rows']:,} rows)")
    for step in ("after_dedupe", "after_nonempty_caption", "after_engagement_filter"):
        print(f"  {step}: {report[step]:,}")
    print(f"Categories: {cleaned['category'].value_counts().to_dict()}")


if __name__ == "__main__":
    main()
