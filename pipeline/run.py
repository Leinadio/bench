"""
FilingLens Pipeline Orchestrator.

Usage:
    python -m pipeline.run --company "TotalEnergies" --ticker TTE --sector Energy --year 2024 \
        --url "https://totalenergies.com/system/files/documents/totalenergies_document-enregistrement-universel-2024_2025_fr.zip"
"""
import argparse
import sys

from pipeline.config import DOWNLOADS_DIR
from pipeline.download import download_and_extract
from pipeline.parse import parse_xhtml_sections
from pipeline.classify import classify_sections
from pipeline.summarize import generate_all_summaries
from pipeline.index import (
    get_connection,
    get_or_create_company,
    get_or_create_filing,
    insert_sections,
    insert_summaries,
    delete_summaries,
    mark_filing_done,
)


def run_pipeline(company_name: str, ticker: str, sector: str, year: int, url: str, index: str = "CAC40", country: str = "FR"):
    print(f"[1/6] Downloading {url}...")
    output_dir = DOWNLOADS_DIR / ticker / str(year)
    output_dir.mkdir(parents=True, exist_ok=True)

    xhtml_path = download_and_extract(url, str(output_dir))
    if not xhtml_path:
        print("ERROR: No XHTML found in ZIP.")
        sys.exit(1)
    print(f"  -> Extracted: {xhtml_path}")

    print("[2/6] Parsing XHTML sections...")
    with open(xhtml_path, "r", encoding="utf-8") as f:
        xhtml_content = f.read()
    sections = parse_xhtml_sections(xhtml_content)
    print(f"  -> Found {len(sections)} sections")

    print("[3/6] Classifying sections with Claude...")
    sections = classify_sections(sections)
    categories = {}
    for s in sections:
        categories[s["category"]] = categories.get(s["category"], 0) + 1
    print(f"  -> Categories: {categories}")

    print("[4/6] Indexing sections in PostgreSQL...")
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            company_id = get_or_create_company(cur, company_name, ticker, index, sector, country)
            filing_id = get_or_create_filing(cur, company_id, year, url)
            cur.execute('DELETE FROM "Section" WHERE "filingId" = %s', (filing_id,))
            insert_sections(cur, filing_id, sections)
        conn.commit()
    finally:
        conn.close()
    print(f"  -> Indexed {len(sections)} sections")

    print("[5/6] Generating AI summaries...")
    sections_by_theme = {}
    for s in sections:
        cat = s["category"]
        if cat not in sections_by_theme:
            sections_by_theme[cat] = []
        sections_by_theme[cat].append(s)

    summaries = generate_all_summaries(sections_by_theme, company_name)
    print(f"  -> Generated {len(summaries)} summaries")
    for s in summaries:
        print(f"    {s['theme']}: {s['score']}/5")

    print("[6/6] Saving summaries and finalizing...")
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            delete_summaries(cur, filing_id)
            insert_summaries(cur, filing_id, company_id, summaries)
            mark_filing_done(cur, filing_id)
        conn.commit()
    finally:
        conn.close()

    print(f"Done! {len(sections)} sections + {len(summaries)} summaries for {company_name} ({year})")
    return sections, summaries


def main():
    parser = argparse.ArgumentParser(description="FilingLens Pipeline")
    parser.add_argument("--company", required=True, help="Company name")
    parser.add_argument("--ticker", required=True, help="Stock ticker")
    parser.add_argument("--sector", default="Unknown", help="Sector")
    parser.add_argument("--year", type=int, required=True, help="Filing year")
    parser.add_argument("--url", required=True, help="ESEF ZIP URL")
    parser.add_argument("--index", default="CAC40", help="Stock index")
    parser.add_argument("--country", default="FR", help="Country code")
    args = parser.parse_args()

    run_pipeline(
        company_name=args.company,
        ticker=args.ticker,
        sector=args.sector,
        year=args.year,
        url=args.url,
        index=args.index,
        country=args.country,
    )


if __name__ == "__main__":
    main()
