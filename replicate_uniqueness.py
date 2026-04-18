#!/usr/bin/env python3
"""
DNI v4.0 — Uniqueness Replication Script
-----------------------------------------
Reproduces the Uniqueness (U) dimension for the UKRI Metascience Challenge
blind 1,000-DOI sample. Faithful Python port of src/disruptionDetector.ts.

The frozen Master_Forensic dataset was produced with gemini-2.0-flash.
This script uses gemini-2.5-flash (the closest available successor on the
review window API key). See README §7 for tolerance implications.

USAGE:
    pip install google-genai python-dotenv
    cp .env.example .env        # paste your GEMINI_API_KEY into .env
    python replicate_uniqueness.py
    python replicate_uniqueness.py --qps 2.0   # paid-tier key, faster
"""

import argparse
import csv
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("ERROR: Run:  pip install google-genai", file=sys.stderr)
    sys.exit(1)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


# -------------------------------------------------------------------------
# Constants — lifted verbatim from src/disruptionDetector.ts
# -------------------------------------------------------------------------

BIO_METHOD_KEYWORDS = [
    'reprogramm', 'reprogram', 'pluripotent', 'induc', 'differentiat',
    'transdifferentiat', 'crispr', 'gene edit', 'gene therapy',
    'cell therapy', 'immunotherapy', 'organoid', 'stem cell',
    'derive', 'derived', 'we demonstrate generation', 'first demonstration',
]

TOP_BIO_JOURNAL_MARKERS = [
    'cell', 'nature.com/nm', 'nature.com/nbt', 'nature.com/ng',
    'nature/nm', 'nature/nbt',
]

NORMAL_SCIENCE_TITLE_PREFIXES = [
    'observation of', 'measurement of', 'study of',
]

MODEL_NAME        = 'gemini-2.0-flash'
TEMPERATURE       = 0.4
MAX_OUTPUT_TOKENS = 16
ABSTRACT_TRUNCATE = 1500
ABSTRACT_MIN_LEN  = 50
TITLE_MIN_LEN     = 20


# -------------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------------

def is_top_bio_journal(doi: str) -> bool:
    d = (doi or '').lower()
    return any(marker in d for marker in TOP_BIO_JOURNAL_MARKERS)


def count_keywords(text: str, keywords) -> int:
    t = (text or '').lower()
    return sum(1 for k in keywords if k in t)


def apply_post_processing(raw_score: float, title: str,
                          abstract: str, doi: str) -> float:
    score = raw_score
    title_lower = (title or '').lower()
    if any(title_lower.startswith(p) for p in NORMAL_SCIENCE_TITLE_PREFIXES):
        score = min(score, 0.75)
    if score <= 0.5:
        is_bio = count_keywords(f"{title} {abstract}", BIO_METHOD_KEYWORDS) >= 1
        if is_bio and is_top_bio_journal(doi):
            score = max(score, 0.85)
    return round(score, 4)


def parse_score(raw: str) -> float:
    cleaned = raw.replace('"', '').replace("'", '').strip()
    try:
        return float(cleaned)
    except ValueError:
        pass
    match = re.search(r'\b(0?\.\d+|[01]\.?\d*)\b', cleaned)
    if match:
        return float(match.group())
    raise ValueError(f"No parseable float in: {raw[:60]}")


def call_gemini(client, prompt: str, max_retries: int = 6) -> str:
    last_err = None
    for attempt in range(max_retries + 1):
        try:
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=TEMPERATURE,
                    max_output_tokens=64,
                    thinking_config=types.ThinkingConfig(
                        thinking_budget=0  # disable thinking for speed/cost
                    ),
                ),
            )
            return (response.text or '').strip()
        except Exception as e:
            last_err = e
            if attempt >= max_retries:
                break
            msg = str(e)
            is_429 = '429' in msg or 'RESOURCE_EXHAUSTED' in msg.upper()
            is_retryable = is_429 or any(
                x in msg for x in ['500', '502', '503', '504', 'timeout'])
            if not is_retryable:
                raise
            wait = min(15 * (attempt + 1), 90) if is_429 else min(2 ** attempt, 16)
            short_msg = msg.replace('\n', ' ')[:120]
            print(f"  [retry {attempt + 1}/{max_retries}] "
                  f"{'rate-limit' if is_429 else 'error'}: {short_msg} "
                  f"— waiting {wait}s", file=sys.stderr)
            time.sleep(wait)
    raise last_err


