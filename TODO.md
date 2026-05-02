# TODO - Correction des champs dynamiques pour sections personnalisées

## Plan de correction

### 1. Modifier `openModal()` dans app.js
- [x] Détecter si le type de section est une section personnalisée avec des champs personnalisés
- [x] Générer dynamiquement les champs de saisie basés sur la configuration `customSec.fields`
- [x] Masquer les champs par défaut (Colis annoncé, Colis Flashé)

### 2. Modifier `handleModalSave()` dans app.js
- [ ] Sauvegarder les valeurs des champs dynamiques dans le data model

### 3. Modifier `updateTable()` pour afficher correctement les colonnes
- [ ] Gérer les colonnes dynamiques basées sur les champs de la section

### 4. Mettre à jour `updateChart()` pour les données dynamiques
- [ ] Gérer les séries de données basées sur les champs personnalisés
