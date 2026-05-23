import json
import sys

# Charger les champs pour identifier les colonnes personnalisées
with open('project_fields_fixed.json', 'r', encoding='utf-8') as f:
    fields_data = json.load(f)

fields_map = {f['id']: f['name'] for f in fields_data['fields']}
# Trouver spécifiquement les IDs pour Status, Debut, Fin
status_field_id = next((f['id'] for f in fields_data['fields'] if (f.get('name') or '').lower() == 'status'), None)
debut_field_id = next((f['id'] for f in fields_data['fields'] if (f.get('name') or '').lower() == 'debut'), None)
fin_field_id = next((f['id'] for f in fields_data['fields'] if (f.get('name') or '').lower() == 'fin'), None)

# Charger les items
with open('project_items_fixed.json', 'r', encoding='utf-8') as f:
    items_data = json.load(f)

print(f"{'Issue':<60} | {'Status':<15} | {'Debut':<15} | {'Fin':<15}")
print("-" * 115)

for item in items_data['items']:
    content = item.get('content', {})
    title = content.get('title', 'Unknown')
    number = content.get('number', '')
    issue_label = f"{title} #{number}"
    
    # Extraire les valeurs des champs
    status = item.get('status', 'N/A')
    debut = 'N/A'
    fin = 'N/A'
    
    # Dans le format JSON de gh project item-list, les custom fields sont parfois dans un champ spécifique
    # On va chercher dans tous les attributs si on ne trouve pas directement
    field_values = item.get('fieldValues', [])
    if isinstance(field_values, list):
        for fv in field_values:
            fid = fv.get('field', {}).get('id')
            if fid == status_field_id:
                status = fv.get('name', status)
            elif fid == debut_field_id:
                debut = fv.get('date', fv.get('text', 'N/A'))
            elif fid == fin_field_id:
                fin = fv.get('date', fv.get('text', 'N/A'))

    print(f"{issue_label[:60]:<60} | {status:<15} | {debut:<15} | {fin:<15}")
