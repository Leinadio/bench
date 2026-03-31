# FilingLens MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web app that parses European Universal Registration Documents (DEU) in ESEF/XHTML format, indexes their qualitative content, and lets investors search, compare, and ask questions across filings.

**Architecture:** Next.js 15 frontend + API routes for search/Q&A. Python CLI pipeline for parsing (not a server — runs once per filing, populates DB). PostgreSQL with built-in full-text search (tsvector) — no Elasticsearch needed for MVP. Claude API for section classification and Q&A.

**Tech Stack:** Next.js 15 (App Router, TypeScript, Tailwind, shadcn/ui), PostgreSQL 16 (Docker), Prisma ORM, Python 3.11 (BeautifulSoup, lxml, anthropic SDK, psycopg2), Claude API (claude-sonnet-4-6)

**Key simplification:** No FastAPI server for MVP. Python pipeline is a CLI tool that populates the DB. Next.js API routes handle all web requests. This avoids running two servers.

---

## File Structure

```
bench/
├── docker-compose.yml                  # PostgreSQL
├── .env                                # DB URL, Claude API key
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── prisma/
│   └── schema.prisma                   # DB schema: companies, filings, sections, financial_data
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout with sidebar nav
│   │   ├── page.tsx                    # Dashboard: company list + stats
│   │   ├── search/
│   │   │   └── page.tsx               # Full-text search across filings
│   │   ├── compare/
│   │   │   └── page.tsx               # Side-by-side comparison
│   │   ├── company/
│   │   │   └── [id]/
│   │   │       └── page.tsx           # Company detail: sections + Q&A
│   │   └── api/
│   │       ├── companies/
│   │       │   └── route.ts           # GET: list companies with filings
│   │       ├── companies/[id]/
│   │       │   └── route.ts           # GET: single company with sections
│   │       ├── search/
│   │       │   └── route.ts           # GET: full-text search
│   │       ├── compare/
│   │       │   └── route.ts           # POST: compare sections
│   │       └── qa/
│   │           └── route.ts           # POST: Q&A with Claude
│   ├── lib/
│   │   ├── db.ts                       # Prisma client singleton
│   │   ├── claude.ts                   # Claude API client
│   │   └── types.ts                    # Shared TypeScript types
│   └── components/
│       ├── layout/
│       │   ├── sidebar.tsx             # App sidebar nav
│       │   └── header.tsx              # Page header
│       ├── search/
│       │   ├── search-bar.tsx          # Search input
│       │   └── search-results.tsx      # Results list with snippets
│       ├── company/
│       │   ├── company-card.tsx        # Company card for dashboard
│       │   ├── section-nav.tsx         # Section sidebar navigation
│       │   ├── section-content.tsx     # Section content display
│       │   └── qa-chat.tsx             # Q&A chat interface
│       └── compare/
│           ├── company-selector.tsx    # Multi-select companies
│           └── compare-view.tsx        # Side-by-side display
├── pipeline/
│   ├── requirements.txt                # Python deps
│   ├── config.py                       # DB config, paths
│   ├── download.py                     # Download ESEF ZIP + extract XHTML
│   ├── parse.py                        # Parse XHTML into sections
│   ├── classify.py                     # Classify sections with Claude
│   ├── index.py                        # Insert sections into PostgreSQL
│   ├── run.py                          # Orchestrate full pipeline
│   └── tests/
│       ├── test_download.py
│       ├── test_parse.py
│       ├── test_classify.py
│       └── test_index.py
└── data/
    └── companies.json                  # CAC 40 companies + ESEF URLs
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `docker-compose.yml`, `.env`, `pipeline/requirements.txt`, `data/companies.json`
- Modify: `package.json` (after Next.js init)

- [ ] **Step 1: Init Next.js project**

```bash
cd ~/Developer/Projects/bench
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Accept defaults. Expected: Next.js project scaffolded in `bench/`.

- [ ] **Step 2: Add shadcn/ui**

```bash
cd ~/Developer/Projects/bench
npx shadcn@latest init -d
```

Then add components we'll need:

```bash
npx shadcn@latest add button input card badge separator scroll-area tabs sheet command dialog textarea
```

- [ ] **Step 3: Create docker-compose.yml**

Create `~/Developer/Projects/bench/docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: filinglens
      POSTGRES_PASSWORD: filinglens
      POSTGRES_DB: filinglens
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

- [ ] **Step 4: Create .env**

Create `~/Developer/Projects/bench/.env`:

```env
DATABASE_URL="postgresql://filinglens:filinglens@localhost:5432/filinglens"
ANTHROPIC_API_KEY="your-key-here"
```

Add `.env` to `.gitignore` if not already there.

- [ ] **Step 5: Create Python pipeline environment**

Create `~/Developer/Projects/bench/pipeline/requirements.txt`:

```
beautifulsoup4==4.12.3
lxml==5.3.0
psycopg2-binary==2.9.10
anthropic==0.43.0
requests==2.32.3
python-dotenv==1.0.1
pytest==8.3.4
```

```bash
cd ~/Developer/Projects/bench/pipeline
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

- [ ] **Step 6: Create initial companies seed data**

Create `~/Developer/Projects/bench/data/companies.json`:

```json
[
  {
    "name": "TotalEnergies",
    "ticker": "TTE",
    "index": "CAC40",
    "sector": "Energy",
    "country": "FR",
    "filings": [
      {
        "year": 2024,
        "zip_url": "https://totalenergies.com/system/files/documents/totalenergies_universal-registration-document-2024_2025_en.zip",
        "xhtml_url": "https://publications.totalenergies.com/DEU_2024/totalenergies_universal-registration-document-2024_2025_en.xhtml"
      }
    ]
  },
  {
    "name": "LVMH",
    "ticker": "MC",
    "index": "CAC40",
    "sector": "Luxury",
    "country": "FR",
    "filings": []
  },
  {
    "name": "L'Oréal",
    "ticker": "OR",
    "index": "CAC40",
    "sector": "Consumer",
    "country": "FR",
    "filings": []
  },
  {
    "name": "Sanofi",
    "ticker": "SAN",
    "index": "CAC40",
    "sector": "Healthcare",
    "country": "FR",
    "filings": []
  },
  {
    "name": "Schneider Electric",
    "ticker": "SU",
    "index": "CAC40",
    "sector": "Industrials",
    "country": "FR",
    "filings": []
  }
]
```

- [ ] **Step 7: Start PostgreSQL and verify**

```bash
cd ~/Developer/Projects/bench
docker compose up -d
docker compose ps
```

Expected: PostgreSQL running on port 5432.

- [ ] **Step 8: Init git repo and commit**

```bash
cd ~/Developer/Projects/bench
git init
git add .
git commit -m "feat: initial project scaffolding - Next.js + Docker PG + Python pipeline"
```

---

