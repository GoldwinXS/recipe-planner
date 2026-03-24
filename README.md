# Recipe Planner

A full-stack web application for managing personal recipes, planning meals, and generating shopping lists — with AI-powered recipe generation, meal planning, and nutritional tracking.

**Tech:** Django 5 · React 19 · PostgreSQL 16 · Docker · Material UI v7 · Claude API

---

## Features

### Cookbook
- Create, edit, search, and tag personal recipes
- Import recipes from a URL (scrapes and parses with AI)
- Paste raw text or JSON to import recipes
- Track the source of every recipe (manual, AI-generated, URL import)

### AI Recipe Generation
- Prompt any supported AI model to generate a structured recipe
- Preview before saving — nothing is written to the database until you confirm
- Remix (modify) any existing recipe with a natural language instruction
- Ask the AI to fill in nutritional macros for any recipe's ingredients
- Full provenance tracking: every generated recipe stores the original prompt and provider

### Nutritional Tracking
- Per-recipe macro breakdown: calories, protein, carbs, fat
- Real-time portion scaling — change serving count and macros recalculate instantly
- Shows both per-serving and total macros when scaling above 1 serving
- Personal daily macro goals (calories, protein, carbs, fat) stored in your profile

### Meal Planner
- 7-day × 4-meal-type grid (breakfast, lunch, dinner, snack)
- Week-by-week navigation
- AI-suggested weekly or monthly (4-week) meal plans respecting your cooking days, macro goals, and food safety windows
- Storage guidance: the AI marks each planned meal as `fresh` / `fridge` / `freeze` based on how many days after cooking it will be eaten — frozen meals show a ❄️ badge in the planner
- Meal prep guide: AI generates a day-by-day cooking schedule for your cooking days
- Weekly nutrition summary with progress toward daily goals

### Shopping List
- Auto-generated from the week's meal plan
- Ingredients aggregated and grouped by store aisle category
- Check off items as you shop; clear the list when done

### AI Persistence
- AI generation tasks (recipe generation, meal plan suggestions) continue in the background if you navigate away
- Pulsing indicator in the sidebar shows when a background task is running
- Return to the page to see the result waiting for you

### Multiple AI Providers
- **Claude** (Anthropic) — default, fast and reliable
- **Ollama** — run any local model (Llama, Mistral, Gemma, etc.) with no API costs
- **OpenAI-compatible** — any API that follows the OpenAI chat completions format (OpenAI, Groq, Together AI, etc.)
- **Browser LLM** — run a small model entirely in the browser via WebLLM (no server calls for generation)
- Switch providers at any time from the top bar; your preference is saved locally

### Auth
- Register / login with JWT access + refresh tokens
- Silent token refresh — you stay logged in across sessions
- Demo account with pre-seeded recipes and meal plan for quick exploration

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                          Browser                             │
│             React 19 + Material UI v7 (Vite)                 │
│         dev: :5200   ·   prod: Nginx static server           │
└─────────────────────┬────────────────────────────────────────┘
                      │  HTTPS · JWT Bearer token
                      ▼
┌──────────────────────────────────────────────────────────────┐
│           Django 5 + Django REST Framework 3.15              │
│               dev: runserver :8001  ·  prod: Gunicorn        │
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌────────────┐  ┌────────────┐  │
│  │  users  │  │ recipes │  │ meal_plans │  │  shopping  │  │
│  └─────────┘  └────┬────┘  └────────────┘  └────────────┘  │
│                    │                                         │
│             ┌──────▼──────┐                                  │
│             │  ai_service │──► Claude API (Anthropic SDK)   │
│             │             │──► Ollama (local)                │
│             │             │──► OpenAI-compatible API         │
│             └─────────────┘                                  │
└─────────────────────┬────────────────────────────────────────┘
                      │  psycopg2
                      ▼
