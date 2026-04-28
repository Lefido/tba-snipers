/**
 * ============================================================
 * TABLEAU DE BORD ANALYTIQUE — Logique métier
 * ============================================================
 * Gère l'import Excel (SheetJS), la visualisation (ECharts),
 * les filtres, le regroupement, le localStorage, l'export PNG,
 * l'édition/suppression des lignes et l'export Excel.
 * Modèle de données : { type, date, colisAnnonces, colisFlashe }
 */

/* ============================================================
   CONFIGURATION & ÉTAT GLOBAL
   ============================================================ */

/** Types de sections supportés */
const SECTION_TYPES = [
  "Dispersion 14h",
  "Arrivée 14h",
  "Dispersion 18h",
  "Arrivée 18h",
  "Concentration"
];

/** Mapping type -> IDs DOM + couleurs double série */
const SECTION_CONFIG = {
  "Dispersion 14h": {
    chart: "chart-dispersion-14h",
    table: "table-dispersion-14h",
    colorAnnonces: "#2563EB",
    colorFlashe: "#93C5FD"
  },
  "Arrivée 14h": {
    chart: "chart-arrivee-14h",
    table: "table-arrivee-14h",
    colorAnnonces: "#059669",
    colorFlashe: "#6EE7B7"
  },
  "Dispersion 18h": {
    chart: "chart-dispersion-18h",
    table: "table-dispersion-18h",
    colorAnnonces: "#7C3AED",
    colorFlashe: "#C4B5FD"
  },
  "Arrivée 18h": {
    chart: "chart-arrivee-18h",
    table: "table-arrivee-18h",
    colorAnnonces: "#DC2626",
    colorFlashe: "#FCA5A5"
  },
  "Concentration": {
    chart: "chart-concentration",
    table: "table-concentration",
    colorAnnonces: "#D97706",
    colorFlashe: "#FCD34D"
  }
};

/** Clé localStorage */
const STORAGE_KEY = "agc_dashboard_data";

/** Données en mémoire : tableau d'objets { type, date, colisAnnonces, colisFlashe } */
let appData = [];

/** Instances ECharts par type */
const chartInstances = {};

/** Édition en cours : index dans appData, ou null */
let editingIndex = null;

/** Section courante pour la modal */
let currentModalSection = null;

/* ============================================================
   UTILITAIRES DE DATE
   ============================================================ */