## Task 2: Database Schema

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/db.ts`

- [ ] **Step 1: Install Prisma**

```bash
cd ~/Developer/Projects/bench
npm install prisma @prisma/client
npx prisma init
```

- [ ] **Step 2: Write Prisma schema**

Replace `~/Developer/Projects/bench/prisma/schema.prisma`:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearchPostgres"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Company {
  id      String   @id @default(cuid())
  name    String
  ticker  String   @unique
  index   String
  sector  String
  country String   @default("FR")
  filings Filing[]

  createdAt DateTime @default(now())
}

model Filing {
  id        String   @id @default(cuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id])
  year      Int
  sourceUrl String
  status    String   @default("pending") // pending, parsing, done, error
  parsedAt  DateTime?

  sections      Section[]
  financialData FinancialData[]

  createdAt DateTime @default(now())

  @@unique([companyId, year])
}

model Section {
  id       String @id @default(cuid())
  filingId String
  filing   Filing @relation(fields: [filingId], references: [id])

  heading  String
  depth    Int      @default(1) // 1=h1, 2=h2, 3=h3
  category String   @default("other") // risk, strategy, governance, esg, financial, other
  content  String
  orderIndex Int    @default(0)

  createdAt DateTime @default(now())

  @@index([filingId])
  @@index([category])
}

model FinancialData {
  id       String @id @default(cuid())
  filingId String
  filing   Filing @relation(fields: [filingId], references: [id])

  tagName     String
  value       String
  unit        String?
  periodStart DateTime?
  periodEnd   DateTime?

  @@index([filingId])
  @@index([tagName])
}
```

- [ ] **Step 3: Run migration**

```bash
cd ~/Developer/Projects/bench
npx prisma migrate dev --name init
```

Expected: Migration created, tables exist in PostgreSQL.

- [ ] **Step 4: Add full-text search index via raw SQL migration**

Create a new migration manually:

```bash
mkdir -p prisma/migrations/20260331180000_add_fts
```

Create `~/Developer/Projects/bench/prisma/migrations/20260331180000_add_fts/migration.sql`:

```sql
-- Add tsvector column for full-text search
ALTER TABLE "Section" ADD COLUMN "search_vector" tsvector;

-- Populate search vector
UPDATE "Section" SET "search_vector" = to_tsvector('french', coalesce("heading", '') || ' ' || coalesce("content", ''));

-- Create GIN index for fast search
CREATE INDEX "Section_search_vector_idx" ON "Section" USING GIN ("search_vector");

-- Create trigger to auto-update search vector
CREATE OR REPLACE FUNCTION section_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."search_vector" := to_tsvector('french', coalesce(NEW."heading", '') || ' ' || coalesce(NEW."content", ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER section_search_vector_trigger
  BEFORE INSERT OR UPDATE ON "Section"
  FOR EACH ROW
  EXECUTE FUNCTION section_search_vector_update();
```

Apply:

```bash
cd ~/Developer/Projects/bench
npx prisma migrate dev --name add_fts
```

- [ ] **Step 5: Create Prisma client singleton**

Create `~/Developer/Projects/bench/src/lib/db.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db =
  globalForPrisma.prisma ||
  new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: database schema with companies, filings, sections + FTS index"
```

---

## Task 3: Python Pipeline — Download & Extract

**Files:**
- Create: `pipeline/config.py`, `pipeline/download.py`, `pipeline/tests/test_download.py`

- [ ] **Step 1: Write the failing test**

Create `~/Developer/Projects/bench/pipeline/tests/__init__.py` (empty file).

Create `~/Developer/Projects/bench/pipeline/tests/test_download.py`:

```python
import os
import tempfile
import pytest
from unittest.mock import patch, MagicMock
from pipeline.download import download_and_extract


def test_download_and_extract_zip():
    """Test that download_and_extract fetches a ZIP and extracts the XHTML file."""
    # Create a fake ZIP in memory with an XHTML file inside
    import zipfile
    import io

    xhtml_content = b"<html><body><h1>Test DEU</h1></body></html>"
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr("test_document.xhtml", xhtml_content)
    zip_bytes = zip_buffer.getvalue()

    mock_response = MagicMock()
    mock_response.content = zip_bytes
    mock_response.status_code = 200
    mock_response.raise_for_status = MagicMock()

    with tempfile.TemporaryDirectory() as tmpdir:
        with patch("pipeline.download.requests.get", return_value=mock_response):
            xhtml_path = download_and_extract(
                url="https://example.com/test.zip",
                output_dir=tmpdir,
            )

        assert xhtml_path is not None
        assert xhtml_path.endswith(".xhtml")
        assert os.path.exists(xhtml_path)
        with open(xhtml_path, "rb") as f:
            assert f.read() == xhtml_content


def test_download_and_extract_no_xhtml_in_zip():
    """Test that it returns None if no XHTML found in ZIP."""
    import zipfile
    import io

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr("readme.txt", b"no xhtml here")
    zip_bytes = zip_buffer.getvalue()

    mock_response = MagicMock()
    mock_response.content = zip_bytes
    mock_response.status_code = 200
    mock_response.raise_for_status = MagicMock()

    with tempfile.TemporaryDirectory() as tmpdir:
        with patch("pipeline.download.requests.get", return_value=mock_response):
            xhtml_path = download_and_extract(
                url="https://example.com/test.zip",
                output_dir=tmpdir,
            )

        assert xhtml_path is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Developer/Projects/bench
source pipeline/venv/bin/activate
PYTHONPATH=. python -m pytest pipeline/tests/test_download.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'pipeline.download'`

- [ ] **Step 3: Create config**

Create `~/Developer/Projects/bench/pipeline/__init__.py` (empty file).

Create `~/Developer/Projects/bench/pipeline/config.py`:

```python
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://filinglens:filinglens@localhost:5432/filinglens")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
DATA_DIR = Path(__file__).parent.parent / "data"
DOWNLOADS_DIR = DATA_DIR / "downloads"
DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
```

- [ ] **Step 4: Implement download.py**

Create `~/Developer/Projects/bench/pipeline/download.py`:

```python
import os
import zipfile
import io
from pathlib import Path

import requests


def download_and_extract(url: str, output_dir: str) -> str | None:
    """Download an ESEF ZIP file and extract the XHTML file.

    Returns the path to the extracted XHTML file, or None if no XHTML found.
    """
    response = requests.get(url, timeout=120)
    response.raise_for_status()

    zip_buffer = io.BytesIO(response.content)

    with zipfile.ZipFile(zip_buffer, "r") as zf:
        xhtml_files = [
            name for name in zf.namelist()
            if name.lower().endswith((".xhtml", ".htm", ".html"))
            and not name.startswith("__MACOSX")
        ]

        if not xhtml_files:
            return None

        # Pick the largest XHTML file (the main document)
        largest = max(xhtml_files, key=lambda n: zf.getinfo(n).file_size)

        extracted_path = os.path.join(output_dir, os.path.basename(largest))
        with open(extracted_path, "wb") as f:
            f.write(zf.read(largest))

        return extracted_path
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd ~/Developer/Projects/bench
source pipeline/venv/bin/activate
PYTHONPATH=. python -m pytest pipeline/tests/test_download.py -v
```

Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add pipeline/
git commit -m "feat: pipeline download module - fetch ESEF ZIP and extract XHTML"
```

---

## Task 4: Python Pipeline — Parse XHTML into Sections

**Files:**
- Create: `pipeline/parse.py`, `pipeline/tests/test_parse.py`

- [ ] **Step 1: Write the failing test**

Create `~/Developer/Projects/bench/pipeline/tests/test_parse.py`:

```python
import pytest
from pipeline.parse import parse_xhtml_sections


