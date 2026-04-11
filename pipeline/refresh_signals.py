"""
Refresh signals for all companies. Run via cron every 30 minutes.

Usage:
    python -m pipeline.refresh_signals
"""
import json
import re
import urllib.request
from anthropic import Anthropic
from pipeline.config import ANTHROPIC_API_KEY, DATABASE_URL
import psycopg2


def get_connection():
    return psycopg2.connect(DATABASE_URL)


def get_client() -> Anthropic:
    return Anthropic(api_key=ANTHROPIC_API_KEY)


def fetch_news(company_name: str, ticker: str) -> list[dict]:
    """Fetch recent articles from Google News RSS."""
    query = urllib.request.quote(f'"{company_name}" OR "{ticker}"')
    url = f"https://news.google.com/rss/search?q={query}&hl=fr&gl=FR&ceid=FR:fr"
    req = urllib.request.Request(url, headers={"User-Agent": "FilingLens/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            xml = resp.read().decode("utf-8")
    except Exception as e:
        print(f"    RSS fetch failed: {e}")
        return []

    articles = []
    for match in re.finditer(r"<item>([\s\S]*?)</item>", xml):
        if len(articles) >= 8:
            break
        item = match.group(1)
        title = re.search(r"<title>([\s\S]*?)</title>", item)
        link = re.search(r"<link>([\s\S]*?)</link>", item)
        pub_date = re.search(r"<pubDate>([\s\S]*?)</pubDate>", item)
        if title and link:
            articles.append({
                "title": title.group(1).strip().replace("&amp;", "&").replace("&#39;", "'").replace("&quot;", '"'),
                "url": link.group(1).strip(),
                "publishedAt": pub_date.group(1).strip() if pub_date else "",
            })
    return articles


def analyze_articles(client: Anthropic, articles: list[dict], company_name: str, ticker: str, sector: str, scores_context: str) -> list[dict]:
    """Analyze new articles with Claude Haiku."""
    articles_list = "\n".join(f"{i+1}. {a['title']} | {a['url']}" for i, a in enumerate(articles))

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": f"""{company_name} ({ticker}, {sector}). Scores DEU: {scores_context}.

Nouvelles actualités:
{articles_list}

Pour chaque actualité, génère un signal JSON. IMPORTANT: retourne un JSON array valide, sans trailing commas.
Champs: type ("positive"/"negative"/"neutral"), title, summary (1 phrase), justification (1 phrase: pourquoi haussier/baissier pour le cours), theme ("risk"/"strategy"/null), sourceUrl, date (JJ/MM/AAAA), relatedRisks (liste courte).

JSON array uniquement:""",
        }],
    )

    text = response.content[0].text if response.content[0].type == "text" else "[]"
    cleaned = re.sub(r"```json\n?|```\n?", "", text).strip()
    # Fix common JSON issues: trailing commas
    cleaned = re.sub(r",\s*([}\]])", r"\1", cleaned)
    array_match = re.search(r"\[[\s\S]*\]", cleaned)
    if not array_match:
        return []
    try:
        return json.loads(array_match.group(0))
    except json.JSONDecodeError as e:
        print(f"    JSON parse error: {e}")
        return []


def refresh_all():
    conn = get_connection()
    client = get_client()

    try:
        with conn.cursor() as cur:
            # Get all companies with their scores
            cur.execute("""
                SELECT c.id, c.name, c.ticker, c.sector,
                       COALESCE(string_agg(
                           CASE WHEN cs.theme IN ('risk', 'strategy')
                                THEN cs.theme || ' ' || cs.score || '/5'
                           END, ', '
                       ), '') as scores
                FROM "Company" c
                LEFT JOIN "CompanySummary" cs ON cs."companyId" = c.id
                GROUP BY c.id
            """)
            companies = cur.fetchall()

            for company_id, name, ticker, sector, scores in companies:
                print(f"\n[{ticker}] {name}")

                # Get existing signal URLs
                cur.execute('SELECT "sourceUrl" FROM "Signal" WHERE "companyId" = %s', (company_id,))
                existing_urls = {row[0] for row in cur.fetchall()}

                # Fetch RSS
                articles = fetch_news(name, ticker)
                new_articles = [a for a in articles if a["url"] not in existing_urls]

                if not new_articles:
                    print(f"  No new articles (checked {len(articles)})")
                    continue

                print(f"  {len(new_articles)} new article(s) to analyze")

                # Analyze with Claude
                try:
                    signals = analyze_articles(client, new_articles, name, ticker, sector, scores)
                except Exception as e:
                    print(f"  Error analyzing: {e}")
                    continue

                # Store in DB
                from datetime import datetime as dt
                today = dt.now().strftime("%d/%m/%Y")
                for signal in signals:
                    cur.execute("""
                        INSERT INTO "Signal" (id, "companyId", type, title, summary, justification, theme, "sourceUrl", date, "relatedRisks", "analyzedAt")
                        VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    """, (
                        company_id,
                        signal.get("type", "neutral"),
                        signal.get("title", "")[:500],
                        signal.get("summary", "")[:1000],
                        signal.get("justification", "")[:1000],
                        signal.get("theme") if signal.get("theme") in ("risk", "strategy") else None,
                        signal.get("sourceUrl", ""),
                        signal.get("date") or today,
                        json.dumps(signal.get("relatedRisks", []), ensure_ascii=False),
                    ))

                conn.commit()
                print(f"  Stored {len(signals)} signal(s)")

    finally:
        conn.close()

    print("\nDone!")


if __name__ == "__main__":
    refresh_all()
