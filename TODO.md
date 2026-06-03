# TODO - sections custom uniquement

- [x] app.js: verrouiller l’initialisation en mode "custom-only" (source unique = sectionOrder / customSections)
- [x] app.js: supprimer la branche de suppression "default-*" dans deleteSection() (ne toucher qu’aux sections custom)

- [ ] app.js: s’assurer que updateStatus()/clearAllData() ne réinjecte jamais des types par défaut via SECTION_TYPES
- [ ] Tester: refresh sans données => 0 section
- [ ] Tester: créer une section custom => seule cette section s’affiche
- [ ] Tester: supprimer une section custom => elle disparaît et aucune section par défaut ne réapparaît

