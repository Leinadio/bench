# FilingLens V1 — Design Spec

## Vision

FilingLens simplifie les Documents d'Enregistrement Universel (DEU) des sociétés cotées européennes pour que l'investisseur n'ait jamais à lire un PDF de 700 pages. Le produit présente les informations clés sous forme de fiches thématiques avec scores visuels et bullet points générés par l'IA.

**En une phrase :** "Je lis le DEU pour toi et je te dis ce qui compte."

## Utilisateurs cibles

- Investisseur retail français qui fait du stock-picking (10-50k€ en bourse)
- Investisseur semi-pro / indépendant qui gère un portefeuille significatif

Les deux veulent comprendre une entreprise sans lire 700 pages.

## Scope V1

- 5-10 entreprises du CAC 40 pour valider
- Uniquement la simplification du DEU (pas de croisement actualité — V2)
- DEU en français

## Hors scope (V2+)

- Pipeline actualités et croisement news × DEU
- Page comparaison cross-entreprise
- Recherche full-text
- Auth et freemium

---

## Architecture

### 3 systèmes

**Système A : Pipeline DEU (existant, à enrichir)**
Parse le XHTML ESEF → extrait les sections → classifie → indexe dans Supabase → **NOUVEAU : génère les fiches simplifiées et scores par thème**

**Système B : Frontend (refonte du MVP)**
Page entreprise en 2 niveaux : snapshot (scores + résumé) puis fiches thématiques dépliables avec les bullet points et la source DEU.

**Système C : Q&A (existant)**
L'utilisateur pose une question sur le DEU, Claude répond avec les sources.

### Flux de données

```
DEU XHTML → Pipeline parsing → Sections classifiées → Supabase
                                       ↓
                              Pipeline génération IA
                                       ↓
                        Fiches + Scores + Résumé → Supabase
                                                      ↓
                                                   Frontend ← Utilisateur
```

---

## Modèle de données

### Tables existantes (inchangées)

- `Company` — id, name, ticker, index, sector, country
- `Filing` — id, companyId, year, sourceUrl, status
- `Section` — id, filingId, heading, depth, category, content, orderIndex, search_vector

### Nouvelle table

**`CompanySummary`** — Fiches simplifiées générées par l'IA

| Champ | Type | Description |
|---|---|---|
| id | cuid | PK |
| filingId | string | FK → Filing |
| companyId | string | FK → Company |
| theme | string | risk / strategy / governance / esg / financial / global |
| score | int | 1-5 (1=critique, 5=excellent) |
| scoreJustification | string | Pourquoi ce score, 1-2 phrases |
| summary | string | Résumé du thème en 3 phrases max |
| bulletPoints | json | Array de strings — les 5-10 points clés simplifiés |
| createdAt | datetime | |

Pour chaque Filing, on génère 6 CompanySummary : un par thème (risk, strategy, governance, esg, financial) + un "global" qui résume l'ensemble.

---

## Génération des fiches (Pipeline IA)

### Déclenchement

Nouvelle étape à la fin du pipeline existant, après l'indexation des sections.

### Process

Pour chaque thème (risk, strategy, governance, esg, financial) :

1. Récupérer toutes les sections classifiées dans ce thème
2. Envoyer à Claude avec un prompt structuré
3. Recevoir un JSON : score, justification, summary, bulletPoints
4. Insérer dans `CompanySummary`

### Output attendu par thème

```json
{
  "theme": "risk",
  "score": 2,
  "scoreJustification": "Exposition élevée aux risques climatiques et réglementaires, avec une dépendance forte aux hydrocarbures.",
  "summary": "TotalEnergies identifie 32 facteurs de risque majeurs, dominés par le risque climatique et la transition énergétique.",
  "bulletPoints": [
    "Risque climatique : exposition aux régulations carbone et à la taxe environnementale en UE",
    "Risque géopolitique : opérations dans des zones instables (Mozambique, Russie, Libye)",
    "Risque de transition : baisse potentielle de la demande en hydrocarbures post-2030",
    "Risque cyber : menaces sur les infrastructures industrielles critiques",
    "Risque juridique : litiges climatiques en cours dans plusieurs juridictions"
  ]
}
```

### Résumé global

Un 6ème appel prend les 5 fiches et produit :
- Un score global (moyenne pondérée ou jugement IA)
- Un résumé en 3 phrases de l'entreprise
- Les 3 points les plus importants à retenir

### Coût

5+1 appels Claude par entreprise. ~$0.05/entreprise. One-shot par DEU, pas récurrent.

---

## Pages

### Page Dashboard (/)

Liste des entreprises suivies. Pour chaque entreprise, une carte affichant :
- Nom + ticker + secteur
- 5 pastilles de score colorées (🔴🟡🟢) en ligne
- Résumé global en 1 phrase (première phrase du summary global)

Clic sur une carte → page entreprise.

### Page Entreprise (/company/[id])

**En haut — Snapshot**
- Nom, ticker, secteur
- 5 scores en ligne avec label et couleur :
  - 1-2 = 🔴 rouge (critique/faible)
  - 3 = 🟡 jaune (modéré)
  - 4-5 = 🟢 vert (solide/excellent)
- Résumé global en 3 phrases

**En dessous — 5 fiches thématiques**

Chaque fiche est une carte dépliable :
- **Fermée** : titre du thème + score + première ligne du résumé
- **Ouverte** : 
  - Score avec justification
  - Bullet points simplifiés
  - Résumé du thème en 3 phrases
  - Section "Source DEU" repliable avec les sections brutes originales (pour vérifier)

**En bas — Q&A**

Input pour poser une question libre sur le DEU. Claude répond en citant les sections sources. (Fonctionnalité existante, à conserver.)

### Pages retirées

- ~~Recherche full-text~~ → V2
- ~~Comparaison~~ → V2
- ~~Fil d'actualité~~ → V2

---

## Stack technique

- **Frontend** : Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui
- **Base de données** : Supabase (PostgreSQL)
- **ORM** : Prisma
- **Pipeline** : Python (BeautifulSoup, anthropic SDK, psycopg2)
- **IA** : Claude API (claude-sonnet-4-6) pour classification, génération de fiches, Q&A
- **Hébergement** : Vercel (frontend) + Supabase (DB)

---

## Entreprises V1

Commencer avec 5 entreprises diversifiées du CAC 40 :

1. TotalEnergies (Energy) — déjà indexé
2. LVMH (Luxury)
3. Sanofi (Healthcare)
4. Schneider Electric (Industrials)
5. BNP Paribas (Banking)

Ajouter 5 autres après validation : L'Oréal, Air Liquide, Safran, Orange, Danone.