SAMPLE_XHTML = """<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Test DEU</title></head>
<body>
  <h1>1. Risk Factors</h1>
  <p>The company faces several risks including market volatility.</p>
  <p>Currency risk is also significant in our operations.</p>

  <h2>1.1 Market Risk</h2>
  <p>Market conditions may adversely affect our business.</p>

  <h2>1.2 Regulatory Risk</h2>
  <p>Changes in regulation could impact operations.</p>

  <h1>2. Strategy and Objectives</h1>
  <p>Our strategy focuses on sustainable growth.</p>

  <h2>2.1 Growth Targets</h2>
  <p>We aim to grow revenue by 10% annually.</p>
  <table>
    <tr><th>Year</th><th>Target</th></tr>
    <tr><td>2025</td><td>+10%</td></tr>
    <tr><td>2026</td><td>+12%</td></tr>
  </table>
</body>
</html>"""


def test_parse_xhtml_sections_extracts_all_sections():
    sections = parse_xhtml_sections(SAMPLE_XHTML)
    assert len(sections) == 5
    assert sections[0]["heading"] == "1. Risk Factors"
    assert sections[0]["depth"] == 1
    assert "market volatility" in sections[0]["content"]


def test_parse_xhtml_sections_preserves_hierarchy():
    sections = parse_xhtml_sections(SAMPLE_XHTML)
    depths = [s["depth"] for s in sections]
    assert depths == [1, 2, 2, 1, 2]


def test_parse_xhtml_sections_includes_table_text():
    sections = parse_xhtml_sections(SAMPLE_XHTML)
    strategy_section = sections[4]  # "2.1 Growth Targets"
    assert "2025" in strategy_section["content"]
    assert "+10%" in strategy_section["content"]


def test_parse_xhtml_sections_order_index():
    sections = parse_xhtml_sections(SAMPLE_XHTML)
    order_indices = [s["order_index"] for s in sections]
    assert order_indices == [0, 1, 2, 3, 4]
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Developer/Projects/bench
PYTHONPATH=. python -m pytest pipeline/tests/test_parse.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'pipeline.parse'`

- [ ] **Step 3: Implement parse.py**

Create `~/Developer/Projects/bench/pipeline/parse.py`:

```python
from bs4 import BeautifulSoup, Tag

HEADING_TAGS = {"h1", "h2", "h3", "h4"}
HEADING_DEPTH = {"h1": 1, "h2": 2, "h3": 3, "h4": 4}


def _extract_text(elements: list[Tag]) -> str:
    """Extract readable text from a list of HTML elements."""
    parts = []
    for el in elements:
        if isinstance(el, Tag) and el.name == "table":
            parts.append(_table_to_text(el))
        elif isinstance(el, Tag):
            text = el.get_text(separator=" ", strip=True)
            if text:
                parts.append(text)
        else:
            text = str(el).strip()
            if text:
                parts.append(text)
    return "\n\n".join(parts)


def _table_to_text(table: Tag) -> str:
    """Convert an HTML table to readable text."""
    rows = []
    for tr in table.find_all("tr"):
        cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
        rows.append(" | ".join(cells))
    return "\n".join(rows)


def parse_xhtml_sections(xhtml_content: str) -> list[dict]:
    """Parse XHTML content into a list of sections.

    Each section has: heading, depth, content, order_index.
    A section starts at a heading tag and includes all content until the next heading.
    """
    soup = BeautifulSoup(xhtml_content, "lxml")
    body = soup.find("body")
    if not body:
        return []

    sections = []
    current_heading = None
    current_depth = 1
    current_elements: list[Tag] = []

    def _flush():
        if current_heading is not None:
            content = _extract_text(current_elements)
            sections.append({
                "heading": current_heading,
                "depth": current_depth,
                "content": content,
                "order_index": len(sections),
            })

    for element in body.children:
        if not isinstance(element, Tag):
            continue

        if element.name in HEADING_TAGS:
            _flush()
            current_heading = element.get_text(strip=True)
            current_depth = HEADING_DEPTH.get(element.name, 1)
            current_elements = []
        elif current_heading is not None:
            current_elements.append(element)

    _flush()  # flush last section
    return sections
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/Developer/Projects/bench
PYTHONPATH=. python -m pytest pipeline/tests/test_parse.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add pipeline/parse.py pipeline/tests/test_parse.py
git commit -m "feat: XHTML parser - extract sections with headings, content, tables"
```

---

## Task 5: Python Pipeline — Classify Sections with Claude

**Files:**
- Create: `pipeline/classify.py`, `pipeline/tests/test_classify.py`

- [ ] **Step 1: Write the failing test**

Create `~/Developer/Projects/bench/pipeline/tests/test_classify.py`:

```python
import pytest
from unittest.mock import patch, MagicMock
from pipeline.classify import classify_sections

SAMPLE_SECTIONS = [
    {"heading": "1. Risk Factors", "depth": 1, "content": "The company faces market risks.", "order_index": 0},
    {"heading": "2. Strategy", "depth": 1, "content": "Our strategy for growth.", "order_index": 1},
    {"heading": "3. Corporate Governance", "depth": 1, "content": "Board composition and policies.", "order_index": 2},
    {"heading": "4. Financial Statements", "depth": 1, "content": "Revenue was EUR 200B.", "order_index": 3},
    {"heading": "5. Environmental Commitments", "depth": 1, "content": "Carbon reduction targets.", "order_index": 4},
]


def test_classify_sections_returns_categories():
    """Test classification adds a category to each section."""
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='["risk","strategy","governance","financial","esg"]')]

    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response

    with patch("pipeline.classify.get_client", return_value=mock_client):
        result = classify_sections(SAMPLE_SECTIONS)

    assert len(result) == 5
    assert result[0]["category"] == "risk"
    assert result[1]["category"] == "strategy"
    assert result[2]["category"] == "governance"
    assert result[3]["category"] == "financial"
    assert result[4]["category"] == "esg"


def test_classify_sections_handles_unknown_category():
    """Test that unknown categories default to 'other'."""
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='["risk","unknown_thing"]')]

    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response

    sections = SAMPLE_SECTIONS[:2]
    with patch("pipeline.classify.get_client", return_value=mock_client):
        result = classify_sections(sections)

    assert result[0]["category"] == "risk"
    assert result[1]["category"] == "other"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
PYTHONPATH=. python -m pytest pipeline/tests/test_classify.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement classify.py**

Create `~/Developer/Projects/bench/pipeline/classify.py`:

