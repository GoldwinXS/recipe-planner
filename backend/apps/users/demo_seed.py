"""
Utility to seed a user with demo recipes and a sensible week meal plan.

Used by:
  - management/commands/seed.py  (for the persistent demo account)
  - users/views.py DemoLoginView (for ephemeral temp accounts)
"""

from datetime import date, timedelta
from decimal import Decimal

from django.utils.text import slugify

from apps.ingredients.models import Ingredient
from apps.meal_plans.models import MealPlan, MealPlanEntry
from apps.recipes.models import Recipe, RecipeIngredient, Tag


INGREDIENTS = [
    # name, category, default_unit, calories_per_100g, protein_g, carbs_g, fat_g
    ("Chicken Breast",  "protein",   "g",     165, 31,   0,    3.6),
    ("Ground Beef",     "protein",   "g",     250, 26,   0,   15.0),
    ("Salmon Fillet",   "protein",   "g",     208, 20,   0,   13.0),
    ("Eggs",            "protein",   "piece", 155, 13,   1.1, 11.0),
    ("Greek Yogurt",    "dairy",     "g",      59, 10,   3.6,  0.4),
    ("Cheddar Cheese",  "dairy",     "g",     402, 25,   1.3, 33.0),
    ("Whole Milk",      "dairy",     "ml",     61,  3.2, 4.8,  3.3),
    ("Butter",          "dairy",     "tbsp",  717,  0.9, 0.1, 81.0),
    ("Brown Rice",      "carb",      "g",     216,  5,  45,    1.8),
    ("Pasta",           "carb",      "g",     371, 13,  75,    1.5),
    ("Bread Flour",     "carb",      "cup",   364, 12,  76,    1.0),
    ("Potatoes",        "carb",      "g",      77,  2,  17,    0.1),
    ("Sweet Potato",    "carb",      "g",      86,  1.6,20,    0.1),
    ("Oats",            "carb",      "cup",   389, 17,  66,    7.0),
    ("Broccoli",        "vegetable", "g",      34,  2.8, 7,    0.4),
    ("Spinach",         "vegetable", "g",      23,  2.9, 3.6,  0.4),
    ("Cherry Tomatoes", "vegetable", "g",      18,  0.9, 3.9,  0.2),
    ("Garlic",          "vegetable", "piece", 149,  6.4,33,    0.5),
    ("Onion",           "vegetable", "piece",  40,  1.1, 9.3,  0.1),
    ("Bell Pepper",     "vegetable", "piece",  31,  1,   6,    0.3),
    ("Olive Oil",       "other",     "tbsp",  884,  0,   0,  100.0),
    ("Salt",            "spice",     "tsp",     0,  0,   0,    0.0),
    ("Black Pepper",    "spice",     "tsp",   251, 10,  64,    3.3),
    ("Cumin",           "spice",     "tsp",   375, 18,  44,   22.0),
    ("Paprika",         "spice",     "tsp",   282, 14,  54,   13.0),
]

