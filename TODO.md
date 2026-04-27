# TODO - Nouveau modèle : Colis annoncés / Colis Flashé

## Plan détaillé

### 1. `generate_excel.py` ✓
- **Nouvelles colonnes** : `Type`, `Date`, `Colis annoncés`, `Colis Flashé`
- Génération de nombres aléatoires réalistes (Colis Flashé ≤ Colis annoncés)

### 2. `index.html` ✓
- **Tableaux** : 4 colonnes — `Type`, `Date`, `Colis annoncés`, `Colis Flashé`
- `colspan="4"` pour les messages vides

### 3. `app.js` ✓
- **Modèle de données** : `{ type, date, colisAnnonces, colisFlashe }`
- **Parsing Excel** : détection + lecture des 4 colonnes
- **Regroupement** : somme des valeurs par période (plus compte d'occurrences)
- **Graphiques ECharts** : 2 séries superposées par section :
  - *Colis annoncés* — ligne pleine, couleur principale
  - *Colis Flashé* — ligne pointillée, couleur secondaire
  - Légende avec les deux séries
  - Tooltip montrant les deux valeurs
- **Tableaux HTML** : affichage des 4 colonnes
- **localStorage** : stockage des 4 champs

### 4. Fichiers Excel régénérés ✓
- `donnees_completes.xlsx`
- `donnees_fevrier.xlsx`
- `Exploitation/donnees_exploitation_q1.xlsx`
- `Exploitation/donnees_exploitation_mars.xlsx`

### 5. `style.css`
- Aucune modification nécessaire

