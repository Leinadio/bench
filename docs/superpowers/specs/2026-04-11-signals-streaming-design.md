# Signals Streaming — Chargement à la demande avec streaming

## Objectif

Remplacer l'approche actuelle (chargement complet en une fois après que le pipeline Python ait pré-rempli la base) par un chargement **à la demande** quand l'utilisateur visite la page Signaux d'une entreprise. Pour rendre l'attente acceptable, on combine deux techniques :

1. **Affichage instantané** des signaux déjà en base (cache).
2. **Streaming** des nouveaux signaux générés par Claude, affichés un par un au fur et à mesure qu'ils arrivent.

Un cache de **30 minutes** évite de relancer des analyses inutiles si les signaux sont encore frais.

## Motivation

L'approche "cron qui rafraîchit toutes les entreprises périodiquement" ne passe pas à l'échelle :
- Coût Anthropic linéaire avec le nombre d'entreprises (potentiellement S&P 500 + CAC 40 + autres = milliers d'entreprises).
- Plan Vercel Hobby = 1 cron/jour max, function timeout = 10 s.
- Travail effectué pour des entreprises que personne ne consulte.

L'approche "à la demande" rend le coût proportionnel au **trafic réel** plutôt qu'au catalogue. Le streaming masque la latence de l'appel à Claude (~5-7 s) en montrant le contenu progressivement.

## Architecture

### Vue d'ensemble du flux

```
Utilisateur arrive sur /company/[id]/signals
  ↓
Frontend ouvre fetch() vers GET /api/signals/[companyId]/stream
  ↓
Serveur démarre une réponse en streaming (Content-Type: application/x-ndjson)
  ↓
1. Lit les signaux existants depuis la BDD → envoie {"type":"cached", "signals":[...]}
  ↓
2. Lit company.lastSignalRefresh
   ├─ Si < 30 min → envoie {"type":"done"} et ferme le stream
   └─ Sinon → continue
  ↓
3. Fetch Google News RSS (titre + url + date, max 8 articles)
  ↓
4. Filtre les articles dont l'URL est déjà en base
   ├─ Si aucun nouvel article → met à jour lastSignalRefresh, envoie {"type":"done"} et ferme
   └─ Sinon → continue
  ↓
5. Appel Claude Haiku 4.5 en mode streaming
  ↓
6. Parser incremental détecte chaque objet JSON complet
  ↓
7. Pour chaque signal complet :
     - INSERT en base
     - envoie {"type":"signal", "signal":{...}}
  ↓
8. Met à jour company.lastSignalRefresh
  ↓
9. Envoie {"type":"done"} et ferme le stream
```

### Format du stream : NDJSON

Le serveur émet du **NDJSON** (Newline Delimited JSON). Chaque ligne est un objet JSON indépendant terminé par `\n`. Le frontend lit ligne par ligne au fur et à mesure.

Quatre types d'événements :

```json
{"type":"cached","signals":[<Signal>, <Signal>, ...]}
{"type":"signal","signal":<Signal>}
{"type":"done"}
{"type":"error","message":"..."}
```

L'événement `cached` est toujours envoyé en premier (même si la liste est vide). L'événement `done` est toujours envoyé à la fin, sauf si une erreur fatale interrompt le stream — dans ce cas, c'est `error`.

### Modèle de données

Ajout d'un seul champ sur le modèle `Company` :

```prisma
model Company {
  // ... champs existants
  lastSignalRefresh DateTime?  // null = jamais rafraîchi
}
```

Sémantique : timestamp de la dernière **tentative** de rafraîchissement (réussie ou non), pas du dernier signal généré. C'est ce qui détermine si on doit relancer ou pas.

Migration Prisma : ajout d'une colonne nullable, pas de backfill nécessaire (les entreprises sans valeur seront rafraîchies au premier passage).

### Endpoint API

**Nouvelle route** : `GET /api/signals/[companyId]/stream`

Runtime : **Node.js** (pas Edge), parce qu'on a besoin de Prisma + adapter-pg avec une connexion stable à PostgreSQL pendant toute la durée du stream.

Configuration Next.js :
```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```

Réponse :
- `Content-Type: application/x-ndjson`
- `Cache-Control: no-store`
- Body : `ReadableStream` qui émet du NDJSON

### Le parser de streaming JSON

Claude génère un JSON array de signaux token par token. On a besoin d'un petit parser qui détecte chaque objet `{...}` complet dans le buffer accumulé et l'extrait.

