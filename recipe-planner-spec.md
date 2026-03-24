# Recipe Manager & Meal Planner — Project Spec

## Overview

A full-stack web application for managing personal recipes, planning weekly meals,
and generating a shopping list. Integrates with the Claude API to generate recipes
and save them to a personal cookbook. Built to demonstrate production-quality
Django + React + PostgreSQL + Docker + GCP + CI/CD.

**Portfolio goal:** Live deployed URL, clean GitHub repo, README with architecture
diagram. The Claude integration is the main differentiator — not just "uses AI"
but structured output, error handling, and proper persistence.

---

## Tech Stack

| Layer           | Technology                                     |
|-----------------|------------------------------------------------|
| Backend         | Django 5.x + Django REST Framework            |
| Database        | PostgreSQL                                     |
| Auth            | JWT via `djangorestframework-simplejwt`        |
| AI              | Anthropic Python SDK — `claude-haiku-4-5`      |
| Frontend        | React 19 + Material UI v7 + Axios             |
| Containerisation| Docker + docker-compose                        |
| CI/CD           | GitHub Actions (lint + tests on PR)            |
| Deployment      | GCP Cloud Run + Cloud SQL (PostgreSQL)         |

---

## Data Models

### Ingredient
- `id`, `name` (unique), `category` (enum: protein / carb / vegetable / dairy / spice / other)
- `default_unit` (string: g / ml / cup / tsp / tbsp / piece)
- `calories_per_100g`, `protein_g`, `carbs_g`, `fat_g` (all nullable)

### Recipe
- `id`, `user` (FK), `title`, `description`
- `servings` (int), `prep_time_minutes`, `cook_time_minutes`
- `instructions` (text — newline-separated steps)
- `source` (enum: manual / claude)
- `claude_prompt` (nullable — the original prompt that generated the recipe)
- `tags` (M2M → Tag)
- `created_at`, `updated_at`

### RecipeIngredient (junction)
- `recipe` (FK), `ingredient` (FK)
- `quantity` (decimal), `unit` (string)
- `notes` (optional — "finely chopped", "room temperature")

### Tag
- `id`, `name`, `slug`

### MealPlan
- `id`, `user` (FK), `week_start` (date — always Monday)

### MealPlanEntry
- `meal_plan` (FK), `recipe` (FK)
- `day` (0–6, Mon–Sun)
- `meal_type` (enum: breakfast / lunch / dinner / snack)
- `servings` (decimal)

### ShoppingListItem
- `user` (FK), `ingredient` (FK)
- `quantity` (decimal), `unit` (string)
- `checked` (bool, default false)
- `week_start` (date)

---

## API Endpoints

### Auth
```
POST   /api/auth/register/
POST   /api/auth/login/          → returns JWT access + refresh tokens
POST   /api/auth/refresh/
```

### Recipes
```
GET    /api/recipes/             → list; supports ?search=&tag=
POST   /api/recipes/             → create
GET    /api/recipes/{id}/
PUT    /api/recipes/{id}/
PATCH  /api/recipes/{id}/
DELETE /api/recipes/{id}/
```

### Claude Recipe Generation
```
POST   /api/recipes/generate/         → body: { prompt } → returns recipe JSON (NOT saved)
POST   /api/recipes/save-generated/   → body: generated recipe JSON → saves to DB
```

### Ingredients
```
GET    /api/ingredients/         → searchable; supports ?search=
POST   /api/ingredients/
```

### Tags
```
GET    /api/tags/
```

### Meal Plans
```
GET    /api/meal-plans/                          → list current + recent weeks
GET    /api/meal-plans/{week_start}/             → specific week (YYYY-MM-DD)
POST   /api/meal-plans/{week_start}/entries/     → add entry
DELETE /api/meal-plans/{week_start}/entries/{id}/
```

### Shopping List
```
GET    /api/shopping-list/{week_start}/          → aggregated from meal plan entries
POST   /api/shopping-list/{week_start}/check/{id}/ → toggle item checked
DELETE /api/shopping-list/{week_start}/          → clear list
```

---

## Claude Integration Detail

**Endpoint:** `POST /api/recipes/generate/`

**Model:** `claude-haiku-4-5-20251001` (fast and cheap for recipe generation)

**System prompt:**
```
You are a professional chef. When given a recipe request, respond ONLY with valid
JSON in this exact structure — no preamble, no markdown, no explanation:

{
  "title": "string",
  "description": "string",
  "servings": 4,
  "prep_time_minutes": 10,
  "cook_time_minutes": 20,
  "instructions": "Step 1: ...\nStep 2: ...",
  "ingredients": [
    { "name": "string", "quantity": 1.5, "unit": "cup", "notes": "optional" }
  ],
  "tags": ["string"]
}
```

**Flow:**
1. User types a prompt ("high-protein pasta under 600 calories")
2. Frontend POSTs to `/api/recipes/generate/`
3. Django calls Claude, parses and validates the JSON response
4. Returns structured recipe to frontend — **not yet in DB**
5. User previews, can tweak title/servings
6. User clicks "Save to Cookbook" → POST to `/api/recipes/save-generated/`
7. Backend creates `Recipe` + `RecipeIngredient` rows (creating `Ingredient`
   records as needed, matching by name case-insensitively)
