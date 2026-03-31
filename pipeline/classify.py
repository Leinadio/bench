import json
from anthropic import Anthropic
from pipeline.config import ANTHROPIC_API_KEY

VALID_CATEGORIES = {"risk", "strategy", "governance", "esg", "financial", "other"}

CLASSIFY_PROMPT = """You are classifying sections of a European Universal Registration Document.

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