```python
import json
from anthropic import Anthropic
from pipeline.config import ANTHROPIC_API_KEY

VALID_CATEGORIES = {"risk", "strategy", "governance", "esg", "financial", "other"}

CLASSIFY_PROMPT = """You are classifying sections of a European Universal Registration Document (Document d'Enregistrement Universel).

For each section below, assign exactly ONE category from this list:
- risk: Risk factors, uncertainties, litigation, contingent liabilities
- strategy: Strategy, objectives, market positioning, competitive landscape, business model
- governance: Corporate governance, board, compensation, shareholders, voting rights
- esg: Environmental, social, sustainability, CSR, climate, diversity
- financial: Financial statements, accounting policies, notes to accounts, auditor reports
- other: Table of contents, legal disclaimers, cross-reference tables, appendices

Return a JSON array of category strings, one per section, in the same order.
Example: ["risk", "strategy", "financial"]

SECTIONS:
{sections_text}

Return ONLY the JSON array, nothing else."""


def get_client() -> Anthropic:
    return Anthropic(api_key=ANTHROPIC_API_KEY)


def classify_sections(sections: list[dict], batch_size: int = 30) -> list[dict]:
    """Classify sections into categories using Claude API.

    Processes in batches to stay within context limits.
    Returns sections with 'category' field added.
    """
    client = get_client()
    result = []

    for i in range(0, len(sections), batch_size):
        batch = sections[i : i + batch_size]
        sections_text = "\n".join(
            f"[{j}] Heading: {s['heading']}\nContent (first 200 chars): {s['content'][:200]}"
            for j, s in enumerate(batch)
        )

        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            messages=[{"role": "user", "content": CLASSIFY_PROMPT.format(sections_text=sections_text)}],
        )

        raw_text = response.content[0].text.strip()
        categories = json.loads(raw_text)

        for j, section in enumerate(batch):
            cat = categories[j] if j < len(categories) else "other"
            section["category"] = cat if cat in VALID_CATEGORIES else "other"
            result.append(section)

    return result
```

- [ ] **Step 4: Run test to verify it passes**

```bash
PYTHONPATH=. python -m pytest pipeline/tests/test_classify.py -v
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add pipeline/classify.py pipeline/tests/test_classify.py
git commit -m "feat: section classifier using Claude API - risk/strategy/governance/esg/financial"
```

---

## Task 6: Python Pipeline — Index in PostgreSQL

**Files:**
- Create: `pipeline/index.py`, `pipeline/tests/test_index.py`

- [ ] **Step 1: Write the failing test**

Create `~/Developer/Projects/bench/pipeline/tests/test_index.py`:

```python
import pytest
from unittest.mock import patch, MagicMock, call
from pipeline.index import insert_sections, get_or_create_company, get_or_create_filing


def test_get_or_create_company_creates_new():
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = None  # no existing company

    company_id = get_or_create_company(mock_cursor, "TotalEnergies", "TTE", "CAC40", "Energy", "FR")

    assert mock_cursor.execute.call_count == 2  # SELECT + INSERT
    assert company_id is not None


def test_get_or_create_company_returns_existing():
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = ("existing-id-123",)

    company_id = get_or_create_company(mock_cursor, "TotalEnergies", "TTE", "CAC40", "Energy", "FR")

    assert company_id == "existing-id-123"
    assert mock_cursor.execute.call_count == 1  # only SELECT


def test_insert_sections_inserts_all():
    mock_cursor = MagicMock()
    sections = [
        {"heading": "Risk", "depth": 1, "category": "risk", "content": "Some risk.", "order_index": 0},
        {"heading": "Strategy", "depth": 1, "category": "strategy", "content": "Our plan.", "order_index": 1},
    ]

    insert_sections(mock_cursor, "filing-id-123", sections)

    assert mock_cursor.execute.call_count == 2
```

- [ ] **Step 2: Run test to verify it fails**

```bash
PYTHONPATH=. python -m pytest pipeline/tests/test_index.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement index.py**

Create `~/Developer/Projects/bench/pipeline/index.py`:

```python
import uuid
from datetime import datetime

import psycopg2
from pipeline.config import DATABASE_URL


def get_connection():
    return psycopg2.connect(DATABASE_URL)


def get_or_create_company(cursor, name: str, ticker: str, index: str, sector: str, country: str) -> str:
    cursor.execute('SELECT id FROM "Company" WHERE ticker = %s', (ticker,))
    row = cursor.fetchone()
    if row:
        return row[0]

    company_id = str(uuid.uuid4()).replace("-", "")[:25]
    cursor.execute(
        'INSERT INTO "Company" (id, name, ticker, "index", sector, country, "createdAt") VALUES (%s, %s, %s, %s, %s, %s, %s)',
        (company_id, name, ticker, index, sector, country, datetime.now()),
    )
    return company_id


def get_or_create_filing(cursor, company_id: str, year: int, source_url: str) -> str:
    cursor.execute(
        'SELECT id FROM "Filing" WHERE "companyId" = %s AND year = %s',
        (company_id, year),
    )
    row = cursor.fetchone()
    if row:
        return row[0]

    filing_id = str(uuid.uuid4()).replace("-", "")[:25]
    cursor.execute(
        'INSERT INTO "Filing" (id, "companyId", year, "sourceUrl", status, "createdAt") VALUES (%s, %s, %s, %s, %s, %s)',
        (filing_id, company_id, year, source_url, "parsing", datetime.now()),
    )
    return filing_id


def insert_sections(cursor, filing_id: str, sections: list[dict]):
    for section in sections:
        section_id = str(uuid.uuid4()).replace("-", "")[:25]
        cursor.execute(
            'INSERT INTO "Section" (id, "filingId", heading, depth, category, content, "orderIndex", "createdAt") VALUES (%s, %s, %s, %s, %s, %s, %s, %s)',
            (
                section_id,
                filing_id,
                section["heading"],
                section["depth"],
                section["category"],
                section["content"],
                section["order_index"],
                datetime.now(),
            ),
        )


def mark_filing_done(cursor, filing_id: str):
    cursor.execute(
        'UPDATE "Filing" SET status = %s, "parsedAt" = %s WHERE id = %s',
        ("done", datetime.now(), filing_id),
    )
```

- [ ] **Step 4: Run test to verify it passes**

```bash
PYTHONPATH=. python -m pytest pipeline/tests/test_index.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add pipeline/index.py pipeline/tests/test_index.py
git commit -m "feat: database indexer - insert companies, filings, sections into PostgreSQL"
```

---

## Task 7: Python Pipeline — Orchestrator (run.py)

**Files:**
- Create: `pipeline/run.py`

- [ ] **Step 1: Implement the orchestrator**

Create `~/Developer/Projects/bench/pipeline/run.py`:

```python
"""
FilingLens Pipeline Orchestrator.

Usage:
    python -m pipeline.run --company "TotalEnergies" --ticker TTE --sector Energy --year 2024 \
        --url "https://totalenergies.com/system/files/documents/totalenergies_universal-registration-document-2024_2025_en.zip"
"""
import argparse
import sys
from pathlib import Path

from pipeline.config import DOWNLOADS_DIR
from pipeline.download import download_and_extract
from pipeline.parse import parse_xhtml_sections
from pipeline.classify import classify_sections
from pipeline.index import (
    get_connection,
    get_or_create_company,
    get_or_create_filing,
    insert_sections,
    mark_filing_done,
)


