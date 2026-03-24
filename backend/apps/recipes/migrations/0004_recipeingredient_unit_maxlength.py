from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('recipes', '0003_recipe_source_expand'),
    ]

    operations = [
        migrations.AlterField(
            model_name='recipeingredient',
            name='unit',
            field=models.CharField(max_length=50),
        ),
    ]
