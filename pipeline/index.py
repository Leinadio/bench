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
    cursor.execute('SELECT id FROM "Filing" WHERE "companyId" = %s AND year = %s', (company_id, year))
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
            (section_id, filing_id, section["heading"], section["depth"], section["category"], section["content"], section["order_index"], datetime.now()),
        )

def mark_filing_done(cursor, filing_id: str):
    cursor.execute('UPDATE "Filing" SET status = %s, "parsedAt" = %s WHERE id = %s', ("done", datetime.now(), filing_id))