def run_pipeline(company_name: str, ticker: str, sector: str, year: int, url: str, index: str = "CAC40", country: str = "FR"):
    print(f"[1/5] Downloading {url}...")
    output_dir = DOWNLOADS_DIR / ticker / str(year)
    output_dir.mkdir(parents=True, exist_ok=True)

    xhtml_path = download_and_extract(url, str(output_dir))
    if not xhtml_path:
        print("ERROR: No XHTML found in ZIP.")
        sys.exit(1)
    print(f"  -> Extracted: {xhtml_path}")

    print("[2/5] Parsing XHTML sections...")
    with open(xhtml_path, "r", encoding="utf-8") as f:
        xhtml_content = f.read()
    sections = parse_xhtml_sections(xhtml_content)
    print(f"  -> Found {len(sections)} sections")

    print("[3/5] Classifying sections with Claude...")
    sections = classify_sections(sections)
    categories = {}
    for s in sections:
        categories[s["category"]] = categories.get(s["category"], 0) + 1
    print(f"  -> Categories: {categories}")

    print("[4/5] Indexing in PostgreSQL...")
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            company_id = get_or_create_company(cur, company_name, ticker, index, sector, country)
            filing_id = get_or_create_filing(cur, company_id, year, url)

            # Clear existing sections for this filing (re-run safe)
            cur.execute('DELETE FROM "Section" WHERE "filingId" = %s', (filing_id,))

            insert_sections(cur, filing_id, sections)
            mark_filing_done(cur, filing_id)
        conn.commit()
    finally:
        conn.close()
    print(f"  -> Indexed {len(sections)} sections for {company_name} ({year})")

    print("[5/5] Done!")
    return sections


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
```

- [ ] **Step 2: Test with TotalEnergies (real data)**

```bash
cd ~/Developer/Projects/bench
source pipeline/venv/bin/activate
PYTHONPATH=. python -m pipeline.run \
    --company "TotalEnergies" \
    --ticker TTE \
    --sector Energy \
    --year 2024 \
    --url "https://totalenergies.com/system/files/documents/totalenergies_universal-registration-document-2024_2025_en.zip"
```

Expected output:
```
[1/5] Downloading ...
  -> Extracted: data/downloads/TTE/2024/....xhtml
[2/5] Parsing XHTML sections...
  -> Found ~XXX sections
[3/5] Classifying sections with Claude...
  -> Categories: {risk: X, strategy: X, ...}
[4/5] Indexing in PostgreSQL...
  -> Indexed XXX sections for TotalEnergies (2024)
[5/5] Done!
```

- [ ] **Step 3: Verify data in PostgreSQL**

```bash
docker exec -it bench-db-1 psql -U filinglens -d filinglens -c '
  SELECT c.name, f.year, f.status, COUNT(s.id) as sections
  FROM "Company" c
  JOIN "Filing" f ON f."companyId" = c.id
  LEFT JOIN "Section" s ON s."filingId" = f.id
  GROUP BY c.name, f.year, f.status;
'
```

Expected: One row for TotalEnergies 2024 with status "done" and a section count.

- [ ] **Step 4: Test full-text search works**

```bash
docker exec -it bench-db-1 psql -U filinglens -d filinglens -c "
  SELECT heading, category, LEFT(content, 100) as preview
  FROM \"Section\"
  WHERE search_vector @@ plainto_tsquery('french', 'risque climatique')
  LIMIT 5;
"
```

Expected: Sections mentioning climate risk.

- [ ] **Step 5: Commit**

```bash
git add pipeline/run.py
git commit -m "feat: pipeline orchestrator - download, parse, classify, index end-to-end"
```

---

## Task 8: Next.js API Routes

**Files:**
- Create: `src/lib/types.ts`, `src/app/api/companies/route.ts`, `src/app/api/companies/[id]/route.ts`, `src/app/api/search/route.ts`, `src/app/api/qa/route.ts`, `src/app/api/compare/route.ts`, `src/lib/claude.ts`

- [ ] **Step 1: Create shared types**

Create `~/Developer/Projects/bench/src/lib/types.ts`:

```typescript
export type SectionCategory =
  | "risk"
  | "strategy"
  | "governance"
  | "esg"
  | "financial"
  | "other";

export interface SearchResult {
  id: string;
  heading: string;
  category: SectionCategory;
  content: string;
  snippet: string;
  companyName: string;
  companyTicker: string;
  filingYear: number;
  rank: number;
}

export interface CompanyWithFilings {
  id: string;
  name: string;
  ticker: string;
  index: string;
  sector: string;
  filings: {
    id: string;
    year: number;
    status: string;
    sectionCount: number;
  }[];
}
```

- [ ] **Step 2: Create Claude client**

Create `~/Developer/Projects/bench/src/lib/claude.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function askQuestion(
  question: string,
  context: string
): Promise<string> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are an expert financial analyst. Answer the following question based ONLY on the document excerpts provided. Always cite which section your answer comes from. If the information is not in the excerpts, say so.

DOCUMENT EXCERPTS:
${context}

QUESTION: ${question}

Answer in the same language as the question.`,
      },
    ],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}
```

Install the SDK:

```bash
cd ~/Developer/Projects/bench
npm install @anthropic-ai/sdk
```

- [ ] **Step 3: Create companies API route**

Create `~/Developer/Projects/bench/src/app/api/companies/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const companies = await db.company.findMany({
    include: {
      filings: {
        select: {
          id: true,
          year: true,
          status: true,
          _count: { select: { sections: true } },
        },
        orderBy: { year: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const result = companies.map((c) => ({
    id: c.id,
    name: c.name,
    ticker: c.ticker,
    index: c.index,
    sector: c.sector,
    filings: c.filings.map((f) => ({
      id: f.id,
      year: f.year,
      status: f.status,
      sectionCount: f._count.sections,
    })),
  }));

  return NextResponse.json(result);
}
```

- [ ] **Step 4: Create company detail API route**

Create directory and file `~/Developer/Projects/bench/src/app/api/companies/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const company = await db.company.findUnique({
    where: { id },
    include: {
      filings: {
        include: {
          sections: {
            select: {
              id: true,
              heading: true,
              depth: true,
              category: true,
              content: true,
              orderIndex: true,
            },
            orderBy: { orderIndex: "asc" },
          },
        },
        orderBy: { year: "desc" },
      },
    },
  });

  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(company);
}
```

- [ ] **Step 5: Create search API route**