function convertExcelDate(val) {
  if (!val && val !== 0) return null;
  if (val instanceof Date) return isNaN(val) ? null : val;
  if (typeof val === "number") {
    const epoch = new Date(1899, 11, 30);
    return new Date(epoch.getTime() + val * 86400000);
  }
  if (typeof val === "string") {
    const parsed = new Date(val.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1"));
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

function parseNumber(val) {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = parseInt(val.replace(/\s/g, ""), 10);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function fmtDate(d) {
  if (!d || isNaN(d)) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatISODate(d) {
  if (!d || isNaN(d)) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekNumber(d) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
}

/* ============================================================
   LOCALSTORAGE
   ============================================================ */

function saveToLocalStorage() {
  try {
    const serializable = appData.map(row => ({
      type: row.type,
      date: row.date ? row.date.toISOString() : null,
      colisAnnonces: row.colisAnnonces,
      colisFlashe: row.colisFlashe
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    updateStatus(true);
  } catch (e) {
    console.error("Erreur sauvegarde localStorage:", e);
  }
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return false;
    appData = parsed.map(row => ({
      type: row.type,
      date: row.date ? new Date(row.date) : null,
      colisAnnonces: row.colisAnnonces || 0,
      colisFlashe: row.colisFlashe || 0
    }));
    updateStatus(true);
    return true;
  } catch (e) {
    console.error("Erreur chargement localStorage:", e);
    return false;
  }
}

function updateStatus(hasData) {
  const el = document.getElementById("status-indicator");
  if (!el) return;
  if (hasData && appData.length > 0) {
    el.textContent = `Données chargées (${appData.length} lignes)`;
    el.classList.add("active");
  } else {
    el.textContent = "Aucune donnée chargée";
    el.classList.remove("active");
  }
}

/* ============================================================
   PARSING EXCEL
   ============================================================ */

function parseExcelData(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const firstSheet = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheet];
  const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });

  if (json.length < 2) return [];

  const headers = json[0].map(h => String(h).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const idxType = headers.findIndex(h => h.includes("type"));
  const idxDate = headers.findIndex(h => h.includes("date"));
  const idxAnnonces = headers.findIndex(h => h.includes("annonce"));
  const idxFlashe = headers.findIndex(h => h.includes("flash"));

  if (idxType === -1 || idxDate === -1) {
    throw new Error("Colonnes requises non détectées (Type, Date)");
  }

  const rows = [];
  for (let i = 1; i < json.length; i++) {
    const r = json[i];
    if (!r || r.length === 0) continue;

    const typeVal = String(r[idxType] || "").trim();
    if (!SECTION_TYPES.includes(typeVal)) continue;

    const dateVal = convertExcelDate(r[idxDate]);
    if (!dateVal) continue;

    const annoncesVal = idxAnnonces !== -1 ? parseNumber(r[idxAnnonces]) : 0;
    const flasheVal = idxFlashe !== -1 ? parseNumber(r[idxFlashe]) : 0;

    rows.push({
      type: typeVal,
      date: dateVal,
      colisAnnonces: annoncesVal,
      colisFlashe: flasheVal
    });
  }
  return rows;
}

/* ============================================================
   IMPORT FICHIER
   ============================================================ */

function handleFileImport(event, sectionType) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const newRows = parseExcelData(e.target.result);
      if (newRows.length === 0) {
        alert("Aucune donnée valide trouvée dans ce fichier.");
        return;
      }
      const existingKeys = new Set(appData.map(r => `${r.type}|${r.date?.toISOString()}`));
      const uniqueNew = newRows.filter(r => {
        const key = `${r.type}|${r.date?.toISOString()}`;
        if (existingKeys.has(key)) return false;
        existingKeys.add(key);
        return true;
      });

      appData = appData.concat(uniqueNew);
      saveToLocalStorage();

      const affectedTypes = new Set(newRows.map(r => r.type));
      affectedTypes.forEach(type => {
        populateFilters(type);
        renderSection(type);
      });

      alert(`${uniqueNew.length} nouvelle(s) ligne(s) importée(s) avec succès.`);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'import : " + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
  event.target.value = "";
}

/* ============================================================
   FILTRAGE & REGROUPEMENT
   ============================================================ */

function getFiltersForSection(sectionType) {
  const slug = sectionTypeToSlug(sectionType);
  return {
    day: document.getElementById(`filter-day-${slug}`)?.value || "",
    month: document.getElementById(`filter-month-${slug}`)?.value || "",
    year: document.getElementById(`filter-year-${slug}`)?.value || "",
    granularity: document.getElementById(`filter-granularity-${slug}`)?.value || "day"
  };
}

function sectionTypeToSlug(type) {
  return {
    "Dispersion 14h": "d14",
    "Arrivée 14h": "a14",
    "Dispersion 18h": "d18",
    "Arrivée 18h": "a18",
    "Concentration": "c"
  }[type];
}

function filterData(data, filters) {
  return data.filter(row => {
    if (!row.date || isNaN(row.date)) return false;
    if (filters.year && String(row.date.getFullYear()) !== filters.year) return false;
    if (filters.month) {
      const monthStr = String(row.date.getMonth() + 1).padStart(2, "0");
      if (monthStr !== filters.month) return false;
    }
    if (filters.day) {
      const dayStr = String(row.date.getDate()).padStart(2, "0");
      if (dayStr !== filters.day) return false;
    }
    return true;
  });
}

function groupDataDouble(filteredData, granularity) {
  const map = new Map();
  filteredData.forEach(row => {
    const d = row.date;
    let key;
    switch (granularity) {
      case "week":
        key = `${d.getFullYear()}-S${String(getWeekNumber(d)).padStart(2, "0")}`;
        break;
      case "month":
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        break;
      case "year":
        key = String(d.getFullYear());
        break;
      case "day":
      default:
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    if (!map.has(key)) {
      map.set(key, { annonces: 0, flashe: 0 });
    }
    const entry = map.get(key);
    entry.annonces += row.colisAnnonces;
    entry.flashe += row.colisFlashe;
  });
  const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  return {
    categories: sorted.map(e => e[0]),
    annonces: sorted.map(e => e[1].annonces),
    flashe: sorted.map(e => e[1].flashe)
  };
}

/* ============================================================
   MISE À JOUR DES FILTRES
   ============================================================ */

function populateFilters(sectionType) {
  const slug = sectionTypeToSlug(sectionType);
  const sectionData = appData.filter(r => r.type === sectionType);
  if (sectionData.length === 0) return;

  const days = new Set();
  const months = new Set();
  const years = new Set();

  sectionData.forEach(row => {
    if (row.date) {
      days.add(String(row.date.getDate()).padStart(2, "0"));
      months.add(String(row.date.getMonth() + 1).padStart(2, "0"));
      years.add(String(row.date.getFullYear()));
    }
  });

  const populateSelect = (id, values) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">Tous</option>';
    Array.from(values).sort().forEach(v => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    });
    if (Array.from(values).includes(current)) sel.value = current;
  };

  populateSelect(`filter-day-${slug}`, days);
  populateSelect(`filter-month-${slug}`, months);
  populateSelect(`filter-year-${slug}`, years);
}

/* ============================================================
   ECHARTS — CRÉATION & MISE À JOUR
   ============================================================ */

function initCharts() {
  SECTION_TYPES.forEach(type => {
    const dom = document.getElementById(SECTION_CONFIG[type].chart);
    if (!dom) return;
    chartInstances[type] = echarts.init(dom);
    renderEmptyChart(type);
  });

  window.addEventListener("resize", () => {
    Object.values(chartInstances).forEach(ch => ch && ch.resize());
  });
}

function renderEmptyChart(type) {
  const chart = chartInstances[type];
  if (!chart) return;
  chart.setOption({
    title: {
      text: "Aucune donnée — importez un fichier Excel",
      left: "center",
      top: "center",
      textStyle: { color: "#94a3b8", fontSize: 16, fontFamily: "Inter" }
    },
    xAxis: { show: false },
    yAxis: { show: false },
    series: []
  }, true);
}

function updateChart(sectionType, data) {
  const chart = chartInstances[sectionType];
  if (!chart) return;

  if (data.length === 0) {
    renderEmptyChart(sectionType);
    return;
  }

  const filters = getFiltersForSection(sectionType);
  const filtered = filterData(data, filters);
  const grouped = groupDataDouble(filtered, filters.granularity);

  if (grouped.categories.length === 0) {
    renderEmptyChart(sectionType);
    return;
  }

  const cfg = SECTION_CONFIG[sectionType];
  const isConcentration = sectionType === "Concentration";

  const legendData = isConcentration ? ["Colis Flashé"] : ["Colis annoncé", "Colis Flashé"];

  const seriesList = [];

  if (!isConcentration) {
    seriesList.push({
      name: "Colis annoncé",
      type: "line",
      smooth: true,
      symbol: "circle",
      symbolSize: 8,
      data: grouped.annonces,
      itemStyle: { color: cfg.colorAnnonces },
      lineStyle: { width: 3, color: cfg.colorAnnonces },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: cfg.colorAnnonces + "33" },
          { offset: 1, color: cfg.colorAnnonces + "05" }
        ])
      }
    });
  }

  seriesList.push({
    name: "Colis Flashé",
    type: "line",
    smooth: true,
    symbol: isConcentration ? "circle" : "diamond",
    symbolSize: 8,
    data: grouped.flashe,
    itemStyle: { color: cfg.colorFlashe },
    lineStyle: { width: 3, type: isConcentration ? "solid" : "dashed", color: cfg.colorFlashe },
    areaStyle: {
      color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: cfg.colorFlashe + "33" },
        { offset: 1, color: cfg.colorFlashe + "05" }
      ])
    }
  });

  const option = {
    animationDuration: 800,
    animationEasing: "cubicOut",
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(255,255,255,0.95)",
      borderColor: "#e2e8f0",
      textStyle: { color: "#0f172a", fontFamily: "Inter" },
      formatter: function (params) {
        let html = `<strong>${params[0].name}</strong><br/>`;
        params.forEach(p => {
          html += `${p.marker} ${p.seriesName} : <strong>${p.value}</strong><br/>`;
        });
        return html;
      }
    },
    legend: {
      data: legendData,
      bottom: 0,
      textStyle: { fontFamily: "Inter", color: "#475569" }
    },
    grid: {
      left: "3%", right: "4%", bottom: "15%", top: "10%", containLabel: true
    },
    xAxis: {
      type: "category",
      data: grouped.categories,
      axisLine: { lineStyle: { color: "#cbd5e1" } },
      axisLabel: { color: "#64748b", fontFamily: "Inter", rotate: grouped.categories.length > 15 ? 45 : 0 }
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "#f1f5f9" } },
      axisLabel: { color: "#64748b", fontFamily: "Inter" }
    },
    dataZoom: [
      { type: "inside", start: 0, end: 100 },
      { type: "slider", start: 0, end: 100, bottom: 30, height: 20 }
    ],
    series: seriesList
  };

  chart.setOption(option, true);
}