8. Saved recipe has `source="claude"` and `claude_prompt=<original prompt>`

**Error handling:**
- If Claude returns malformed JSON, return a 422 with a user-friendly message
- If the Anthropic API is unavailable, return a 503

---

## Frontend Screens

### 1. Dashboard
- This week's meal plan (compact 7-day preview strip)
- Recently added/generated recipes (last 5)
- "Generate a Recipe" CTA

### 2. Cookbook (Recipe List)
- Card grid — title, tags, prep+cook time, source badge (Claude / manual)
- Search bar + tag filter chips
- "Add Recipe" and "Generate with Claude" buttons

### 3. Recipe Detail
- Title, description, tags, times, source badge
- **Portion scaling control** — number input or +/– buttons to change servings;
  all ingredient quantities recalculate in real time (simple ratio math)
- Ingredient list with scaled quantities and units
- Step-by-step instructions
- "Add to Meal Plan" button → opens a small modal: pick day + meal type + servings
- Edit / Delete for recipe owner

### 4. Recipe Create / Edit
- Fields: title, description, servings, prep time, cook time, tags, instructions
- Dynamic ingredient rows: search existing ingredients (autocomplete) or type a
  new name to create one on the fly; each row has quantity + unit + optional notes
- Save button

### 5. Claude Recipe Generator
- Freetext prompt input with character counter
- Loading/streaming state while Claude generates
- Preview panel: rendered title, ingredient list, instructions
- "Save to Cookbook" button
- The saved recipe card links back from the cookbook with a small "Generated by Claude" badge

### 6. Meal Planner
- 7-column × 4-row grid (Mon–Sun × breakfast/lunch/dinner/snack)
- Each cell shows the assigned recipe name or an "+" button
- Clicking "+" opens a recipe search modal
- Clicking an assigned recipe shows a popover: view recipe / remove from plan
- "Generate Shopping List" button at the top

### 7. Shopping List
- Auto-generated from current week's meal plan entries
- Ingredients grouped by category (Produce, Protein, Dairy, Pantry, etc.)
- Quantities aggregated across all entries (same ingredient summed)
- Checkbox each item; checked items move to bottom / grey out
- "Clear list" button

---

## Implementation Phases

### Phase 1 — Backend Foundation
- Django project + app structure + docker-compose (Django + PostgreSQL)
- Custom User model + JWT auth endpoints
- Ingredient, Recipe, RecipeIngredient, Tag models
- DRF serializers + viewsets for recipes and ingredients
- Basic tests for CRUD endpoints

### Phase 2 — Claude Integration
- Install `anthropic` SDK, add `ANTHROPIC_API_KEY` to env
- `generate/` endpoint: call Claude, parse + validate JSON, return to client
- `save-generated/` endpoint: persist recipe + ingredients
- Unit tests mocking the Anthropic client

### Phase 3 — Meal Planning & Shopping List
- MealPlan, MealPlanEntry models + endpoints
- Shopping list aggregation logic (sum quantities per ingredient per week)
- ShoppingListItem persistence + check/uncheck endpoint

### Phase 4 — Frontend
- Vite + React + MUI setup, Axios instance with JWT interceptor
- Auth pages (login / register)
- Cookbook page + Recipe detail with portion scaling
- Recipe create/edit form with dynamic ingredient rows
- Claude generator page
- Meal planner grid
- Shopping list page

### Phase 5 — Polish & Deployment
- GitHub Actions: run `flake8` + `pytest` on every PR
- Multi-stage Dockerfile for production Django (gunicorn)
- GCP Cloud Run + Cloud SQL deployment
- Seed script: ~20 common ingredients + 5 starter recipes
- Demo account with pre-populated data (read-only or rate-limited)
- README with architecture diagram, local setup instructions, and live URL

---

## Local Development Setup (target)

```bash
git clone <repo>
cp .env.example .env          # fill in ANTHROPIC_API_KEY + DB creds
docker-compose up --build     # starts Django + PostgreSQL
# Django runs on :8000, React dev server on :5173
```

---

## Environment Variables

```
# Django
SECRET_KEY=
DEBUG=true
DATABASE_URL=postgres://user:pass@db:5432/recipes
ALLOWED_HOSTS=localhost,127.0.0.1

# Anthropic
ANTHROPIC_API_KEY=

# Frontend (Vite)
VITE_API_BASE_URL=http://localhost:8000
```

---

## Portfolio Notes for the README
- Emphasise: Django REST Framework, React, PostgreSQL, Docker, GCP, GitHub Actions, Claude API
- The Claude integration is the differentiator — structured JSON output,
  graceful error handling, recipe saved with provenance tracking
- The portion scaling widget is a visible, interactive frontend feature
- Shopping list aggregation demonstrates non-trivial data logic
- Keep commit history clean and meaningful
