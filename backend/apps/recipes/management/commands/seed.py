"""
Seed the database with starter ingredients and a demo user.

Usage:
    python manage.py seed
    python manage.py seed --clear   # drop existing data first
    python manage.py seed --user demo --clear  # reset the demo account
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.users.demo_seed import ensure_ingredients, seed_demo_user

User = get_user_model()


class Command(BaseCommand):
    help = "Seed the database with starter ingredients and a demo user."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete the demo user and all their data before re-seeding.",
        )
        parser.add_argument(
            "--user",
            type=str,
            default="demo",
            help="Username for the demo account (created if missing). Default: demo",
        )

    def handle(self, *args, **options):
        username = options["user"]

        if options["clear"]:
            self.stdout.write(f"Clearing demo user '{username}' and all their data...")
            User.objects.filter(username=username).delete()
            self.stdout.write("  Done.")

        # Ensure shared ingredient data exists
        self.stdout.write("Ensuring shared ingredients exist...")
        ensure_ingredients()
        self.stdout.write("  Done.")

        # Create (or retrieve) the demo user
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": f"{username}@example.com",
                "daily_calorie_goal": 2200,
                "daily_protein_g": 165,
                "daily_carbs_g": 220,
                "daily_fat_g": 73,
                "cooking_days": [0, 3, 6],
                "is_demo_temp": False,
            },
        )
        if created:
            user.set_password("demopassword123")
            user.save()
            self.stdout.write(f"Created demo user: {username} / demopassword123")
        else:
            self.stdout.write(f"Using existing user: {username}")

        # Seed recipes and meal plan
        self.stdout.write("Seeding recipes and meal plan...")
        seed_demo_user(user)
        self.stdout.write("  Done.")

        self.stdout.write(self.style.SUCCESS("\nSeeding complete."))