/* ============================================================
   TABLEAUX HTML
   ============================================================ */

function updateTable(sectionType, data) {
  const tableId = SECTION_CONFIG[sectionType].table;
  const tbody = document.querySelector(`#${tableId} tbody`);
  if (!tbody) return;

  const isConcentration = sectionType === "Concentration";
  const colCount = isConcentration ? 4 : 5;

  const filters = getFiltersForSection(sectionType);
  const filtered = filterData(data, filters);

  tbody.innerHTML = "";

  if (filtered.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="${colCount}" class="no-data-message">Aucune donnée pour les filtres sélectionnés</td>`;
    tbody.appendChild(tr);
    return;
  }

  const sorted = [...filtered].sort((a, b) => {
    const typeCompare = (a.type || "").localeCompare(b.type || "");
    if (typeCompare !== 0) return typeCompare;
    return (a.date || 0) - (b.date || 0);
  });

  sorted.forEach(row => {
    const realIndex = appData.indexOf(row);
    const tr = document.createElement("tr");
    if (isConcentration) {
      tr.innerHTML = `
        <td>${row.type}</td>
        <td>${fmtDate(row.date)}</td>
        <td>${row.colisFlashe}</td>
        <td>
          <button class="btn-icon btn-edit" data-index="${realIndex}" title="Modifier">✏️</button>
          <button class="btn-icon btn-delete" data-index="${realIndex}" title="Supprimer">🗑️</button>
        </td>
      `;
    } else {
      tr.innerHTML = `
        <td>${row.type}</td>
        <td>${fmtDate(row.date)}</td>
        <td>${row.colisAnnonces}</td>
        <td>${row.colisFlashe}</td>
        <td>
          <button class="btn-icon btn-edit" data-index="${realIndex}" title="Modifier">✏️</button>
          <button class="btn-icon btn-delete" data-index="${realIndex}" title="Supprimer">🗑️</button>
        </td>
      `;
    }
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".btn-edit").forEach(btn => {
    btn.addEventListener("click", () => editRow(parseInt(btn.dataset.index, 10)));
  });
  tbody.querySelectorAll(".btn-delete").forEach(btn => {
    btn.addEventListener("click", () => deleteRow(parseInt(btn.dataset.index, 10)));
  });
}

/* ============================================================
   ORCHESTRATION PAR SECTION
   ============================================================ */

function renderSection(sectionType) {
  const sectionData = appData.filter(r => r.type === sectionType);
  updateChart(sectionType, sectionData);
  updateTable(sectionType, sectionData);
}

function renderAllSections() {
  SECTION_TYPES.forEach(type => renderSection(type));
}

/* ============================================================
   EXPORT PNG
   ============================================================ */

function exportChartPNG(sectionType) {
  const chart = chartInstances[sectionType];
  if (!chart) return;
  const url = chart.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#fff" });
  const a = document.createElement("a");
  a.href = url;
  a.download = `graphique-${sectionType.replace(/\s+/g, "_").toLowerCase()}.png`;
  a.click();
}

/* ============================================================
   EXPORT EXCEL PAR SECTION
   ============================================================ */

function exportSectionExcel(sectionType) {
  const sectionData = appData.filter(r => r.type === sectionType);
  if (sectionData.length === 0) {
    alert("Aucune donnée à exporter pour cette section.");
    return;
  }

  const isConcentration = sectionType === "Concentration";
  const headers = isConcentration
    ? ["Type", "Date", "Colis Flashé"]
    : ["Type", "Date", "Colis annoncés", "Colis Flashé"];

  const rows = sectionData.map(row => {
    const dateStr = fmtDate(row.date);
    if (isConcentration) {
      return [row.type, dateStr, row.colisFlashe];
    }
    return [row.type, dateStr, row.colisAnnonces, row.colisFlashe];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Données");
  XLSX.writeFile(wb, `export-${sectionType.replace(/\s+/g, "_").toLowerCase()}.xlsx`);
}

/* ============================================================
   RÉINITIALISATION
   ============================================================ */

function clearAllData() {
  if (!confirm("Voulez-vous vraiment supprimer toutes les données ?")) return;

  appData = [];
  localStorage.removeItem(STORAGE_KEY);
  updateStatus(false);

  SECTION_TYPES.forEach(type => {
    renderEmptyChart(type);
    const tableId = SECTION_CONFIG[type].table;
    const tbody = document.querySelector(`#${tableId} tbody`);
    const colCount = type === "Concentration" ? 4 : 5;
    if (tbody) tbody.innerHTML = `<tr><td colspan="${colCount}" class="no-data-message">Aucune donnée — importez un fichier Excel</td></tr>`;
    populateFilters(type);
  });

  document.querySelectorAll(".filters-bar select").forEach(sel => {
    if (sel.classList.contains("filter-granularity")) {
      sel.value = "day";
    } else {
      sel.innerHTML = '<option value="">Tous</option>';
    }
  });
}