Create `~/Developer/Projects/bench/src/app/api/search/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  const category = request.nextUrl.searchParams.get("category");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20");

  if (!query) {
    return NextResponse.json({ error: "Missing q parameter" }, { status: 400 });
  }

  const categoryFilter = category ? `AND s.category = '${category}'` : "";

  const results = await db.$queryRawUnsafe<
    {
      id: string;
      heading: string;
      category: string;
      content: string;
      companyName: string;
      companyTicker: string;
      filingYear: number;
      rank: number;
    }[]
  >(
    `SELECT
      s.id,
      s.heading,
      s.category,
      s.content,
      c.name as "companyName",
      c.ticker as "companyTicker",
      f.year as "filingYear",
      ts_rank(s.search_vector, plainto_tsquery('french', $1)) as rank
    FROM "Section" s
    JOIN "Filing" f ON f.id = s."filingId"
    JOIN "Company" c ON c.id = f."companyId"
    WHERE s.search_vector @@ plainto_tsquery('french', $1)
    ${categoryFilter}
    ORDER BY rank DESC
    LIMIT $2`,
    query,
    limit
  );

  const searchResults = results.map((r) => ({
    ...r,
    snippet: r.content.substring(0, 300) + (r.content.length > 300 ? "..." : ""),
  }));

  return NextResponse.json(searchResults);
}
```

**IMPORTANT:** The `categoryFilter` uses string interpolation which is safe here because `category` is validated against a known set. But for production, use parameterized queries. This is MVP-acceptable.

- [ ] **Step 6: Create Q&A API route**

Create `~/Developer/Projects/bench/src/app/api/qa/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { askQuestion } from "@/lib/claude";

export async function POST(request: NextRequest) {
  const { question, filingId } = await request.json();

  if (!question || !filingId) {
    return NextResponse.json(
      { error: "Missing question or filingId" },
      { status: 400 }
    );
  }

  // Get relevant sections using FTS
  const relevantSections = await db.$queryRawUnsafe<
    { heading: string; category: string; content: string }[]
  >(
    `SELECT heading, category, content
     FROM "Section"
     WHERE "filingId" = $1
       AND search_vector @@ plainto_tsquery('french', $2)
     ORDER BY ts_rank(search_vector, plainto_tsquery('french', $2)) DESC
     LIMIT 10`,
    filingId,
    question
  );

  // If FTS returns nothing, fall back to all sections of the most likely category
  let context: string;
  if (relevantSections.length === 0) {
    const fallback = await db.section.findMany({
      where: { filingId },
      select: { heading: true, category: true, content: true },
      orderBy: { orderIndex: "asc" },
      take: 15,
    });
    context = fallback
      .map((s) => `### ${s.heading} [${s.category}]\n${s.content}`)
      .join("\n\n---\n\n");
  } else {
    context = relevantSections
      .map((s) => `### ${s.heading} [${s.category}]\n${s.content}`)
      .join("\n\n---\n\n");
  }

  // Trim context to ~50k chars to stay within limits
  const trimmedContext = context.substring(0, 50000);

  const answer = await askQuestion(question, trimmedContext);

  return NextResponse.json({
    answer,
    sourceSections: relevantSections.map((s) => s.heading),
  });
}
```

- [ ] **Step 7: Create compare API route**

Create `~/Developer/Projects/bench/src/app/api/compare/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { filingIds, category } = await request.json();

  if (!filingIds || !Array.isArray(filingIds) || filingIds.length < 2) {
    return NextResponse.json(
      { error: "Need at least 2 filingIds" },
      { status: 400 }
    );
  }

  const results = await Promise.all(
    filingIds.map(async (filingId: string) => {
      const filing = await db.filing.findUnique({
        where: { id: filingId },
        include: {
          company: { select: { name: true, ticker: true } },
          sections: {
            where: category ? { category } : undefined,
            select: {
              id: true,
              heading: true,
              depth: true,
              category: true,
              content: true,
              orderIndex: true,
            },
            orderBy: { orderIndex: "asc" },
          },
        },
      });
      return filing;
    })
  );

  return NextResponse.json(results.filter(Boolean));
}
```

- [ ] **Step 8: Commit**

```bash
git add src/
git commit -m "feat: API routes - companies, search (FTS), Q&A (Claude), compare"
```

---

## Task 9: Frontend — Layout & Dashboard

**Files:**
- Create: `src/app/layout.tsx` (modify), `src/app/page.tsx`, `src/components/layout/sidebar.tsx`, `src/components/company/company-card.tsx`

- [ ] **Step 1: Create sidebar component**

Create `~/Developer/Projects/bench/src/components/layout/sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/search", label: "Recherche", icon: "🔍" },
  { href: "/compare", label: "Comparer", icon: "⚖️" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-muted/30 p-4 flex flex-col gap-2">
      <div className="font-bold text-lg px-3 py-2 mb-4">FilingLens</div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
              pathname === item.href && "bg-accent font-medium"
            )}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Update root layout**

Replace `~/Developer/Projects/bench/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FilingLens — European Filing Intelligence",
  description: "Search, compare and analyze Universal Registration Documents",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Create company card component**

Create `~/Developer/Projects/bench/src/components/company/company-card.tsx`:

```tsx
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CompanyCardProps {
  id: string;
  name: string;
  ticker: string;
  sector: string;
  filings: {
    id: string;
    year: number;
    status: string;
    sectionCount: number;
  }[];
}

