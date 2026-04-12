# Perspective Qualitative — Synthèse directionnelle par entreprise

## Objectif

Ajouter un onglet **"Perspective"** dans la navigation entreprise (à côté de "Analyse" et "Signaux") qui présente une synthèse qualitative du biais directionnel de l'entreprise à court terme. La perspective croise les signaux récents avec les résumés DEU pour produire une opinion structurée que l'utilisateur peut lire en 30 secondes.

## Motivation

Les signaux individuels sont utiles mais nécessitent un travail mental pour en tirer une conclusion d'ensemble. L'utilisateur doit actuellement lire 10-15 cartes de signaux, se souvenir des scores DEU, et faire la synthèse lui-même. La perspective automatise ce croisement et donne un avis structuré avec son raisonnement, ses risques clés et ses catalyseurs.

Ce n'est **pas une prédiction de cours** — c'est une opinion qualitative basée sur l'information disponible, présentée honnêtement avec son niveau de conviction.

## Contenu de la page

La page Perspective contient 4 blocs + des métriques.

### Bloc 1 : Verdict

Un en-tête visuellement marquant avec :
- **Biais directionnel** : un des 5 niveaux — "Fortement haussier", "Prudemment haussier", "Neutre", "Prudemment baissier", "Fortement baissier"
- **Score de conviction** : "Faible", "Moyenne", "Forte" — basé sur la quantité et la cohérence des signaux (beaucoup de signaux dans la même direction = forte conviction ; signaux contradictoires ou peu nombreux = faible)

Code couleur du biais :
- Fortement haussier / Prudemment haussier → vert (emerald)
- Neutre → gris
- Prudemment baissier / Fortement baissier → rouge

### Bloc 2 : Synthèse

Un paragraphe de 3-5 phrases généré par Claude qui explique **pourquoi** ce biais. La synthèse doit :
- Croiser les signaux récents avec les constats du DEU (pas juste résumer les signaux)
- Faire des liens explicites quand un signal confirme ou contredit un risque/opportunité identifié dans le DEU
- Rester factuel et nuancé, pas de langage promotionnel ou alarmiste
- Mentionner les incertitudes quand elles existent

### Bloc 3 : Risques clés

Liste de 2-4 risques principaux extraits du croisement signaux baissiers + DEU risque. Chaque entrée a :
- Un **titre** court (2-5 mots)
- Une **description** (1 phrase) qui explique le risque et pourquoi il est pertinent maintenant

### Bloc 4 : Catalyseurs potentiels

Même format que les risques, pour les éléments positifs. 2-4 catalyseurs identifiés dans les signaux haussiers + DEU stratégie. Chaque entrée a un titre et une description.

### Métriques

En bas de page, les données factuelles qui ont alimenté l'analyse :
- Ratio de signaux : "X haussiers / Y baissiers / Z neutres"
- Scores DEU : "Risque X/5, Stratégie Y/5"
- Nombre total de signaux analysés
- Date de dernière génération de la perspective

## Architecture

### Déclenchement et cache

Comportement identique au pattern des signaux :
1. L'utilisateur clique sur l'onglet "Perspective"
2. Le composant fait un `fetch` vers `GET /api/perspective/[companyId]`
3. Le serveur vérifie si une perspective existe en base et si elle a **moins de 2 heures** (TTL)
4. Si oui → renvoie la perspective en JSON immédiatement (~200ms)
5. Si non → récupère les signaux et résumés DEU, appelle Claude, stocke le résultat, renvoie le JSON

**Pas de streaming** : la perspective est un résultat atomique. Le composant affiche un skeleton pendant le chargement (~5-8 secondes en cold cache), puis la perspective apparaît d'un coup.

### Endpoint API

**Route** : `GET /api/perspective/[companyId]`

Runtime : Node.js (pas Edge), même raison que les signaux (Prisma + adapter-pg).

Réponse : JSON classique (pas NDJSON — pas de streaming).

