# Fichiers Excel d'exemple — Description complète

Ces fichiers permettent de tester immédiatement le tableau de bord.  
Recrée-les dans Excel, LibreOffice Calc ou Google Sheets, puis enregistre-les au format `.xlsx`.

---

## Structure commune (tous les fichiers)

| Colonne A | Colonne B | Colonne C | Colonne D (optionnel) |
|-----------|-----------|-----------|----------------------|
| **Type** | **Date** | **Heure d'arrivée** | **Heure de dispersion** |

**Formats acceptés :**
- **Date** : `JJ/MM/AAAA`, `AAAA-MM-JJ`, ou date Excel native.
- **Heure** : `HH:MM`, ou heure Excel native.

---

## 1. `donnees_completes.xlsx`

- **Emplacement** : racine du projet (`/`)
- **Lignes** : ~100
- **Période** : janvier à avril 2024
- **Répartition** : 20 % par type (environ 20 lignes chacun)
- **Particularités** : couvre tous les types ; heures réalistes par créneau horaire.

### Extrait (5 premières lignes)

| Type | Date | Heure d'arrivée | Heure de dispersion |
|------|------|-----------------|---------------------|
| Dispersion 14h | 15/01/2024 | 13:45 | 14:20 |
| Arrivée 14h | 15/01/2024 | 14:10 | — |
| Concentration | 16/01/2024 | 09:30 | — |
| Dispersion 18h | 16/01/2024 | 17:50 | 18:25 |
| Arrivée 18h | 16/01/2024 | 18:15 | — |

### Plages horaires conseillées
- **Dispersion 14h** : heures d'arrivée 13:00–14:30, dispersion 14:00–15:00
- **Arrivée 14h** : heures d'arrivée 13:30–14:45
- **Dispersion 18h** : heures d'arrivée 17:00–18:30, dispersion 18:00–19:00
- **Arrivée 18h** : heures d'arrivée 17:30–18:45
- **Concentration** : heures d'arrivée 08:00–12:00 (matin) ou 13:00–17:00 (après-midi)

---

## 2. `donnees_fevrier.xlsx`

- **Emplacement** : racine du projet (`/`)
- **Lignes** : ~30
- **Période** : février 2024 uniquement
- **Répartition** : tous les 5 types représentés (~6 lignes chacun)
- **Particularités** : utile pour tester le filtre par mois et le regroupement par jour/semaine sur un mois court.

### Extrait (5 premières lignes)

| Type | Date | Heure d'arrivée | Heure de dispersion |
|------|------|-----------------|---------------------|
| Arrivée 14h | 05/02/2024 | 14:05 | — |
| Dispersion 14h | 05/02/2024 | 13:30 | 14:10 |
| Concentration | 07/02/2024 | 10:15 | — |
| Arrivée 18h | 08/02/2024 | 18:00 | — |
| Dispersion 18h | 08/02/2024 | 17:40 | 18:15 |

---

## 3. `Exploitation/donnees_exploitation_q1.xlsx`

- **Emplacement** : dossier **`Exploitation/`**
- **Lignes** : ~45
- **Période** : janvier à mars 2024
- **Répartition** : tous les 5 types (~9 lignes chacun)
- **Particularités** : colonne **Heure de dispersion** renseignée pour tous les types "Dispersion".

### Extrait (5 premières lignes)

| Type | Date | Heure d'arrivée | Heure de dispersion |
|------|------|-----------------|---------------------|
| Dispersion 14h | 10/01/2024 | 13:20 | 14:00 |
| Dispersion 14h | 12/01/2024 | 13:55 | 14:30 |
| Arrivée 14h | 12/01/2024 | 14:20 | — |
| Concentration | 15/01/2024 | 11:00 | — |
| Dispersion 18h | 17/01/2024 | 17:10 | 18:00 |

---

## 4. `Exploitation/donnees_exploitation_mars.xlsx`

- **Emplacement** : dossier **`Exploitation/`**
- **Lignes** : ~25
- **Période** : mars 2024 uniquement
- **Répartition** : tous les 5 types (~5 lignes chacun)
- **Particularités** : données concentrées sur un seul mois, idéal pour tester le zoom et le regroupement par jour.

### Extrait (5 premières lignes)

| Type | Date | Heure d'arrivée | Heure de dispersion |
|------|------|-----------------|---------------------|
| Arrivée 14h | 01/03/2024 | 14:00 | — |
| Dispersion 14h | 01/03/2024 | 13:35 | 14:15 |
| Concentration | 04/03/2024 | 09:45 | — |
| Arrivée 18h | 05/03/2024 | 18:20 | — |
| Dispersion 18h | 05/03/2024 | 17:45 | 18:30 |

---

## Instructions de création rapide

1. Ouvre Excel / LibreOffice Calc.
2. Saisis les en-têtes exacts : `Type`, `Date`, `Heure d'arrivée`, `Heure de dispersion`.
3. Remplis les lignes en respectant les types autorisés :
   - `Dispersion 14h`
   - `Arrivée 14h`
   - `Dispersion 18h`
   - `Arrivée 18h`
   - `Concentration`
4. Enregistre au format **.xlsx** (Classeur Excel).
5. Place les fichiers selon l'emplacement indiqué ci-dessus.
6. Ouvre `index.html` dans Chrome/Edge, clique sur **Importer Excel** dans une section, sélectionne le fichier.
7. Le graphique ECharts et le tableau se mettent à jour automatiquement.