STARTER_RECIPES = [
    {
        "title": "Garlic Butter Chicken",
        "description": "Juicy pan-seared chicken breasts in a rich garlic butter sauce. Ready in 25 minutes.",
        "servings": 4,
        "prep_time_minutes": 5,
        "cook_time_minutes": 20,
        "instructions": (
            "Step 1: Pat chicken breasts dry with paper towels and season generously with salt and pepper.\n"
            "Step 2: Heat olive oil in a large skillet over medium-high heat until shimmering.\n"
            "Step 3: Add chicken and cook undisturbed for 6-7 minutes until golden brown, then flip.\n"
            "Step 4: Add butter and minced garlic to the pan. Cook 5-6 more minutes, basting frequently.\n"
            "Step 5: Check internal temperature reaches 165°F (74°C). Rest for 5 minutes before serving."
        ),
        "tags": ["dinner", "high-protein", "quick"],
        "ingredients": [
            ("Chicken Breast", "700", "g",    ""),
            ("Butter",         "2",   "tbsp", ""),
            ("Garlic",         "4",   "piece","minced"),
            ("Olive Oil",      "1",   "tbsp", ""),
            ("Salt",           "1",   "tsp",  ""),
            ("Black Pepper",   "0.5", "tsp",  "freshly ground"),
        ],
    },
    {
        "title": "Salmon & Brown Rice Bowl",
        "description": "A nutritious bowl with flaky baked salmon, fluffy brown rice, and roasted broccoli.",
        "servings": 2,
        "prep_time_minutes": 10,
        "cook_time_minutes": 25,
        "instructions": (
            "Step 1: Preheat oven to 400°F (200°C). Cook brown rice according to package instructions.\n"
            "Step 2: Toss broccoli florets with olive oil, salt, and pepper. Spread on a baking sheet.\n"
            "Step 3: Place salmon fillets on the same sheet. Season with salt, pepper, and paprika.\n"
            "Step 4: Roast for 18-20 minutes until salmon flakes easily and broccoli is tender.\n"
            "Step 5: Divide rice between bowls, top with salmon and broccoli. Drizzle with olive oil."
        ),
        "tags": ["dinner", "healthy", "meal-prep"],
        "ingredients": [
            ("Salmon Fillet",  "300", "g",    "skin-on"),
            ("Brown Rice",     "200", "g",    "uncooked"),
            ("Broccoli",       "300", "g",    "cut into florets"),
            ("Olive Oil",      "2",   "tbsp", ""),
            ("Salt",           "1",   "tsp",  ""),
            ("Black Pepper",   "0.5", "tsp",  ""),
            ("Paprika",        "0.5", "tsp",  "smoked"),
        ],
    },
    {
        "title": "Vegetable Stir-Fry with Rice",
        "description": "A colourful, quick stir-fry packed with bell peppers, broccoli, and crispy tofu.",
        "servings": 3,
        "prep_time_minutes": 15,
        "cook_time_minutes": 15,
        "instructions": (
            "Step 1: Cook brown rice according to package instructions. Keep warm.\n"
            "Step 2: Heat olive oil in a wok or large skillet over high heat.\n"
            "Step 3: Add garlic and cook for 30 seconds until fragrant.\n"
            "Step 4: Add onion and bell pepper. Stir-fry for 3 minutes.\n"
            "Step 5: Add broccoli and cook 3-4 more minutes until tender-crisp.\n"
            "Step 6: Season with salt, pepper, and cumin. Serve over rice."
        ),
        "tags": ["dinner", "vegetarian", "quick"],
        "ingredients": [
            ("Brown Rice",   "250", "g",    "uncooked"),
            ("Broccoli",     "250", "g",    "cut into florets"),
            ("Bell Pepper",  "2",   "piece","sliced"),
            ("Onion",        "1",   "piece","sliced"),
            ("Garlic",       "3",   "piece","minced"),
            ("Olive Oil",    "2",   "tbsp", ""),
            ("Cumin",        "1",   "tsp",  ""),
            ("Salt",         "1",   "tsp",  ""),
            ("Black Pepper", "0.5", "tsp",  ""),
        ],
    },
    {
        "title": "Greek Yogurt Protein Bowl",
        "description": "High-protein breakfast bowl with creamy Greek yogurt and a soft-boiled egg.",
        "servings": 1,
        "prep_time_minutes": 5,
        "cook_time_minutes": 10,
        "instructions": (
            "Step 1: Bring a small pot of water to a boil. Gently lower in the egg and cook for 7 minutes.\n"
            "Step 2: Transfer egg to ice water for 2 minutes, then peel and halve.\n"
            "Step 3: Spoon Greek yogurt into a bowl.\n"
            "Step 4: Halve the cherry tomatoes and arrange around the yogurt.\n"
            "Step 5: Place the halved egg on top. Season with salt and black pepper. Drizzle with olive oil."
        ),
        "tags": ["breakfast", "high-protein", "quick"],
        "ingredients": [
            ("Greek Yogurt",    "200",  "g",    "full-fat"),
            ("Eggs",            "1",    "piece",""),
            ("Cherry Tomatoes", "80",   "g",    ""),
            ("Olive Oil",       "1",    "tbsp", ""),
            ("Salt",            "0.25", "tsp",  ""),
            ("Black Pepper",    "0.25", "tsp",  ""),
        ],
    },
    {
        "title": "Baked Potato with Toppings",
        "description": "Fluffy baked potato loaded with cheese. A hearty side or main.",
        "servings": 2,
        "prep_time_minutes": 5,
        "cook_time_minutes": 60,
        "instructions": (
            "Step 1: Preheat oven to 425°F (220°C).\n"
            "Step 2: Scrub potatoes clean and prick all over with a fork.\n"
            "Step 3: Rub with olive oil and sprinkle with salt.\n"
            "Step 4: Place directly on the oven rack and bake for 50-60 minutes until skin is crispy.\n"
            "Step 5: Cut a cross in the top, squeeze the sides to open, and top with cheddar cheese."
        ),
        "tags": ["dinner", "vegetarian", "comfort-food"],
        "ingredients": [
            ("Potatoes",       "500",  "g",    "large baking potatoes"),
            ("Cheddar Cheese", "60",   "g",    "grated"),
            ("Olive Oil",      "1",    "tbsp", ""),
            ("Salt",           "0.5",  "tsp",  ""),
            ("Black Pepper",   "0.25", "tsp",  ""),
        ],
    },
]


def ensure_ingredients():
    """Ensure shared ingredient data exists. Safe to call multiple times."""
    ingredient_map = {}
    for name, category, unit, calories, protein, carbs, fat in INGREDIENTS:
        obj, _ = Ingredient.objects.get_or_create(
            name__iexact=name,
            defaults={
                "name": name,
                "category": category,
                "default_unit": unit,
                "calories_per_100g": Decimal(str(calories)),
                "protein_g": Decimal(str(protein)),
                "carbs_g": Decimal(str(carbs)),
                "fat_g": Decimal(str(fat)),
            },
        )
        ingredient_map[name.lower()] = obj
    return ingredient_map