```ts
// Réponse
interface PerspectiveResponse {
  perspective: {
    bias: "fortement_haussier" | "prudemment_haussier" | "neutre" | "prudemment_baissier" | "fortement_baissier";
    conviction: "faible" | "moyenne" | "forte";
    summary: string;
    risks: { title: string; description: string }[];
    catalysts: { title: string; description: string }[];
    metrics: {
      signalsBullish: number;
      signalsBearish: number;
      signalsNeutral: number;
      riskScore: number | null;
      strategyScore: number | null;
      totalSignals: number;
    };
    generatedAt: string; // ISO date
  } | null;
  status: "cached" | "generated" | "insufficient_data" | "error";
  message?: string; // pour les cas insufficient_data et error
}
```

### Logique de la route

```
GET /api/perspective/[companyId]
  ↓
1. Lire Company (404 si introuvable)
  ↓
2. Lire la Perspective existante en base
   ├─ Si elle a < 2h → renvoyer directement (status: "cached")
   └─ Sinon → continuer
  ↓
3. Lire les Signal de l'entreprise (les 30 plus récents par analyzedAt desc, pour
   ne pas envoyer des mois d'historique à Claude)
   ├─ Si < 3 signaux → renvoyer null (status: "insufficient_data",
   │   message: "Pas assez de signaux pour générer une perspective")
   └─ Sinon → continuer
  ↓
4. Lire les CompanySummary (résumés DEU) avec scores
  ↓
5. Construire le prompt et appeler Claude (Haiku en dev, Sonnet en prod)
  ↓
6. Parser le JSON retourné, valider les champs
  ↓
7. Upsert la Perspective en base (remplace l'ancienne si elle existe)
  ↓
8. Mettre à jour Company.lastPerspectiveRefresh
  ↓
9. Renvoyer la perspective (status: "generated")
```

### Modèle Claude

- **Dev/MVP** : `claude-haiku-4-5-20251001`
- **Production** : `claude-sonnet-4-6`

Le modèle est défini dans une constante au début du fichier de route, facile à changer :
```ts
const PERSPECTIVE_MODEL = process.env.PERSPECTIVE_MODEL || "claude-haiku-4-5-20251001";
```

### Prompt Claude

Le prompt reçoit :
- Nom, ticker, secteur de l'entreprise
- Scores DEU (risque et stratégie)
- Résumés DEU par thème (les paragraphes de `CompanySummary`)
- Liste complète des signaux récents avec type, titre, résumé, justification, thème

Consignes dans le prompt :
- Croiser les signaux avec le DEU, pas juste résumer les signaux
- Faire des liens explicites quand un signal confirme ou contredit un constat du DEU
- Si les signaux sont contradictoires ou peu nombreux (< 5), conviction = "faible"
- Si aucun signal clair ne domine, biais = "neutre" avec explication honnête
- Produire un JSON structuré sans markdown, sans trailing commas

Format de sortie attendu :
```json
{
  "bias": "prudemment_baissier",
  "conviction": "moyenne",
  "summary": "Sur les 30 derniers jours...",
  "risks": [
    { "title": "Pression réglementaire", "description": "..." },
    { "title": "Risque réputationnel", "description": "..." }
  ],
  "catalysts": [
    { "title": "Contrat nucléaire EDF", "description": "..." },
    { "title": "Plafonnement carburants", "description": "..." }
  ]
}
```

### Modèle de données

Nouvelle table `Perspective` :

```prisma
model Perspective {
  id        String @id @default(cuid())
  companyId String @unique  // une seule perspective par entreprise (la dernière)
  company   Company @relation(fields: [companyId], references: [id])

  bias       String   // fortement_haussier, prudemment_haussier, neutre, prudemment_baissier, fortement_baissier
  conviction String   // faible, moyenne, forte
  summary    String   // paragraphe de synthèse
  risks      Json     // { title: string, description: string }[]
  catalysts  Json     // { title: string, description: string }[]
  metrics    Json     // { signalsBullish, signalsBearish, signalsNeutral, riskScore, strategyScore, totalSignals }

  generatedAt DateTime @default(now())
}
```

`companyId` est `@unique` car on ne garde que la dernière perspective par entreprise. Un `upsert` remplace l'ancienne à chaque régénération.

Ajout sur la table `Company` :
```prisma
perspective  Perspective?
lastPerspectiveRefresh DateTime?
```

La relation `perspective Perspective?` est nécessaire côté Company car Prisma exige les deux côtés de la relation. Le `?` reflète que la perspective peut ne pas encore exister.

