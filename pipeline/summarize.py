import json
from anthropic import Anthropic
from pipeline.config import ANTHROPIC_API_KEY

VALID_THEMES = {"risk", "strategy", "governance", "esg", "financial"}

THEME_LABELS = {
    "risk": "Facteurs de risque",
    "strategy": "Stratégie et objectifs",
    "governance": "Gouvernance",
    "esg": "ESG et développement durable",
    "financial": "Données financières",
}

THEME_PROMPT = """Tu es un analyste financier expert. Tu simplifies un Document d'Enregistrement Universel (DEU) pour un investisseur qui n'a pas le temps de lire 700 pages.

Voici les sections du DEU de {company_name} classifiées dans le thème "{theme_label}".

SECTIONS:
{sections_text}

Génère un JSON avec cette structure exacte :
{{
  "score": <int 1-5, où 1=critique/très faible et 5=excellent/très solide>,
  "scoreJustification": "<1-2 phrases expliquant le score>",
  "summary": "<résumé du thème en 3 phrases max, clair et accessible>",
  "bulletPoints": ["<point clé 1>", "<point clé 2>", ..., "<point clé N>"]
}}

Règles :
- 5 à 10 bullet points maximum
- Chaque bullet point fait 1 phrase, claire et concrète
- Le résumé doit être compréhensible par quelqu'un qui ne connaît pas l'entreprise
- Le score doit être honnête : 2/5 est un résultat valide
- Écris en français

Retourne UNIQUEMENT le JSON, rien d'autre."""

GLOBAL_PROMPT = """Tu es un analyste financier expert. Voici les fiches thématiques simplifiées du DEU de {company_name} :

{themes_text}

Génère un JSON résumant l'ensemble :
{{
  "score": <int 1-5, score global de l'entreprise>,
  "scoreJustification": "<1-2 phrases justifiant le score global>",
  "summary": "<résumé global en 3 phrases : forces, faiblesses, perspective>",
  "bulletPoints": ["<les 3 points les plus importants à retenir>"]
}}

Règles :
- Exactement 3 bullet points (les plus importants)
- Le résumé doit permettre de comprendre l'entreprise en 10 secondes
- Écris en français

Retourne UNIQUEMENT le JSON, rien d'autre."""


def get_client() -> Anthropic:
    return Anthropic(api_key=ANTHROPIC_API_KEY)


def generate_theme_summary(theme: str, sections: list[dict], company_name: str) -> dict:
    client = get_client()
    sections_text = "\n\n---\n\n".join(
        f"### {s['heading']}\n{s['content'][:2000]}"
        for s in sections
    )
    theme_label = THEME_LABELS.get(theme, theme)
    prompt = THEME_PROMPT.format(
        company_name=company_name,
        theme_label=theme_label,
        sections_text=sections_text[:50000],
    )
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()
    data = json.loads(raw)
    data["score"] = max(1, min(5, int(data.get("score", 3))))
    data["theme"] = theme
    return data


def generate_global_summary(theme_summaries: list[dict], company_name: str) -> dict:
    client = get_client()
    themes_text = "\n\n".join(
        f"**{THEME_LABELS.get(s['theme'], s['theme'])}** (score: {s['score']}/5)\n"
        f"Résumé : {s['summary']}\n"
        f"Points clés : {', '.join(s['bulletPoints'][:5])}"
        for s in theme_summaries
    )
    prompt = GLOBAL_PROMPT.format(company_name=company_name, themes_text=themes_text)
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()
    data = json.loads(raw)
    data["score"] = max(1, min(5, int(data.get("score", 3))))
    data["theme"] = "global"
    return data


def generate_all_summaries(sections_by_theme: dict[str, list[dict]], company_name: str) -> list[dict]:
    summaries = []
    for theme in VALID_THEMES:
        theme_sections = sections_by_theme.get(theme, [])
        if not theme_sections:
            continue
        print(f"    Generating {theme} summary ({len(theme_sections)} sections)...")
        summary = generate_theme_summary(theme, theme_sections, company_name)
        summaries.append(summary)
    if summaries:
        print(f"    Generating global summary...")
        global_summary = generate_global_summary(summaries, company_name)
        summaries.append(global_summary)
    return summaries