Algorithme :
1. Maintenir un buffer texte qui accumule tous les deltas reçus de Claude.
2. Maintenir un compteur de profondeur de braces et un état "à l'intérieur d'une string ?".
3. Parcourir chaque nouveau caractère :
   - Si on est dans une string : ignorer `{` et `}`, gérer les escapes (`\"`, `\\`).
   - Sinon : `{` incrémente la profondeur, `}` la décrémente.
4. Quand la profondeur retombe à 0 après être passée à 1+, on a un objet complet → on extrait la sous-chaîne, on `JSON.parse()`, et on émet le signal.
5. On garde le reste du buffer pour la suite.

Ce parser sera dans un module utilitaire `src/lib/streaming-json.ts` (~50-80 lignes), réutilisable et testable indépendamment.

### Logique de la route en pseudo-code

```ts
export async function GET(req, { params }) {
  const { companyId } = await params;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        // 1. Cached signals
        const company = await db.company.findUnique({ where: { id: companyId } });
        if (!company) {
          send({ type: "error", message: "Company not found" });
          return controller.close();
        }

        const existing = await db.signal.findMany({
          where: { companyId },
          orderBy: { analyzedAt: "desc" },
        });
        send({ type: "cached", signals: existing.map(toSignalDTO) });

        // 2. Cache freshness check
        const CACHE_TTL_MS = 30 * 60 * 1000;
        if (company.lastSignalRefresh && Date.now() - company.lastSignalRefresh.getTime() < CACHE_TTL_MS) {
          send({ type: "done" });
          return controller.close();
        }

        // 3. Fetch RSS
        const articles = await fetchGoogleNews(company.name, company.ticker);
        const existingUrls = new Set(existing.map((s) => s.sourceUrl));
        const newArticles = articles.filter((a) => !existingUrls.has(a.url));

        if (newArticles.length === 0) {
          await db.company.update({ where: { id: companyId }, data: { lastSignalRefresh: new Date() } });
          send({ type: "done" });
          return controller.close();
        }

        // 4. Stream from Claude
        const scoresContext = await getScoresContext(companyId);
        const claudeStream = await anthropic.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4096,
          messages: [{ role: "user", content: buildPrompt(company, newArticles, scoresContext) }],
        });

        const parser = createJsonObjectStreamParser();
        for await (const event of claudeStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            const completedObjects = parser.push(event.delta.text);
            for (const obj of completedObjects) {
              const signal = normalizeSignal(obj);
              const stored = await db.signal.create({ data: { companyId, ...signal, analyzedAt: new Date() } });
              send({ type: "signal", signal: toSignalDTO(stored) });
            }
          }
        }

        // 5. Mark refresh
        await db.company.update({ where: { id: companyId }, data: { lastSignalRefresh: new Date() } });
        send({ type: "done" });
        controller.close();
      } catch (err) {
        send({ type: "error", message: err.message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  });
}
```

### Frontend : consommation du stream

Le composant `SignalsPanel` est modifié pour utiliser `fetch()` + `ReadableStream` au lieu de `fetch().json()`.

Logique :
1. Au mount : démarrer un fetch vers `/api/signals/[companyId]/stream`.
2. Lire `response.body.getReader()` et accumuler les chunks dans un buffer texte.
3. À chaque chunk reçu, splitter par `\n` et parser chaque ligne complète comme JSON.
4. Pour chaque événement :
   - `cached` → `setSignals(event.signals)` (affichage instantané, masquer le spinner principal)
   - `signal` → `setSignals((prev) => [event.signal, ...prev])` (nouveau signal apparaît en haut)
   - `done` → masquer l'indicateur "rafraîchissement en cours"
   - `error` → afficher un message d'erreur discret
5. Affichage : un petit indicateur "Recherche de nouveaux signaux..." reste visible entre `cached` et `done` quand un refresh est en cours.

L'animation `animate-fade-in-up` existante sur les `SignalCard` rend l'apparition progressive visuellement agréable.

### Source d'actualités

On garde la même source que le script Python : **Google News RSS**.

URL : `https://news.google.com/rss/search?q={query}&hl=fr&gl=FR&ceid=FR:fr`
Query : `"{nom_entreprise}" OR "{ticker}"`, URL-encodée.
Parsing : regex simple sur le XML (comme dans le script Python actuel), ou un parser XML léger. On extrait `<title>`, `<link>`, `<pubDate>`, max 8 items.

Module : `src/lib/news.ts`.

### Prompt Claude

Identique en esprit au prompt Python, juste reformulé pour TypeScript :

