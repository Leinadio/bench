# Signals — Analyse croisée DEU × Actualités

## Objectif

Croiser les résumés DEU existants avec les actualités récentes pour identifier des catalyseurs positifs/négatifs pour chaque entreprise. Analyse à la demande (pas de cache, pas de cron).

## Architecture

### Data flow

```
Clic utilisateur → GET /api/signals/[companyId]
  → Fetch Google News RSS pour "{nom} {ticker}"
  → Parse RSS → extraire titres + liens + dates (10-15 articles max)
  → Récupérer CompanySummary depuis PostgreSQL (résumés DEU)
  → Appel Claude (claude-sonnet-4-6) :
      - Input : articles récents + résumés DEU par thème + scores
      - Output : JSON structuré de signaux
  → Retourner les signaux au client
```

### Types

```ts
interface Signal {
  type: "positive" | "negative" | "neutral";
  title: string;
  summary: string;
  theme: "risk" | "strategy" | "governance" | "esg" | "financial" | null;
  sourceUrl: string;
}

// API Response
interface SignalsResponse {
  signals: Signal[];
  companyName: string;
  analyzedAt: string; // ISO date
  articleCount: number;
}
```

### Source d'actualités : Google News RSS

URL : `https://news.google.com/rss/search?q={encodeURIComponent(query)}&hl=fr&gl=FR&ceid=FR:fr`

- Gratuit, pas d'API key
- Retourne XML RSS avec titre, lien, date de publication
- Requête : `"{nom_entreprise}" OR "{ticker}"` pour chaque entreprise
- Parser le XML avec un simple regex ou DOMParser côté serveur

### Prompt Claude

Envoyer à Claude :
1. Les 10-15 titres d'articles récents avec leurs dates
2. Les résumés DEU par thème (risk, strategy, governance, esg, financial) avec scores
3. Demander d'identifier 3-8 signaux en français, format JSON strict

Claude doit pour chaque signal :
- Classifier en positif/négatif/neutre
- Relier à un thème DEU si pertinent
- Écrire un résumé court expliquant le lien actu ↔ DEU
- Inclure l'URL source de l'article

### Coût estimé

~$0.03-0.08 par analyse (un seul appel Claude avec contexte modéré).

## Pages et composants

### Page entreprise `/company/[id]`

Nouveau bloc `SignalsPanel` inséré entre les fiches thématiques et le Q&A.
- État initial : bouton "Analyser les signaux récents"
- État loading : skeleton/spinner
- État résultat : liste de `SignalCard` + disclaimer
- Pas de chargement automatique (l'utilisateur décide)

### Page signaux `/signals`

Dashboard regroupant toutes les entreprises indexées.
- Liste des entreprises avec bouton "Analyser" pour chacune
- Résultats affichés inline après analyse
- Pas de chargement automatique global (trop d'appels API)

### Composant `SignalCard`

Réutilisé sur les deux pages :
- Pastille colorée (vert positif, rouge négatif, gris neutre)
- Titre du signal en gras
- Résumé (lien actu ↔ DEU)
- Badge du thème DEU concerné (si applicable)
- Lien "source" vers l'article original

### Sidebar

Ajout d'un lien "Signaux" avec icône `Zap` de lucide-react.

### Disclaimer

Texte fixe : *"Analyse croisée DEU × actualités. Ne constitue pas un conseil d'investissement."*

## Fichiers

### À créer
- `src/app/api/signals/[companyId]/route.ts` — endpoint GET
- `src/lib/news.ts` — fetch + parse Google News RSS
- `src/components/company/signals-panel.tsx` — panneau signaux (page entreprise)
- `src/components/company/signal-card.tsx` — carte signal individuelle
- `src/app/signals/page.tsx` — page dashboard signaux

### À modifier
- `src/components/layout/sidebar.tsx` — ajout lien "Signaux"
- `src/app/company/[id]/page.tsx` — intégration SignalsPanel
- `src/lib/types.ts` — ajout types Signal/SignalsResponse