┌──────────────────────────────────────────────────────────────┐
│                    PostgreSQL 16                              │
└──────────────────────────────────────────────────────────────┘
```

In production the frontend is built to static files and served by Nginx alongside the API proxy:

```
Client → Nginx :80
              ├── /api/*  →  proxy_pass Gunicorn :8001
              ├── /admin/* → proxy_pass Gunicorn :8001
              └── /*       → serve React SPA (index.html fallback)
```

---

## Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker + Compose)
- An [Anthropic API key](https://console.anthropic.com/) — or configure Ollama / another provider after starting (see [AI Providers](#ai-providers))

### Local development

```bash
git clone <repo-url> recipe-planner
cd recipe-planner

cp .env.example .env
# Edit .env — at minimum set:
#   SECRET_KEY=any-random-string
#   ANTHROPIC_API_KEY=sk-ant-...   (optional if using Ollama or OpenAI-compatible)

docker compose up --build
```

| Service | URL |
|---|---|
| React frontend | http://localhost:5200 |
| Django API | http://localhost:8001/api/ |
| Django admin | http://localhost:8001/admin/ |

### Seed demo data

```bash
docker compose exec backend python manage.py seed
```

Creates a demo user (`demo` / `demopassword123`) with:
- 25 common ingredients with full nutritional data
- 5 starter recipes with calculated macros
- A pre-filled week of meal plan entries
- Daily nutrition goals (2200 kcal, 165g protein)

### Run tests

```bash
docker compose exec backend pytest
```

### Run linting

```bash
docker compose exec backend flake8 apps/
cd frontend && npm run lint
```

---

## AI Providers

The AI provider is configured per-user in the browser (top-bar robot icon) and stored in `localStorage`. The backend reads the provider from each request.

### Claude (default)

Requires `ANTHROPIC_API_KEY` in your `.env`. Uses `claude-3-5-haiku-20241022` for all generation tasks.

### Ollama (local models)

1. Install [Ollama](https://ollama.com) and pull a model: `ollama pull llama3.2`
2. In the app, open AI settings and select **Ollama**
3. Set the URL to `http://host.docker.internal:11434` (from inside Docker) or `http://localhost:11434` (outside Docker)
4. Enter the model name (e.g. `llama3.2`)

Larger models (13B+) produce better structured JSON output. The backend retries without `response_format: json` if the model doesn't support JSON mode.

### OpenAI-compatible

Works with any API following the OpenAI chat completions spec:

| Provider | API base | Notes |
|---|---|---|
| OpenAI | `https://api.openai.com` | GPT-4o, GPT-4o-mini |
| Groq | `https://api.groq.com/openai` | Fast inference, free tier |
| Together AI | `https://api.together.xyz` | Wide model selection |

### Browser LLM (WebLLM)

Runs a quantised model entirely in the browser — no API key or server calls. Uses WebGPU; requires a modern desktop browser. Useful for offline use or privacy. Smaller models may produce inconsistent JSON; the app filters and validates the output.

---

## Production Deployment

### Self-hosting with Docker

The production compose file runs:
- **db** — PostgreSQL 16
- **backend** — Gunicorn with 3 workers + WhiteNoise for Django static files
- **caddy** — serves the built React SPA, proxies `/api/` to Gunicorn, and **automatically obtains and renews a Let's Encrypt SSL certificate** for your domain

```bash
cp .env.production.example .env.production
# Fill in: SECRET_KEY, POSTGRES_PASSWORD, ALLOWED_HOSTS, CSRF_TRUSTED_ORIGINS
# Add ANTHROPIC_API_KEY if using Claude (optional — other providers work too)

docker compose -f docker-compose.prod.yml up --build -d

# First deploy only — seed demo data
docker compose -f docker-compose.prod.yml exec backend python manage.py seed
```

**On your router:** forward ports **80** and **443** to the PC's local IP. Caddy uses port 80 to complete the Let's Encrypt domain verification on first start, then serves everything on 443.

The `caddy_data` Docker volume stores the certificates. Don't delete it or Caddy will re-request certs on the next start (Let's Encrypt has rate limits).

**To change the domain:** edit the first line of `Caddyfile`, rebuild with `docker compose -f docker-compose.prod.yml up --build -d`, and update `ALLOWED_HOSTS` + `CSRF_TRUSTED_ORIGINS` in `.env.production`.

### Migrating to a new host

Because the app is fully containerised, migration is:

```bash
# 1. Export the database on the old host
docker exec recipeplanner-db-1 pg_dump -U recipes_user recipes > backup.sql

# 2. Copy backup.sql and your .env.production to the new host

# 3. Start services on the new host
docker compose -f docker-compose.prod.yml up -d

# 4. Import the database
docker exec -i <new-db-container> psql -U recipes_user recipes < backup.sql
```

---

## Project Structure

```
recipe-planner/
├── backend/
│   ├── config/
│   │   └── settings/
│   │       ├── base.py           # Shared settings
│   │       ├── development.py    # DEBUG=True, relaxed CORS
│   │       └── production.py     # Gunicorn, HTTPS, strict CORS
│   ├── apps/
│   │   ├── users/                # Custom User model, JWT endpoints, demo account
│   │   ├── ingredients/          # Global ingredient catalogue with nutritional data
│   │   ├── recipes/
│   │   │   ├── ai_service.py     # Provider abstraction (Claude / Ollama / OpenAI-compat)
│   │   │   ├── models.py         # Recipe, RecipeIngredient, Tag
│   │   │   ├── serializers.py    # Includes macro calculation + PIECE_WEIGHTS_G lookup
│   │   │   └── views.py          # Generate, save, remix, fill-macros, URL fetch
│   │   ├── meal_plans/           # MealPlan, MealPlanEntry (with storage field), suggest, prep guide
│   │   └── shopping/             # ShoppingListItem, aggregation from meal plan
│   └── requirements/
│       ├── base.txt
│       ├── development.txt       # + pytest, factory-boy, flake8
│       └── production.txt        # + gunicorn, whitenoise
├── frontend/
│   └── src/
│       ├── api/                  # Axios instance + per-resource helpers
│       ├── contexts/             # AuthContext (JWT + refresh), WebLLMContext
│       ├── hooks/                # useAuth, useProviderConfig
│       ├── state/
│       │   └── generationStore.js  # Module-level pub/sub store for AI task persistence
│       ├── components/
│       │   ├── layout/           # AppShell, NavLinks (with AI activity indicators)
│       │   ├── meal_planner/     # PlannerGrid, WeekOverview, PrepGuide, AddToPlanModal
│       │   ├── recipes/          # Recipe cards, macro display
│       │   ├── shopping/         # Shopping list grouped by category
│       │   └── ai/               # AIProviderDialog, provider config forms
│       └── pages/
│           ├── Dashboard.jsx
│           ├── Cookbook.jsx
│           ├── RecipeDetail.jsx  # With portion scaling and dual per-serving / total macros
│           ├── RecipeForm.jsx
│           ├── ClaudeGenerator.jsx  # Generate / URL import / paste text / paste JSON
│           ├── MealPlanner.jsx   # Week + month AI suggest, prep guide, storage badges
│           ├── ShoppingList.jsx  # Grouped by aisle, checkable
│           └── Account.jsx       # Profile, macro goals, cooking days, AI settings
├── docker-compose.yml            # Development
├── docker-compose.prod.yml       # Production (Gunicorn + Nginx)
├── .github/workflows/ci.yml      # Parallel lint + test on every PR
└── .env.example
```

---

## API Reference

All endpoints require `Authorization: Bearer <access_token>` except auth routes.

### Authentication

```
POST /api/auth/register/     { username, email, password }
POST /api/auth/login/        { username, password } → { access, refresh, user }
POST /api/auth/refresh/      { refresh } → { access }
GET  /api/auth/me/           Current user profile
POST /api/auth/demo/         Create ephemeral demo account → { access, refresh, user }
```

### Recipes

```
GET    /api/recipes/                  List recipes (?search=&tag=&page=)
POST   /api/recipes/                  Create recipe (manual)
GET    /api/recipes/{id}/             Recipe detail with macros
PUT    /api/recipes/{id}/             Full update
PATCH  /api/recipes/{id}/             Partial update
DELETE /api/recipes/{id}/             Delete

POST /api/recipes/generate/           AI generate (preview only, not saved)
POST /api/recipes/save-generated/     Save a previewed recipe to the cookbook
POST /api/recipes/fetch-url/          Fetch + parse recipe from a URL
POST /api/recipes/{id}/fill-macros/   Ask AI to fill nutritional data for ingredients
POST /api/recipes/{id}/remix/         Modify a recipe with a natural language instruction

GET  /api/recipes/tags/               All tags belonging to the user
GET  /api/ai/ollama-models/           Query the configured Ollama instance for available models
```

### Meal Plans

```
GET  /api/meal-plans/                           List all weeks with plans
GET  /api/meal-plans/{week_start}/              Get (or create) a week's plan (YYYY-MM-DD Monday)
POST /api/meal-plans/{week_start}/entries/      Add an entry { recipe, day, meal_type, servings, storage }
DEL  /api/meal-plans/{week_start}/entries/{id}/ Remove entry

GET  /api/meal-plans/{week_start}/stats/        Per-day macro totals + weekly averages vs goals
POST /api/meal-plans/suggest/                   AI-suggest a week or month of meals
POST /api/meal-plans/{week_start}/prep-guide/   AI meal-prep schedule for cooking days
```

**Suggest payload:**
```json
{
  "provider": "claude",
  "preferences": "high protein, no red meat",
  "days": 7
}
```
`days` can be 7 (one week) or 28 (four weeks / full month). The response includes a `week` field (0–3) and a `storage` field (`fresh` / `fridge` / `freeze`) on each suggestion.

### Shopping

```
GET  /api/shopping/{week_start}/                 Aggregated shopping list for the week
POST /api/shopping/{week_start}/items/{id}/toggle/ Toggle checked state
DEL  /api/shopping/{week_start}/                 Clear the entire list
```

### Ingredients

```
GET /api/ingredients/     Global catalogue (?search=)
```

---

## Environment Variables

### Development (`.env`)

| Variable | Description |
|---|---|
| `SECRET_KEY` | Django secret key (any random string in dev) |
| `DEBUG` | `true` |
| `DATABASE_URL` | `postgres://recipes_user:devpassword@db:5432/recipes` |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1,0.0.0.0` |
| `POSTGRES_PASSWORD` | Password for the `db` container |
| `ANTHROPIC_API_KEY` | Anthropic API key — optional if using another provider |
| `DJANGO_SETTINGS_MODULE` | `config.settings.development` |

### Production (`.env.production`)

Same variables plus:

| Variable | Description |
|---|---|
| `DEBUG` | `false` |
| `SECRET_KEY` | Generate with `python -c "import secrets; print(secrets.token_hex(50))"` |
| `ALLOWED_HOSTS` | Your domain, e.g. `bitstream.mywire.org` |
| `CSRF_TRUSTED_ORIGINS` | Same domain with scheme: `https://bitstream.mywire.org` |
| `DJANGO_SETTINGS_MODULE` | `config.settings.production` |

The frontend reads `VITE_API_BASE_URL` at build time — leave it unset for the production compose file (Caddy handles the proxy internally).

---

## CI/CD

GitHub Actions runs on every push and pull request to `main`:

- **backend** — starts a PostgreSQL 16 service container, runs `flake8` (PEP8) and `pytest`
- **frontend** — runs `eslint` and a Vite production build

Both jobs run in parallel and must pass before a PR can merge.

---

## Design Decisions

**AI provider abstraction (`ai_service.py`)**
All AI calls go through a single module that routes to Claude, Ollama, or any OpenAI-compatible endpoint. Each provider raises the same two exception types (`AIParseError`, `AIUnavailableError`), so views never need to know which provider is active. The `_call_openai_compat` function automatically retries without `response_format: json_object` if the model returns null content — which happens when a model doesn't support JSON mode.

**AI generation state (`generationStore.js`)**
Generation tasks use a module-level pub/sub store that lives outside React components. This means async handlers keep writing to the store even after the user navigates away, and the component re-reads the state on remount. The result is always waiting when you return to the page. A pulsing amber dot in the sidebar indicates background activity.

**Meal plan storage types (`fresh` / `fridge` / `freeze`)**
When the AI plans meals it reasons about how far each leftover will be eaten from its cooking day and assigns a storage type. Entries marked `freeze` render with a different colour and ❄️ icon in the planner grid as a reminder to freeze that batch on cooking day.

**Synchronous AI calls (no task queue)**
Claude Haiku responds in 2–4 seconds — within HTTP timeout limits. Celery + Redis would add significant operational complexity with no user-visible benefit at this scale. The persistence store makes long-running calls feel async anyway.

**`PIECE_WEIGHTS_G` for macro calculation**
Ingredients measured in "pieces" (eggs, onions, bell peppers, garlic) have no gram conversion in the standard unit table. A name-based lookup table maps common piece-unit ingredients to their average weight in grams, so macros for those ingredients aren't silently skipped.

**`localStorage` for JWT**
Pragmatic choice for a portfolio project. The more secure alternative — refresh token in an `HttpOnly` cookie — would require same-origin setup or careful CORS cookie handling. The trade-off is documented rather than ignored.

**Split settings (`base` / `development` / `production`)**
Prevents accidental `DEBUG=True` in production and makes environment-specific configuration explicit. `base.py` is the single source of truth for shared settings.

**Demo account**
A seeded demo user with realistic recipes, a full week of meal plan entries, and macro goals lets visitors explore every feature immediately — no sign-up required. Demo accounts are flagged with `is_demo_temp=True`, which the UI uses to show a persistent banner and disable write operations.
