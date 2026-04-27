# Prompt Maître — Tableau de Bord Excel → ECharts

> **Rôle assigné** : Développeur front-end expert (HTML5, CSS3, Vanilla JS), spécialisé en visualisation de données avec **ECharts** et **SheetJS**, et en conception d'interfaces premium/responsive.
> **Objectif** : Livrer un projet web de **3 fichiers** (`index.html`, `style.css`, `app.js`) immédiatement exécutable dans Chrome/Edge en ouvrant simplement `index.html`.
> **Contraintes absolues** : Aucune dépendance locale ; uniquement des CDN. Code complet, cohérent, commenté et sans placeholder.

---

## Ordre d'exécution obligatoire

Tu dois IMPÉRATIVEMENT respecter cet ordre. Ne passes pas à l'étape N+1 tant que l'étape N n'est pas entièrement terminée et vérifiée mentalement.

1. **Générer `index.html`** — structure sémantique, inclusion des CDN, conteneurs des 5 sections.
2. **Générer `style.css`** — design premium responsive (palette bleu/gris), cartes, ombres, typographie, tableaux, boutons.
3. **Générer `app.js`** — logique métier complète : import, parsing, filtrage, regroupement, rendu ECharts, tableaux, localStorage, réinitialisation, export PNG.
4. **Décrire les fichiers Excel d'exemple** — noms, emplacements (`/` ou `/Exploitation/`), structure de colonnes, 3+ lignes d'exemple par fichier.
5. **Vérification finale** — parcourir la checklist ci-dessous et t'assurer que **chaque item** est implémenté.

---

## 1. Fichiers à générer

| Fichier | Description | Contraintes |
|---------|-------------|-------------|
| `index.html` | Structure de page, inclusion CDN ECharts + SheetJS + Google Fonts | Sémantique, accessible, commenté |
| `style.css` | Styles complets, organisation par zone | Responsive mobile-first, palette bleu/gris premium |
| `app.js` | Logique métier 100 % fonctionnelle | Modulaire (fonctions dédiées), commenté, sans framework JS externe |

**RÈGLES STRICTES :**
- Aucun fichier ne doit contenir de commentaire du type `// TODO`, `// à compléter`, `...` ou tout placeholder.
- Le projet doit fonctionner en ouvrant `index.html` directement depuis le disque (`file://`) ou un serveur local.

---

## 2. Architecture de la page (`index.html`)

