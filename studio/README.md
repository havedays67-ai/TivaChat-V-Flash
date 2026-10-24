# TivaChat Studio (Next.js + PostgreSQL)

Workspace that produced the 1.0.2 engine fixes, balanced dataset, trained intent model and Android patches.
Version policy: **the app version stays 1.0.1 (build 4)**. No version bump is made here.

## Run locally
```bash
cp .env.example .env   # DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
npm install
npx drizzle-kit push --config=drizzle.config.json
npm run data:generate   # 19,749 balanced samples
npm run model:train     # 10,027,008-parameter int8 model (~5s)
npm run tests:run       # 51 acceptance tests
npm run dev
```

## Pages
- `/` overview · `/engine` live parser + model · `/model` training report
- `/dataset` dataset explorer · `/tests` acceptance suite · `/apps` 122 app aliases
- `/release` download link, signing facts and downloadable patches

## Commands
| script | what it does |
|---|---|
| `data:generate` | rebuilds the deterministic 34-class dataset |
| `model:train` | trains + evaluates + writes `data/tiva_model_1.0.2.bin` (not committed) |
| `tests:run` | runs the 51 acceptance tests and stores results |
| `export:github` | writes `updates/1.0.2/` (patches + report.json + README) |

No secrets are stored in this workspace. The keystore password and GitHub token are never written to the repo.
