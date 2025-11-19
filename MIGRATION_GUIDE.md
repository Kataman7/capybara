# Guide de Migration - Chaîne de Production

## Nouvelle feature : Système de production en cascade

Cette mise à jour ajoute un système complet de production avec 11 niveaux au-dessus des watermelons.

### Appliquer la migration

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

### Nouvelles commandes

1. **`/production`** - Affiche ta chaîne de production complète
2. **`/acheter`** - Achète automatiquement toutes les améliorations possibles avec tes ressources
3. **`/watermelon`** - Modifié : applique maintenant la production après un farm réussi
4. **`/faith`** - Inchangé : affiche foi et watermelons
5. **`/leaderboard`** - Inchangé : classement des watermelons

### Chaîne de production

```
Watermelon 🍉
  ↑ Presse-Melon 🔧 (coût: 10 🍉)
    ↑ Jardin Mélonifique 🌱 (coût: 10 🔧)
      ↑ Multiplicateur Agricolyte ⚙️ (coût: 10 🌱)
        ↑ Serre Auto-Multipliée 🏗️ (coût: 10 ⚙️)
          ↑ Usine Hydro-Mélonique 🏭 (coût: 10 🏗️)
            ↑ Complexe Agricolo-Énergétique ⚡ (coût: 10 🏭)
              ↑ Mégastructure Mélonosphérique 🌐 (coût: 10 ⚡)
                ↑ Terraformeur Fruito-Sphérique 🪐 (coût: 10 🌐)
                  ↑ Architecte Quantique du Melon 🔮 (coût: 10 🪐)
                    ↑ Matrice Originelle des Fruits Ultimes ✨ (coût: 10 🔮)
                      ↑ Cœur Cosmique du Watermelon 💫 (coût: 10 ✨)
```

### Fonctionnement

1. **Acheter** : Utilise `/acheter` pour convertir automatiquement tes ressources en améliorations
   - Exemple : Si tu as 25 watermelons, tu peux acheter 2 Presse-Melon (10 🍉 chacun)

2. **Produire** : Après chaque farm **réussi** (gain de watermelons > 0), la production s'applique :
   - Chaque Presse-Melon produit 1 Watermelon
   - Chaque Jardin Mélonifique produit 1 Presse-Melon
   - Etc.

3. **Optimiser** : Achète régulièrement pour maximiser ta production passive !

### Exemple de gameplay

```
1. Farm → +5 🍉 (total: 15 🍉)
2. /acheter → Achète 1 Presse-Melon (reste 5 🍉)
3. Farm → +7 🍉 + production (1 🔧 → +1 🍉) = total: 13 🍉
4. /acheter → Achète 1 Presse-Melon (reste 3 🍉, 2 🔧)
5. Farm → +6 🍉 + production (2 🔧 → +2 🍉) = total: 11 🍉
6. Continue...
```

### Vérifier que tout fonctionne

```powershell
# 1. Relancer le bot
docker compose restart capybara

# 2. Tester les commandes
/production
/acheter
/watermelon
```
