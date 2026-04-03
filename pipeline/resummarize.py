"""Regenerate AI summaries for all filings without re-downloading/re-parsing."""
import json
from pipeline.index import get_connection, delete_summaries, insert_summaries
from pipeline.summarize import generate_all_summaries


def resummarize_all():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT f.id, f.year, c.id, c.name
                FROM "Filing" f
                JOIN "Company" c ON c.id = f."companyId"
                WHERE f.status = 'done'
                ORDER BY c.name, f.year
            """)
            filings = cur.fetchall()

            for filing_id, year, company_id, company_name in filings:
                print(f"\n{'='*60}")
                print(f"Resummarizing: {company_name} ({year})")
                print(f"{'='*60}")

                cur.execute("""
                    SELECT heading, content, category
                    FROM "Section"
                    WHERE "filingId" = %s
                    ORDER BY "orderIndex"
                """, (filing_id,))
                rows = cur.fetchall()

                sections_by_theme: dict[str, list[dict]] = {}
                for heading, content, category in rows:
                    if category not in sections_by_theme:
                        sections_by_theme[category] = []
                    sections_by_theme[category].append({
                        "heading": heading,
                        "content": content,
                    })

                print(f"  Sections: {', '.join(f'{k}({len(v)})' for k, v in sections_by_theme.items())}")

                summaries = generate_all_summaries(sections_by_theme, company_name)
                print(f"  Generated {len(summaries)} summaries")
                for s in summaries:
                    bp_count = sum(len(g["points"]) for g in s["bulletPoints"])
                    print(f"    {s['theme']}: {s['score']}/5 ({len(s['bulletPoints'])} categories, {bp_count} points)")

                delete_summaries(cur, filing_id)
                insert_summaries(cur, filing_id, company_id, summaries)
                conn.commit()
                print(f"  Saved!")

    finally:
        conn.close()

    print(f"\nDone! Resummarized {len(filings)} filing(s).")


if __name__ == "__main__":
    resummarize_all()