def score_paper(client, prompt_template: str, doi: str,
                title: str, abstract: str):
    if abstract and len(abstract) >= ABSTRACT_MIN_LEN:
        text, source_label = abstract, 'Abstract'
    elif title and len(title) > TITLE_MIN_LEN:
        text, source_label = title, 'Title Only'
    else:
        return None, 'no_text'

    prompt = (prompt_template
              .replace('{{ABSTRACT}}', text[:ABSTRACT_TRUNCATE])
              .replace('{{TEXT}}', text[:ABSTRACT_TRUNCATE])
              .replace('{{SOURCE}}', source_label))

    try:
        raw = call_gemini(client, prompt)
    except Exception as e:
        return None, f'api_fail:{str(e)[:80]}'

    try:
        score = parse_score(raw)
    except ValueError:
        return None, f'unparseable:{raw[:40]}'

    if not (0.0 <= score <= 1.0):
        return None, f'out_of_range:{score}'

    final = apply_post_processing(score, title, abstract, doi)
    return final, source_label


# -------------------------------------------------------------------------
# Main
# -------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="DNI v4.0 Uniqueness replication")
    ap.add_argument('--input',  default='abstracts_snapshot.csv')
    ap.add_argument('--output', default='outputs/rederived_uniqueness.csv')
    ap.add_argument('--prompt', default='src/prompt_uniqueness.txt')
    ap.add_argument('--qps', type=float, default=0.2,
                    help="Queries per second (default 0.2 = 12 RPM, "
                         "safe for free tier). Paid tier: --qps 2.0")
    args = ap.parse_args()

    min_interval = 1.0 / max(args.qps, 0.01)

    api_key = (os.environ.get('GEMINI_API_KEY')
               or os.environ.get('GOOGLE_API_KEY'))
    if not api_key:
        print("ERROR: GEMINI_API_KEY is not set.", file=sys.stderr)
        print("  Copy .env.example to .env and paste your key.", file=sys.stderr)
        sys.exit(1)

    prompt_path = Path(args.prompt)
    if not prompt_path.exists():
        print(f"ERROR: prompt file not found: {prompt_path}", file=sys.stderr)
        sys.exit(1)
    prompt_template = prompt_path.read_text(encoding='utf-8')

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"ERROR: input CSV not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    client = genai.Client(api_key=api_key)

    with input_path.open('r', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))

    print(f"[replicate] Loaded {len(rows)} rows from {input_path}")
    print(f"[replicate] Model: {MODEL_NAME} | Temperature: {TEMPERATURE}")
    print(f"[replicate] Pacing: {args.qps} QPS (~{min_interval:.1f}s between calls)")
    print(f"[replicate] Output: {output_path}")
    print()

    with output_path.open('w', newline='', encoding='utf-8') as out:
        w = csv.writer(out)
        w.writerow(['doi', 'U_rederived', 'source', 'timestamp_iso'])

        t0 = time.time()
        last_call_t = 0.0

        for i, row in enumerate(rows):
            doi      = (row.get('doi')      or row.get('DOI')      or '').strip()
            title    = (row.get('title')    or row.get('Title')    or '').strip()
            abstract = (row.get('abstract') or row.get('Abstract') or '').strip()

            if not doi:
                continue

            elapsed_since = time.time() - last_call_t
            if elapsed_since < min_interval:
                time.sleep(min_interval - elapsed_since)
            last_call_t = time.time()

            score, source = score_paper(client, prompt_template,
                                        doi, title, abstract)
            ts = datetime.now(timezone.utc).isoformat(timespec='seconds')

            w.writerow([doi,
                        f'{score:.4f}' if score is not None else '',
                        source,
                        ts])
            out.flush()

            if (i + 1) % 25 == 0 or (i + 1) == len(rows):
                elapsed = time.time() - t0
                rate = (i + 1) / elapsed if elapsed > 0 else 0
                eta  = (len(rows) - (i + 1)) / rate if rate > 0 else 0
                print(f"[progress] {i + 1}/{len(rows)} "
                      f"@ {rate:.2f} rows/sec | ETA {eta:.0f}s")

    print()
    print(f"[done] Wrote {output_path}")
    print("[next] Run the comparator:")
    print(f"  python compare_uniqueness.py "
          f"--frozen master_forensic_1000.csv "
          f"--rederived {output_path} "
          f"--output outputs/tolerance_comparison.md")


if __name__ == '__main__':
    main()