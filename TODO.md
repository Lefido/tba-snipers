# TODO — Header nav responsive (desktop)

- [x] Analyser l’état actuel : .header-nav desktop a une `height: 80vh` fixe
- [x] Modifier `style.css` pour que `.header-nav` prenne la hauteur restante : `top: var(--header-total-height, 140px); bottom: 0;` et suppression de `height: 80vh`
- [ ] Tester en desktop : 1366x768, 1920x1080, 2560x1440 (scroll interne et non-coupure)
- [ ] Vérifier que la valeur `--header-total-height` est bien recalculée au resize (app.js)