export function CompanyCard({ id, name, ticker, sector, filings }: CompanyCardProps) {
  const latestFiling = filings[0];
  const totalSections = filings.reduce((acc, f) => acc + f.sectionCount, 0);

  return (
    <Link href={`/company/${id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{name}</CardTitle>
            <Badge variant="secondary">{ticker}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{sector}</span>
            <span>{filings.length} filing{filings.length > 1 ? "s" : ""}</span>
            <span>{totalSections} sections</span>
          </div>
          {latestFiling && (
            <div className="mt-2 text-xs text-muted-foreground">
              Dernier : {latestFiling.year} — {latestFiling.status === "done" ? "✅ Parsé" : "⏳ En cours"}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 4: Create dashboard page**

Replace `~/Developer/Projects/bench/src/app/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { CompanyCard } from "@/components/company/company-card";
import type { CompanyWithFilings } from "@/lib/types";

export default function DashboardPage() {
  const [companies, setCompanies] = useState<CompanyWithFilings[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data);
        setLoading(false);
      });
  }, []);

  const totalFilings = companies.reduce((acc, c) => acc + c.filings.length, 0);
  const totalSections = companies.reduce(
    (acc, c) => acc + c.filings.reduce((a, f) => a + f.sectionCount, 0),
    0
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
      <p className="text-muted-foreground mb-6">
        {companies.length} sociétés · {totalFilings} filings · {totalSections} sections indexées
      </p>

      {loading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : companies.length === 0 ? (
        <p className="text-muted-foreground">
          Aucune société. Lancez le pipeline pour indexer un DEU.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((company) => (
            <CompanyCard key={company.id} {...company} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify the app starts**

```bash
cd ~/Developer/Projects/bench
npm run dev
```

Visit http://localhost:3000. Expected: Dashboard with company cards (or empty state if pipeline hasn't run yet).

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: dashboard page with company cards and sidebar navigation"
```

---

## Task 10: Frontend — Search Page

**Files:**
- Create: `src/app/search/page.tsx`, `src/components/search/search-bar.tsx`, `src/components/search/search-results.tsx`

- [ ] **Step 1: Create search bar component**

Create `~/Developer/Projects/bench/src/components/search/search-bar.tsx`:

```tsx
"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  loading?: boolean;
}

export function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 max-w-2xl">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher dans tous les DEU... (ex: risque climatique, pricing power)"
        className="flex-1"
      />
      <Button type="submit" disabled={loading}>
        {loading ? "..." : "Rechercher"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Create search results component**

Create `~/Developer/Projects/bench/src/components/search/search-results.tsx`:

```tsx
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SearchResult } from "@/lib/types";

const CATEGORY_COLORS: Record<string, string> = {
  risk: "destructive",
  strategy: "default",
  governance: "secondary",
  esg: "outline",
  financial: "default",
  other: "secondary",
};

interface SearchResultsProps {
  results: SearchResult[];
}

export function SearchResults({ results }: SearchResultsProps) {
  if (results.length === 0) {
    return <p className="text-muted-foreground mt-4">Aucun résultat.</p>;
  }

  return (
    <div className="flex flex-col gap-3 mt-4">
      {results.map((result) => (
        <Link key={result.id} href={`/company/${result.id}`}>
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={CATEGORY_COLORS[result.category] as "default" | "destructive" | "secondary" | "outline"}>
                  {result.category}
                </Badge>
                <span className="text-sm font-medium">
                  {result.companyName} ({result.companyTicker})
                </span>
                <span className="text-xs text-muted-foreground">
                  {result.filingYear}
                </span>
              </div>
              <h3 className="font-medium mb-1">{result.heading}</h3>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {result.snippet}
              </p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create search page**

Create `~/Developer/Projects/bench/src/app/search/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { SearchBar } from "@/components/search/search-bar";
import { SearchResults } from "@/components/search/search-results";
import type { SearchResult } from "@/lib/types";

export default function SearchPage() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (query: string) => {
    setLoading(true);
    setSearched(true);
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setResults(data);
    setLoading(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Recherche</h1>
      <p className="text-muted-foreground mb-6">
        Recherche full-text dans tous les Documents d'Enregistrement Universel indexés.
      </p>
      <SearchBar onSearch={handleSearch} loading={loading} />
      {searched && <SearchResults results={results} />}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: search page with full-text search across all filings"
```

---

## Task 11: Frontend — Company Detail Page with Q&A

**Files:**
- Create: `src/app/company/[id]/page.tsx`, `src/components/company/section-nav.tsx`, `src/components/company/section-content.tsx`, `src/components/company/qa-chat.tsx`

- [ ] **Step 1: Create section nav component**

Create `~/Developer/Projects/bench/src/components/company/section-nav.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SectionNavProps {
  sections: { id: string; heading: string; depth: number; category: string }[];
  activeId: string | null;
  onSelect: (id: string) => void;
  categoryFilter: string | null;
  onCategoryFilter: (category: string | null) => void;
}

const CATEGORIES = ["risk", "strategy", "governance", "esg", "financial", "other"];

export function SectionNav({
  sections,
  activeId,
  onSelect,
  categoryFilter,
  onCategoryFilter,
}: SectionNavProps) {
  const filtered = categoryFilter
    ? sections.filter((s) => s.category === categoryFilter)
    : sections;

  return (
    <div className="w-72 border-r flex flex-col">
      <div className="p-3 border-b flex flex-wrap gap-1">
        <Badge
          variant={categoryFilter === null ? "default" : "outline"}
          className="cursor-pointer text-xs"
          onClick={() => onCategoryFilter(null)}
        >
          Tout
        </Badge>
        {CATEGORIES.map((cat) => (
          <Badge
            key={cat}
            variant={categoryFilter === cat ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => onCategoryFilter(cat)}
          >
            {cat}
          </Badge>
        ))}
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 flex flex-col gap-0.5">
          {filtered.map((section) => (
            <button
              key={section.id}
              onClick={() => onSelect(section.id)}
              className={cn(
                "text-left px-2 py-1.5 rounded text-sm transition-colors hover:bg-accent truncate",
                section.depth === 2 && "pl-6 text-xs",
                section.depth >= 3 && "pl-10 text-xs",
                activeId === section.id && "bg-accent font-medium"
              )}
            >
              {section.heading}
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
```

- [ ] **Step 2: Create section content component**

Create `~/Developer/Projects/bench/src/components/company/section-content.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";

interface SectionContentProps {
  heading: string;
  category: string;
  content: string;
}

export function SectionContent({ heading, category, content }: SectionContentProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xl font-bold">{heading}</h2>
        <Badge variant="secondary">{category}</Badge>
      </div>
      <div className="prose prose-sm max-w-none whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create Q&A chat component**

Create `~/Developer/Projects/bench/src/components/company/qa-chat.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface QAChatProps {
  filingId: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

export function QAChat({ filingId }: QAChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const question = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    const res = await fetch("/api/qa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, filingId }),
    });
    const data = await res.json();

    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: data.answer, sources: data.sourceSections },
    ]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold">Poser une question sur ce DEU</h3>

      <div className="flex flex-col gap-2 max-h-96 overflow-auto">
        {messages.map((msg, i) => (
          <Card key={i} className={msg.role === "user" ? "bg-muted" : ""}>
            <CardContent className="pt-3 pb-3">
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              {msg.sources && msg.sources.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Sources : {msg.sources.join(", ")}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
        {loading && (
          <p className="text-sm text-muted-foreground">Analyse en cours...</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ex: Quels sont les principaux risques liés au climat ?"
          className="flex-1 min-h-[60px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <Button type="submit" disabled={loading}>
          Envoyer
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Create company detail page**

Create `~/Developer/Projects/bench/src/app/company/[id]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SectionNav } from "@/components/company/section-nav";
import { SectionContent } from "@/components/company/section-content";
import { QAChat } from "@/components/company/qa-chat";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Section {
  id: string;
  heading: string;
  depth: number;
  category: string;
  content: string;
  orderIndex: number;
}

interface Filing {
  id: string;
  year: number;
  sections: Section[];
}

interface CompanyDetail {
  id: string;
  name: string;
  ticker: string;
  sector: string;
  filings: Filing[];
}

export default function CompanyPage() {
  const params = useParams();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [activeFilingIndex, setActiveFilingIndex] = useState(0);

  useEffect(() => {
    fetch(`/api/companies/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setCompany(data);
        if (data.filings?.[0]?.sections?.[0]) {
          setActiveSectionId(data.filings[0].sections[0].id);
        }
      });
  }, [params.id]);

  if (!company) return <p className="text-muted-foreground">Chargement...</p>;

  const filing = company.filings[activeFilingIndex];
  if (!filing) return <p>Aucun filing disponible.</p>;

  const activeSection = filing.sections.find((s) => s.id === activeSectionId);

  return (
    <div className="flex flex-col h-full -m-6">
      <div className="p-6 pb-3 border-b">
        <h1 className="text-2xl font-bold">
          {company.name} ({company.ticker})
        </h1>
        <p className="text-muted-foreground">{company.sector}</p>
        {company.filings.length > 1 && (
          <div className="flex gap-2 mt-2">
            {company.filings.map((f, i) => (
              <button
                key={f.id}
                onClick={() => {
                  setActiveFilingIndex(i);
                  setActiveSectionId(f.sections[0]?.id || null);
                }}
                className={`text-sm px-3 py-1 rounded ${
                  i === activeFilingIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {f.year}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <SectionNav
          sections={filing.sections}
          activeId={activeSectionId}
          onSelect={setActiveSectionId}
          categoryFilter={categoryFilter}
          onCategoryFilter={setCategoryFilter}
        />

        <div className="flex-1 overflow-auto p-6">
          <Tabs defaultValue="content">
            <TabsList>
              <TabsTrigger value="content">Contenu</TabsTrigger>
              <TabsTrigger value="qa">Q&A</TabsTrigger>
            </TabsList>
            <TabsContent value="content" className="mt-4">
              {activeSection ? (
                <SectionContent {...activeSection} />
              ) : (
                <p className="text-muted-foreground">
                  Sélectionnez une section.
                </p>
              )}
            </TabsContent>
            <TabsContent value="qa" className="mt-4">
              <QAChat filingId={filing.id} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify company page works**

```bash
npm run dev
```

Visit http://localhost:3000, click on TotalEnergies (if pipeline has been run). Expected: section navigation on the left, content on the right, Q&A tab.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: company detail page with section navigation, content viewer, Q&A chat"
```

---

## Task 12: Frontend — Compare Page

**Files:**
- Create: `src/app/compare/page.tsx`, `src/components/compare/company-selector.tsx`, `src/components/compare/compare-view.tsx`

- [ ] **Step 1: Create company selector component**

Create `~/Developer/Projects/bench/src/components/compare/company-selector.tsx`:

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CompanyWithFilings } from "@/lib/types";

interface CompanySelectorProps {
  companies: CompanyWithFilings[];
  selected: string[]; // filing IDs
  onToggle: (filingId: string) => void;
  onCompare: () => void;
}

export function CompanySelector({
  companies,
  selected,
  onToggle,
  onCompare,
}: CompanySelectorProps) {
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {companies.map((company) =>
          company.filings
            .filter((f) => f.status === "done")
            .map((filing) => {
              const isSelected = selected.includes(filing.id);
              return (
                <Badge
                  key={filing.id}
                  variant={isSelected ? "default" : "outline"}
                  className="cursor-pointer text-sm py-1 px-3"
                  onClick={() => onToggle(filing.id)}
                >
                  {company.ticker} {filing.year}
                </Badge>
              );
            })
        )}
      </div>
      <Button onClick={onCompare} disabled={selected.length < 2}>
        Comparer {selected.length} filings
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Create compare view component**

Create `~/Developer/Projects/bench/src/components/compare/compare-view.tsx`:

```tsx
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface CompareSection {
  id: string;
  heading: string;
  category: string;
  content: string;
}

interface CompareFiling {
  id: string;
  year: number;
  company: { name: string; ticker: string };
  sections: CompareSection[];
}

interface CompareViewProps {
  filings: CompareFiling[];
  category: string;
}

export function CompareView({ filings, category }: CompareViewProps) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${filings.length}, 1fr)` }}>
      {filings.map((filing) => (
        <div key={filing.id} className="border rounded-lg">
          <div className="p-3 border-b bg-muted/30 font-medium">
            {filing.company.name} ({filing.company.ticker}) — {filing.year}
          </div>
          <ScrollArea className="h-[600px]">
            <div className="p-4 flex flex-col gap-4">
              {filing.sections.map((section) => (
                <div key={section.id}>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm">{section.heading}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {section.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-[20]">
                    {section.content}
                  </p>
                </div>
              ))}
              {filing.sections.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aucune section "{category}" trouvée.
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create compare page**

Create `~/Developer/Projects/bench/src/app/compare/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { CompanySelector } from "@/components/compare/company-selector";
import { CompareView } from "@/components/compare/compare-view";
import { Badge } from "@/components/ui/badge";
import type { CompanyWithFilings } from "@/lib/types";

const CATEGORIES = ["risk", "strategy", "governance", "esg", "financial"];

export default function ComparePage() {
  const [companies, setCompanies] = useState<CompanyWithFilings[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [category, setCategory] = useState("risk");
  const [compareData, setCompareData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then(setCompanies);
  }, []);

  const handleToggle = (filingId: string) => {
    setSelected((prev) =>
      prev.includes(filingId)
        ? prev.filter((id) => id !== filingId)
        : [...prev, filingId]
    );
    setCompareData(null);
  };

  const handleCompare = async () => {
    setLoading(true);
    const res = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filingIds: selected, category }),
    });
    const data = await res.json();
    setCompareData(data);
    setLoading(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Comparer</h1>
      <p className="text-muted-foreground mb-6">
        Comparez les sections de plusieurs DEU côte à côte.
      </p>

      <CompanySelector
        companies={companies}
        selected={selected}
        onToggle={handleToggle}
        onCompare={handleCompare}
      />

      <div className="flex gap-2 my-4">
        {CATEGORIES.map((cat) => (
          <Badge
            key={cat}
            variant={category === cat ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => {
              setCategory(cat);
              setCompareData(null);
            }}
          >
            {cat}
          </Badge>
        ))}
      </div>

      {loading && <p className="text-muted-foreground">Chargement...</p>}

      {compareData && (
        <CompareView filings={compareData} category={category} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: compare page - side-by-side comparison of filing sections by category"
```

---

## Task 13: End-to-End Verification

- [ ] **Step 1: Start all services**

```bash
cd ~/Developer/Projects/bench
docker compose up -d
npm run dev
```

- [ ] **Step 2: Run the pipeline on TotalEnergies**

```bash
cd ~/Developer/Projects/bench
source pipeline/venv/bin/activate
PYTHONPATH=. python -m pipeline.run \
    --company "TotalEnergies" \
    --ticker TTE \
    --sector Energy \
    --year 2024 \
    --url "https://totalenergies.com/system/files/documents/totalenergies_universal-registration-document-2024_2025_en.zip"
```

Expected: Pipeline completes, sections indexed in DB.

- [ ] **Step 3: Verify each feature**

1. **Dashboard** (http://localhost:3000): TotalEnergies card visible with section count
2. **Company page** (click TotalEnergies): Section nav on left, content on right, category filters work
3. **Search** (http://localhost:3000/search): Search "climate risk" — returns relevant sections
4. **Q&A** (company page → Q&A tab): Ask "Quels sont les principaux risques climatiques ?" — gets a sourced answer
5. **Compare** (http://localhost:3000/compare): Select TotalEnergies 2024, compare risk sections (only 1 company for now, but UI should render)

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: FilingLens MVP complete - pipeline, search, compare, Q&A"
```

---

## Extension Points (post-MVP)

These are NOT part of this plan, but document where to go next:

1. **Add more companies**: Add ESEF ZIP URLs to `data/companies.json`, run pipeline for each
2. **iXBRL extraction**: Parse `<ix:nonFraction>` and `<ix:nonNumeric>` tags from XHTML for structured financial data
3. **Newsletter/digest**: Cron job that runs pipeline on new DEUs and generates a weekly digest email
4. **Auth + freemium**: Add NextAuth + Stripe for freemium gating
5. **Year-over-year diff**: Compute text diff between same sections across years to highlight changes