/* ============================================================
   MODAL — AJOUT / ÉDITION
   ============================================================ */

function openModal(sectionType, editIdx) {
  currentModalSection = sectionType;
  editingIndex = editIdx !== undefined ? editIdx : null;

  const overlay = document.getElementById("modal-overlay");
  const title = document.getElementById("modal-title");
  const typeSelect = document.getElementById("modal-type");
  const dateInput = document.getElementById("modal-date");
  const annoncesInput = document.getElementById("modal-annonces");
  const flasheInput = document.getElementById("modal-flashe");
  const annoncesGroup = document.getElementById("modal-annonces-group");
  const saveBtn = document.getElementById("modal-save");

  typeSelect.innerHTML = "";
  SECTION_TYPES.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    typeSelect.appendChild(opt);
  });

  if (editingIndex !== null) {
    const row = appData[editingIndex];
    title.textContent = "Modifier une entrée";
    typeSelect.value = row.type;
    dateInput.value = formatISODate(row.date);
    flasheInput.value = row.colisFlashe;
    if (row.type === "Concentration") {
      annoncesGroup.style.display = "none";
      annoncesInput.value = 0;
    } else {
      annoncesGroup.style.display = "flex";
      annoncesInput.value = row.colisAnnonces;
    }
    saveBtn.textContent = "💾 Modifier";
  } else {
    title.textContent = "Ajouter une entrée";
    typeSelect.value = sectionType;
    dateInput.value = "";
    flasheInput.value = 0;
    if (sectionType === "Concentration") {
      annoncesGroup.style.display = "none";
      annoncesInput.value = 0;
    } else {
      annoncesGroup.style.display = "flex";
      annoncesInput.value = 0;
    }
    saveBtn.textContent = "💾 Valider";
  }

  typeSelect.addEventListener("change", () => {
    if (typeSelect.value === "Concentration") {
      annoncesGroup.style.display = "none";
    } else {
      annoncesGroup.style.display = "flex";
    }
  });

  overlay.style.display = "flex";
}

