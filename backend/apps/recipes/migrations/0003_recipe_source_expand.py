from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('recipes', '0002_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='recipe',
            name='source',
            field=models.CharField(
                choices=[
                    ('manual', 'Manual'),
                    ('claude', 'Claude AI'),
                    ('ollama', 'Ollama'),
                    ('openai_compat', 'OpenAI API'),
                    ('browser', 'Browser LLM'),
                    ('url', 'From URL'),
                ],
                default='manual',
                max_length=20,
            ),
        ),
    ]