### 2.1 Header fixe
- Titre du site (ex : *Tableau de Bord Analytique*).
- Sous-titre ou description courte.
- Barre de navigation/ancres vers les 5 sections (liens d'ancrage `#section-id`).

### 2.2 Sections obligatoires (dans cet ordre)
Chaque section est une carte (`<section>`) avec un `id` unique :

1. `#dispersion-14h` — **Dispersion 14h**
2. `#arrivee-14h` — **Arrivée 14h**
3. `#dispersion-18h` — **Dispersion 18h**
4. `#arrivee-18h` — **Arrivée 18h**
5. `#concentration` — **Concentration**

### 2.3 Contenu identique par section
Chaque section doit IMPÉRATIVEMENT contenir :

- **Titre de section** (`<h2>`).
- **Bouton d'import Excel** (`<input type="file" accept=".xlsx">` ou bouton stylisé déclenchant un input caché).
- **Filtres dynamiques** : sélecteurs pour :
  - **Jour** (date picker ou dropdown)
  - **Heure** (dropdown ou slider)
  - **Mois** (dropdown)
  - **Année** (dropdown)
- **Bouton "Exporter en PNG"** dédié à cette section.
- **Conteneur de graphique ECharts** (`<div>` avec ID unique).
- **Tableau brut HTML** (`<table>`) affichant les données filtrées, placé **sous** le graphique.

### 2.4 Barre de contrôle globale (en haut, sous le header ou dans le header)
- **Bouton "Réinitialiser toutes les données"** : efface `localStorage`, vide les graphiques, vide les tableaux, réinitialise les filtres.
- **Indicateur de statut** : message affichant si des données sont chargées depuis le `localStorage` ou un fichier.

---

## 3. Design & UX (`style.css`)

### Palette obligatoire
- **Primaire** : `#2563EB` (bleu électrique) ou équivalent élégant.
- **Secondaire** : `#64748B` (gris ardoise).
- **Fond** : `#F8FAFC` (gris très clair) ou dégradé subtil.
- **Surface** : `#FFFFFF` (blanc pur pour les cartes).
- **Texte** : `#0F172A` (presque noir) et `#475569` (gris moyen).

### Composants à styler
- **Cartes de section** : `border-radius: 12px`, ombre portée légère (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1)`), padding cohérent (ex. `24px`).
- **Boutons** : arrondis (`border-radius: 8px`), padding `12px 24px`, transitions au survol (`hover`), état actif (`active`).
- **Inputs de fichier** : masqués si possible, remplacés par un bouton stylisé avec icône textuelle (📁) ou label.
- **Tableaux** : bordures fines, alternance de lignes (zebra striping), en-tête sticky si possible, responsive avec `overflow-x: auto`.
- **Header fixe** : `position: sticky`, `z-index` élevé, fond blanc/blur éventuel.
- **Typographie** : Google Fonts (ex. *Inter*, *Roboto*, ou *Poppins*) via CDN.
- **Responsive** :
  - Desktop : 1 colonne par section (empilées verticalement), graphique pleine largeur.
  - Tablette / Mobile : padding réduit, filtres empilés verticalement, tableaux scrollables horizontalement.

---

## 4. Logique métier (`app.js`)

### 4.1 Données attendues (structure interne après parsing)
Chaque ligne Excel doit être convertie en objet JavaScript de cette forme EXACTE :

```js
{
  type: "Dispersion 14h",      // String, correspond à l'une des 5 sections
  date: Date,                  // Objet Date JS (année/mois/jour)
  heureArrivee: Date,          // Objet Date JS (heure:minute, date ignorée ou fusionnée)
  heureDispersion: Date | null // Optionnel, même format que heureArrivee
}
```

### 4.2 Fonctions obligatoires (structure modulaire)
Tu dois IMPÉRATIVEMENT créer les fonctions suivantes (noms suggérés, respecte-les ou utilise des noms explicites équivalents) :

| Fonction | Responsabilité |
|----------|----------------|
| `initApp()` | Point d'entrée : initialise ECharts, charge `localStorage`, attache les écouteurs d'événements. |
| `handleFileImport(event, sectionType)` | Lit le fichier `.xlsx` via SheetJS, parse les colonnes, convertit en objets JS, stocke dans une variable globale/state, sauvegarde dans `localStorage`. |
| `parseExcelData(arrayBuffer)` | Prend un ArrayBuffer, utilise `XLSX.read`, extrait la première feuille, mappe les lignes vers la structure d'objet ci-dessus. Détecte automatiquement les colonnes : `Type`, `Date`, `Heure d'arrivée`, `Heure de dispersion` (optionnel). |
| `convertExcelDate(excelSerial)` / `parseTime(timeValue)` | Utilitaires de conversion robustes (SheetJS retourne souvent des sériels pour les dates). |
| `filterData(data, filters)` | Filtre un tableau d'objets selon les critères actifs (jour, heure, mois, année). Retourne un nouveau tableau filtré. |
| `groupData(filteredData, granularity)` | Regroupe les données par `jour`, `semaine`, `mois` ou `année`. Retourne un objet/données agrégées prêtes pour ECharts. |
| `updateChart(sectionType, data)` | Met à jour (ou crée) l'instance ECharts de la section avec les nouvelles données. Gère le `setOption`. |
| `updateTable(sectionType, data)` | Met à jour le `<tbody>` du tableau de la section avec les lignes filtrées. |
| `renderSection(sectionType)` | Orchestration : applique filtres + regroupement → `updateChart` + `updateTable`. |
| `saveToLocalStorage(data)` | Sérialise les données (JSON) et les stocke sous une clé définie. |
| `loadFromLocalStorage()` | Désérialise et retourne les données sauvegardées, ou `null`. |
| `clearAllData()` | Supprime les données en mémoire (variable JS), vide `localStorage`, réinitialise tous les graphiques (option `clear`), vide tous les tableaux, réinitialise les filtres à leur état par défaut. |
| `exportChartPNG(sectionType)` | Utilise `chartInstance.getDataURL()` ou `chartInstance.getConnectedDataURL()` pour générer un PNG et déclencher un téléchargement (`<a download>`). |
| `populateFilters(data)` / `updateFilterOptions(sectionType, data)` | Met à jour les options des dropdowns de filtres (jours disponibles, mois disponibles, etc.) pour éviter les sélections impossibles. |

### 4.3 Comportements obligatoires
- **Import** : lorsqu'un fichier est importé dans une section, les données sont parsées, fusionnées avec les données existantes (si pertinent), sauvegardées dans `localStorage`, et **toutes** les sections concernées sont mises à jour.
- **Filtres** : tout changement de filtre (dropdown, date picker) déclenche immédiatement `renderSection()` pour cette section.
- **Regroupement** : ajoute un sélecteur de granularité (`Jour`, `Semaine`, `Mois`, `Année`) dans chaque section. Le graphique s'adapte dynamiquement.
- **Graphiques ECharts** (exigences par section) :
  - Type : **courbe lissée** (`smooth: true`) ou **ligne** avec aires si pertinent.
  - **Zoom** : `dataZoom` (slider + inside) activé.
  - **Tooltip** : formaté, affichant la date, l'heure, la valeur, le type.
  - **Légende** : permettant d'activer/désactiver les séries (si multi-séries) ou masquer/afficher.
  - **Couleurs** : cohérentes avec la palette CSS. Chaque section peut avoir une teinte légèrement différente pour différenciation visuelle.
  - **Grid** : padding interne suffisant pour lisibilité.
  - **Animation** : animations activées (`animationDuration: 800`).
- **localStorage** :
  - Clé suggérée : `agc_dashboard_data`.
  - Au chargement de la page (`DOMContentLoaded`), si des données existent, les recharger et afficher immédiatement.
  - Afficher un toast/bandeau informant l'utilisateur : *"Données précédentes restaurées"*.
- **Réinitialisation** :
  - Le bouton global doit tout effacer sans confirmation (ou avec une confirmation simple `confirm()`).
  - Les graphiques doivent revenir à un état vide avec un message grisé (ex. *Aucune donnée — importez un fichier Excel*).
- **Tableaux bruts** :
  - Colonnes : `Type`, `Date`, `Heure d'arrivée`, `Heure de dispersion` (si présente).
  - Tri possible sur l'en-tête (optionnel mais recommandé : tri par date).
  - Lignes alignées, padding confortable.

---

## 5. Fichiers Excel d'exemple à décrire

Tu ne dois PAS générer de fichiers binaires, mais décrire **textuellement et de manière reproductible** les fichiers suivants :

### 5.1 Structure commune
Chaque fichier doit contenir **exactement ces colonnes** (en-tête en première ligne) :

| Colonne A | Colonne B | Colonne C | Colonne D (optionnel) |
|-----------|-----------|-----------|----------------------|
| **Type** | **Date** | **Heure d'arrivée** | **Heure de dispersion** |

### 5.2 Fichiers à décrire

1. **`donnees_completes.xlsx`** (racine du projet)
   - Environ 100 lignes.
   - Répartition des types : 20 % Dispersion 14h, 20 % Arrivée 14h, 20 % Dispersion 18h, 20 % Arrivée 18h, 20 % Concentration.
   - Dates sur 3 à 4 mois consécutifs (ex. janvier à avril 2024).
   - Heures réalistes : entre 13h00 et 15h00 pour les types 14h, entre 17h00 et 19h00 pour les types 18h, variables pour Concentration.

2. **`donnees_fevrier.xlsx`** (racine du projet)
   - Environ 30 lignes.
   - Toutes les dates en février 2024.
   - Couvre tous les 5 types.

3. **`donnees_exploitation_q1.xlsx`** (dossier **`Exploitation/`**)
   - Environ 45 lignes.
   - Dates de janvier à mars 2024.
   - Couvre tous les 5 types.
   - Colonne D `Heure de dispersion` renseignée pour les types "Dispersion".

4. **`donnees_exploitation_mars.xlsx`** (dossier **`Exploitation/`**)
   - Environ 25 lignes.
   - Toutes les dates en mars 2024.
   - Couvre tous les 5 types.

### 5.3 Format de description attendu
Pour **chaque fichier**, fournis :
- **Nom exact** du fichier.
- **Emplacement** : `racine/` ou `Exploitation/`.
- **Nombre de lignes** (approximatif).
- **Tableau des 5 premières lignes** (valeurs textuelles réalistes, au format lisible).
- **Note** sur les particularités (plages horaires, présence de `Heure de dispersion`, etc.).

---

## 6. Checklist de vérification finale (à valider avant livraison)

Avant de répondre, vérifie mentalement chaque item. Si l'un d'eux manque, **corrige avant de livrer**.

### Structure
- [ ] `index.html`, `style.css`, `app.js` sont tous complets et cohérents.
- [ ] Aucun lien vers fichier externe autre que CDN.
- [ ] Les 5 sections HTML ont un `id` unique et cohérent.
- [ ] Chaque section contient : titre, bouton import, filtres, bouton export PNG, div graphique, tableau.

### Style
- [ ] Palette bleu/gris respectée.
- [ ] Header fixe/sticky.
- [ ] Cartes avec ombres et bords arrondis.
- [ ] Boutons arrondis et visibles.
- [ ] Tableaux responsives (scroll horizontal si besoin).
- [ ] Typographie Google Fonts chargée.

### JavaScript
- [ ] SheetJS (XLSX.js) et ECharts chargés via CDN.
- [ ] Fonction `initApp()` appelée au démarrage.
- [ ] Lecture Excel fonctionnelle (FileReader + SheetJS).
- [ ] Conversion dates/heures robuste (gestion des sériels Excel).
- [ ] Données filtrables par jour, heure, mois, année.
- [ ] Regroupement par jour/semaine/mois/année fonctionnel.
- [ ] Graphiques ECharts : courbes lissées, zoom, tooltips, légende interactive.
- [ ] Tableaux mis à jour en temps réel sous chaque graphique.
- [ ] localStorage : sauvegarde, restauration au chargement, message utilisateur.
- [ ] Bouton "Réinitialiser" efface tout (mémoire + stockage + UI).
- [ ] Export PNG fonctionnel par section.

### Données d'exemple
- [ ] 4 fichiers Excel décrits (2 à la racine, 2 dans `Exploitation/`).
- [ ] ~100 jours aléatoires au total répartis.
- [ ] Les 5 types sont tous représentés.
- [ ] Colonnes Type, Date, Heure d'arrivée présentes. Heure de dispersion optionnelle mais présente dans les fichiers `Exploitation/`.

---

## 7. Format de livraison

Réponds en fournissant **dans cet ordre exact** :

1. **`index.html`** — bloc de code complet (copiable-coller).
2. **`style.css`** — bloc de code complet (copiable-coller).
3. **`app.js`** — bloc de code complet (copiable-coller).
4. **Description des fichiers Excel d'exemple** — texte structuré avec tableaux de lignes d'exemple.
5. **Instructions de test rapide** — 2-3 phrases expliquant comment tester (ouvrir `index.html`, importer un fichier, vérifier les graphiques).

**RAPPEL FINAL** : Aucune fonctionnalité décrite ci-dessus ne doit être omise. Le projet doit être **100 % fonctionnel** sans intervention humaine après copie des fichiers.

