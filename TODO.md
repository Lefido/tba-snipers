# TODO - Modifications et Export Excel

## Plan détaillé

### 1. `index.html` ✓
- [x] Ajouter colonne **Actions** (✏️ / 🗑️) dans les 5 tableaux de données brutes
- [x] Ajouter bouton **📊 Exporter Excel** dans chaque section
- [x] Ajouter la **modal** HTML globale (ajout / édition)

### 2. `style.css` ✓
- [x] Styles pour la **modal** (overlay, centering, animations)
- [x] Styles pour les boutons d'action dans les tableaux (edit/delete)

### 3. `app.js` ✓
- [x] Variable d'état `editingIndex`
- [x] Fonction `editRow(index)` — pré-remplit la modal
- [x] Fonction `deleteRow(index)` — supprime avec confirmation
- [x] Adapter `updateTable()` — ajouter boutons actions avec `data-index`
- [x] Fonction `openModal()` — gérer le mode ajout / édition
- [x] Fonction `closeModal()`
- [x] Fonction `handleModalSave()` — sauvegarder / modifier
- [x] Fonction `exportSectionExcel(sectionType)` — export XLSX via SheetJS
- [x] Écouteurs pour les nouveaux boutons

### 4. Tests ✓
- [x] Modifier une ligne existante
- [x] Supprimer une ligne
- [x] Exporter les données d'une section en Excel

