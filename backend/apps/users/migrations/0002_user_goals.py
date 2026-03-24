from django.db import migrations, models

import apps.users.models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='daily_calorie_goal',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='daily_protein_g',
            field=models.DecimalField(blank=True, decimal_places=1, max_digits=6, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='daily_carbs_g',
            field=models.DecimalField(blank=True, decimal_places=1, max_digits=6, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='daily_fat_g',
            field=models.DecimalField(blank=True, decimal_places=1, max_digits=6, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='cooking_days',
            field=models.JSONField(blank=True, default=apps.users.models._default_cooking_days),
        ),
    ]