def seed_demo_user(user):
    """
    Create starter recipes and a sensible week meal plan for ``user``.
    Safe to call on a fresh user; skips anything that already exists.
    """
    ingredient_map = ensure_ingredients()

    # ── Recipes ──────────────────────────────────────────────────────────────
    recipe_objs = {}
    for recipe_data in STARTER_RECIPES:
        recipe, created = Recipe.objects.get_or_create(
            user=user,
            title=recipe_data["title"],
            defaults={
                "description":        recipe_data["description"],
                "servings":           recipe_data["servings"],
                "prep_time_minutes":  recipe_data["prep_time_minutes"],
                "cook_time_minutes":  recipe_data["cook_time_minutes"],
                "instructions":       recipe_data["instructions"],
                "source":             "manual",
            },
        )
        if created:
            for tag_name in recipe_data["tags"]:
                tag, _ = Tag.objects.get_or_create(
                    slug=slugify(tag_name),
                    defaults={"name": tag_name},
                )
                recipe.tags.add(tag)

            for ing_name, qty, unit, notes in recipe_data["ingredients"]:
                ingredient = ingredient_map.get(ing_name.lower())
                if not ingredient:
                    ingredient, _ = Ingredient.objects.get_or_create(
                        name__iexact=ing_name,
                        defaults={"name": ing_name, "category": "other", "default_unit": unit},
                    )
                RecipeIngredient.objects.create(
                    recipe=recipe,
                    ingredient=ingredient,
                    quantity=Decimal(qty),
                    unit=unit,
                    notes=notes,
                )
        recipe_objs[recipe_data["title"]] = recipe

    # ── Meal plan for current week ────────────────────────────────────────────
    today = date.today()
    monday = today - timedelta(days=today.weekday())

    chicken  = recipe_objs.get("Garlic Butter Chicken")
    salmon   = recipe_objs.get("Salmon & Brown Rice Bowl")
    stirfry  = recipe_objs.get("Vegetable Stir-Fry with Rice")
    yogurt   = recipe_objs.get("Greek Yogurt Protein Bowl")
    potato   = recipe_objs.get("Baked Potato with Toppings")

    if not all([chicken, salmon, stirfry, yogurt, potato]):
        return  # recipes not created yet, skip meal plan

    plan, _ = MealPlan.objects.get_or_create(user=user, week_start=monday)
    if plan.entries.exists():
        return  # already has entries, don't overwrite

    # One breakfast + one lunch (leftover) + one dinner per day.
    # Cook days: Monday (0) and Thursday (3).
    # Leftovers stay within 3-day fridge window.
    # Servings are set so each day approaches the 2200 kcal / 165g protein goal:
    #   breakfast = 2 servings of yogurt bowl (~680 kcal, ~47g protein)
    #   lunch & dinner vary by recipe density (salmon is 1s; chicken/stirfry/potato are 2s)
    entries = [
        # Mon — cook chicken for dinner, stir-fry leftover from prev week for lunch
        (0, "breakfast", yogurt,   2),
        (0, "lunch",     stirfry,  2),
        (0, "dinner",    chicken,  2),
        # Tue — chicken leftover lunch, salmon dinner
        (1, "breakfast", yogurt,   2),
        (1, "lunch",     chicken,  2),
        (1, "dinner",    salmon,   1),
        # Wed — salmon leftover lunch, stir-fry dinner
        (2, "breakfast", yogurt,   2),
        (2, "lunch",     salmon,   1),
        (2, "dinner",    stirfry,  2),
        # Thu — cook day: potato dinner; stir-fry leftover for lunch (day 3 from Mon cook)
        (3, "breakfast", yogurt,   2),
        (3, "lunch",     stirfry,  2),
        (3, "dinner",    potato,   2),
        # Fri — potato leftover lunch, chicken dinner (≤4 days from Mon cook, ok)
        (4, "breakfast", yogurt,   2),
        (4, "lunch",     potato,   2),
        (4, "dinner",    chicken,  2),
        # Sat — chicken leftover lunch, salmon dinner
        (5, "breakfast", yogurt,   2),
        (5, "lunch",     chicken,  2),
        (5, "dinner",    salmon,   1),
        # Sun — salmon leftover lunch, stir-fry dinner (cook fresh batch for next week)
        (6, "breakfast", yogurt,   2),
        (6, "lunch",     salmon,   1),
        (6, "dinner",    stirfry,  2),
    ]
    for day, meal_type, recipe, servings in entries:
        MealPlanEntry.objects.create(
            meal_plan=plan,
            recipe=recipe,
            day=day,
            meal_type=meal_type,
            servings=Decimal(servings),
        )