function closeModal() {
  document.getElementById("modal-overlay").style.display = "none";
  editingIndex = null;
  currentModalSection = null;
}

function handleModalSave() {
  const typeVal = document.getElementById("modal-type").value;
  const dateVal = document.getElementById("modal-date").value;
  const annoncesInput = document.getElementById("modal-annonces");
  const flasheInput = document.getElementById("modal-flashe");

  if (!dateVal) {
    alert("Veuillez sélectionner une date.");
    return;
  }

  const dateObj = new Date(dateVal);
  if (isNaN(dateObj)) {
    alert("Date invalide.");
    return;
  }

  const key = `${typeVal}|${dateObj.toISOString()}`;
  const existingIndex = appData.findIndex((r, idx) => idx !== editingIndex && `${r.type}|${r.date?.toISOString()}` === key);

  if (existingIndex !== -1) {
    if (!confirm("Une entrée existe déjà pour ce type et cette date. Voulez-vous la remplacer ?")) return;
    appData[existingIndex] = {
      type: typeVal,
      date: dateObj,
      colisAnnonces: annoncesInput && annoncesInput.parentElement.style.display !== "none" ? parseInt(annoncesInput.value, 10) || 0 : 0,
      colisFlashe: parseInt(flasheInput.value, 10) || 0
    };
    if (editingIndex !== null && editingIndex !== existingIndex) {
      appData.splice(editingIndex, 1);
    }
  } else if (editingIndex !== null) {
    appData[editingIndex] = {
      type: typeVal,
      date: dateObj,
      colisAnnonces: annoncesInput && annoncesInput.parentElement.style.display !== "none" ? parseInt(annoncesInput.value, 10) || 0 : 0,
      colisFlashe: parseInt(flasheInput.value, 10) || 0
    };
  } else {
    appData.push({
      type: typeVal,
      date: dateObj,
      colisAnnonces: annoncesInput && annoncesInput.parentElement.style.display !== "none" ? parseInt(annoncesInput.value, 10) || 0 : 0,
      colisFlashe: parseInt(flasheInput.value, 10) || 0
    });
  }

  saveToLocalStorage();
  populateFilters(typeVal);
  renderSection(typeVal);
  if (currentModalSection && currentModalSection !== typeVal) {
    renderSection(currentModalSection);
  }
  closeModal();
  alert(editingIndex !== null ? "Donnée modifiée avec succès." : "Donnée enregistrée avec succès.");
}

