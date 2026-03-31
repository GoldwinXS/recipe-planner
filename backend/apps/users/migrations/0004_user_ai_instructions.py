from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_user_is_demo_temp'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='ai_instructions',
            field=models.TextField(blank=True, default=''),
        ),
    ]
