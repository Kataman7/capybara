# Guide de Migration - Chaîne de Production

**Option 1 : Si tu veux GARDER tes données existantes**

Exécute cette commande PowerShell :

```powershell
Get-Content .\db\migrations\003_add_production_chain.sql | docker exec -i capybara_db mysql -u root -pcapybararoot capybara_db
```

**Option 2 : Si tu veux repartir de zéro (⚠️ PERTE DE DONNÉES)**

```powershell
docker compose down -v
docker compose up --build
```

## Appliquer une migration SQL avec Docker sur Ubuntu

Pour appliquer une migration (ex: ajout de points d'écologie) sur Ubuntu :

```bash
cat db/migrations/005_add_ecology_points.sql | sudo docker exec -i capybara_db mysql -u root -pcapybararoot capybara_db
```

- `cat` lit le fichier SQL
- `docker exec -i` envoie le contenu au conteneur MySQL
- `mysql -u root -pcapybararoot` applique la migration sur la base `capybara_db`

Répétez pour chaque fichier de migration à appliquer.