```
{nom_entreprise} ({ticker}, {secteur}). Scores DEU: {scores}.

Nouvelles actualités:
1. {titre 1} | {url 1}
2. {titre 2} | {url 2}
...

Pour chaque actualité, génère un signal JSON. IMPORTANT: retourne un JSON array valide, sans trailing commas.
Champs: type ("positive"/"negative"/"neutral"), title, summary (1 phrase), justification (1 phrase: pourquoi haussier/baissier pour le cours), theme ("risk"/"strategy"/null), sourceUrl, date (JJ/MM/AAAA), relatedRisks (liste courte).

JSON array uniquement:
```

Modèle : `claude-haiku-4-5-20251001`.
`max_tokens` : 4096.

## Gestion d'erreurs

| Cas | Comportement |
|---|---|
| Company introuvable | `{"type":"error", "message":"Company not found"}` puis fermeture |
| Erreur fetch Google News | Logger côté serveur, envoyer `done` (pas d'erreur fatale, le cache a déjà été envoyé) |
| Erreur parsing RSS | Idem (skip silencieusement, on a déjà envoyé le cache) |
| Erreur appel Claude | `{"type":"error", "message":"AI analysis failed"}`, ne pas mettre à jour `lastSignalRefresh` |
| Erreur parsing JSON Claude | Logger, skip l'objet malformé, continuer le parsing |
| Erreur INSERT en base | Logger, skip ce signal, continuer le stream |
| Client se déconnecte | Le `for await` détecte la fermeture, on arrête proprement |

Principe : **ne jamais bloquer l'utilisateur sur une erreur en arrière-plan**. Le cache est déjà affiché, le pire qui puisse arriver est qu'aucun nouveau signal n'apparaisse.

## Coûts estimés

Modèle : Claude Haiku 4.5 — input 1 $/MTok, output 5 $/MTok.

Coût par appel (analyse de 8 articles pour une entreprise) :
- Input ~700 tokens × 1 $/MTok = 0,0007 $
- Output ~1400 tokens × 5 $/MTok = 0,007 $
- **Total ≈ 0,0077 $ ≈ 0,007 €**

Estimations selon le trafic (hypothèse : 7 entreprises consultées par session) :

| Scénario | Utilisateurs/jour | Coût mensuel |
|---|---|---|
| Tests internes (5) | 5 | ~3,70 € |
| MVP (10) | 10 | ~6 € |
| Petit lancement (50) | 50 | ~26 € |
| Croissance (100) | 100 | ~59 € |
| Bonne traction (500) | 500 | ~220 € |
| Succès (1000) | 1000 | ~295 € |

Le cache de 30 min et le filtrage des articles déjà analysés évitent ~60-80 % des appels Claude inutiles.

## Fichiers

### À créer

- `src/app/api/signals/[companyId]/stream/route.ts` — endpoint streaming
- `src/lib/news.ts` — fetch + parse Google News RSS
- `src/lib/streaming-json.ts` — parser incremental d'objets JSON
- `src/lib/signals-prompt.ts` — construction du prompt Claude
- `prisma/migrations/<timestamp>_add_company_last_signal_refresh/migration.sql` — migration

### À modifier

- `prisma/schema.prisma` — ajout du champ `lastSignalRefresh` sur `Company`
- `src/components/company/signals-panel.tsx` — consommation du stream NDJSON
- `src/app/api/signals/[companyId]/route.ts` — pas modifié (la route GET classique reste utile pour un éventuel rendu SSR)

### À supprimer

- `pipeline/refresh_signals.py` — la logique vit désormais dans la route API

## Hors scope

Choses **explicitement non incluses** dans ce spec, à traiter plus tard si besoin :

- **Rate limiting** par utilisateur (à ajouter quand l'authentification sera en place).
- **Prompt caching** Anthropic (optimisation pour quand les coûts deviendront significatifs).
- **Tiered refresh** (catégoriser les entreprises hot/standard/cold).
- **Préchargement** depuis la fiche entreprise principale (peut être ajouté facilement plus tard).
- **Tests automatisés** (à ajouter dans une itération suivante, ce spec se concentre sur l'architecture).
- **Backfill manuel** d'entreprises en masse (le script Python est supprimé, si besoin un nouveau script TypeScript pourra appeler la même fonction de refresh).

## Questions ouvertes

Aucune. Toutes les décisions clés ont été tranchées :
- TTL cache : **30 minutes**
- Format stream : **NDJSON**
- Source actus : **Google News RSS** (inchangé)
- Modèle : **Claude Haiku 4.5** (inchangé)
- Sort du script Python : **suppression**
- Runtime API : **Node.js**