/* ============================================================
   ÉDITION & SUPPRESSION
   ============================================================ */

function editRow(index) {
  if (index < 0 || index >= appData.length) return;
  openModal(appData[index].type, index);
}

function deleteRow(index) {
  if (index < 0 || index >= appData.length) return;
  if (!confirm("Voulez-vous vraiment supprimer cette ligne ?")) return;

  const deletedType = appData[index].type;
  appData.splice(index, 1);
  saveToLocalStorage();
  populateFilters(deletedType);
  renderSection(deletedType);
  updateStatus(appData.length > 0);
}

/* ============================================================
   ÉCOUTEURS D'ÉVÉNEMENTS
   ============================================================ */

function attachEventListeners() {
  document.querySelectorAll(".file-input").forEach(input => {
    input.addEventListener("change", e => {
      const section = e.target.dataset.section;
      handleFileImport(e, section);
    });
  });

  document.querySelectorAll(".btn-export").forEach(btn => {
    btn.addEventListener("click", () => {
      exportChartPNG(btn.dataset.section);
    });
  });

  document.querySelectorAll(".btn-export-excel").forEach(btn => {
    btn.addEventListener("click", () => {
      exportSectionExcel(btn.dataset.section);
    });
  });

  document.querySelectorAll(".filters-bar select").forEach(sel => {
    sel.addEventListener("change", () => {
      const section = sel.dataset.section;
      renderSection(section);
    });
  });

  document.querySelectorAll(".btn-add-manual").forEach(btn => {
    btn.addEventListener("click", () => {
      openModal(btn.dataset.section, null);
    });
  });

  const resetBtn = document.getElementById("btn-reset-all");
  if (resetBtn) resetBtn.addEventListener("click", clearAllData);

  const modalClose = document.getElementById("modal-close-btn");
  if (modalClose) modalClose.addEventListener("click", closeModal);

  const modalCancel = document.getElementById("modal-cancel");
  if (modalCancel) modalCancel.addEventListener("click", closeModal);

  const modalSave = document.getElementById("modal-save");
  if (modalSave) modalSave.addEventListener("click", handleModalSave);

  document.getElementById("modal-overlay").addEventListener("click", e => {
    if (e.target === document.getElementById("modal-overlay")) closeModal();
  });
}

/* ============================================================
   POINT D'ENTRÉE
   ============================================================ */

function initApp() {
  initCharts();
  attachEventListeners();

  if (loadFromLocalStorage()) {
    SECTION_TYPES.forEach(type => {
      populateFilters(type);
      renderSection(type);
    });
  } else {
    SECTION_TYPES.forEach(type => {
      const tableId = SECTION_CONFIG[type].table;
      const tbody = document.querySelector(`#${tableId} tbody`);
      const colCount = type === "Concentration" ? 4 : 5;
      if (tbody) tbody.innerHTML = `<tr><td colspan="${colCount}" class="no-data-message">Aucune donnée — importez un fichier Excel</td></tr>`;
    });
  }
}

document.addEventListener("DOMContentLoaded", initApp);