### Coûts estimés

**Par appel (Haiku)** : ~2500 tokens input × $1/MTok + ~1500 tokens output × $5/MTok ≈ **0.01 €**

**Par appel (Sonnet)** : ~2500 tokens input × $3/MTok + ~1500 tokens output × $15/MTok ≈ **0.03 €**

Avec le TTL de 2h, un utilisateur actif déclenche au maximum **12 perspectives/jour** par entreprise. En pratique, bien moins (les gens ne restent pas 12h sur le site).

Estimations de trafic (en plus des coûts des signaux) :

| Scénario | Utilisateurs/jour | Coût mensuel Perspective (Haiku) | Coût mensuel Perspective (Sonnet) |
|---|---|---|---|
| MVP (10) | 10 | ~2 € | ~6 € |
| Petit lancement (50) | 50 | ~8 € | ~25 € |
| Croissance (100) | 100 | ~15 € | ~50 € |
| Succès (1000) | 1000 | ~80 € | ~250 € |

## Gestion d'erreurs

| Cas | Comportement |
|---|---|
| Entreprise introuvable | JSON `{ status: "error", message: "Company not found" }` avec HTTP 404 |
| Moins de 3 signaux en base | JSON `{ perspective: null, status: "insufficient_data", message: "Pas assez de signaux..." }` |
| Pas de résumés DEU | La perspective se base uniquement sur les signaux. Les scores DEU sont `null` dans les métriques. |
| Erreur appel Claude | JSON `{ status: "error", message: "Impossible de générer la perspective" }` avec HTTP 500. Ne pas mettre à jour `lastPerspectiveRefresh`. |
| JSON Claude malformé | Logger côté serveur, renvoyer error. Ne pas stocker de perspective invalide. |

## Pages et composants

### Page `/company/[id]/perspective`

Nouveau fichier `src/app/company/[id]/perspective/page.tsx`. Composant client qui :
1. Fait un fetch vers `/api/perspective/[companyId]`
2. Affiche un skeleton pendant le chargement
3. Affiche la perspective une fois reçue, ou un message adapté ("pas assez de données", "erreur")

### Composant `PerspectivePanel`

Composant `src/components/company/perspective-panel.tsx` qui reçoit les données et affiche les 4 blocs + métriques. Réutilise les composants UI existants (Badge, Card, etc.).

### Navigation

Ajout d'un 3e lien dans la navigation du layout entreprise (`src/app/company/[id]/layout.tsx`) :
```
Analyse | Signaux | Perspective
```
Icône : `TrendingUp` de lucide-react.

## Fichiers

### À créer

- `src/app/api/perspective/[companyId]/route.ts` — endpoint GET
- `src/app/company/[id]/perspective/page.tsx` — page Perspective
- `src/components/company/perspective-panel.tsx` — composant d'affichage
- `src/lib/perspective-prompt.ts` — construction du prompt Claude
- `prisma/migrations/<timestamp>_add_perspective/migration.sql` — migration

### À modifier

- `prisma/schema.prisma` — ajout du modèle Perspective + relation Company + champ lastPerspectiveRefresh
- `src/app/company/[id]/layout.tsx` — ajout du lien "Perspective" dans la navigation
- `src/lib/types.ts` — ajout des types Perspective/PerspectiveResponse

## Hors scope

- **Historique des perspectives** — on ne garde que la dernière, pas de journal d'évolution
- **Comparaison entre entreprises** — chaque perspective est indépendante, pas de ranking global
- **Notifications** — pas d'alerte quand le biais change, c'est du pull uniquement
- **Backtesting** — on ne compare pas les perspectives passées avec l'évolution réelle du cours
- **Streaming** — la réponse est renvoyée d'un bloc, pas en streaming
- **Tests automatisés** — pas de framework de test dans le projet

## Questions ouvertes

Aucune. Toutes les décisions ont été prises :
- Placement : onglet dédié "Perspective"
- Contenu : verdict + synthèse + risques + catalyseurs + métriques
- Déclenchement : automatique au chargement
- Modèle : Haiku (dev) / Sonnet (prod) via constante
- TTL : 2 heures
- Streaming : non, réponse d'un bloc
- Stockage : table Perspective avec upsert (une seule par entreprise)
