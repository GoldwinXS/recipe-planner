from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("meal_plans", "0002_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="mealplanentry",
            name="storage",
            field=models.CharField(
                blank=True,
                choices=[
                    ("fresh", "Fresh (same day)"),
                    ("fridge", "Refrigerate"),
                    ("freeze", "Freeze"),
                ],
                default="fridge",
                max_length=10,
            ),
        ),
    ]
