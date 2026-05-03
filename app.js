/**
 * ============================================================
 * TABLEAU DE BORD ANALYTIQUE — Logique métier
 * ============================================================
 * Gère l'import Excel (SheetJS), la visualisation (ECharts),
 * les filtres, le regroupement, le localStorage, l'export PNG,
 * l'édition/suppression des lignes et l'export Excel.
 * Modèle de données : { type, date, colisAnnonces, colisFlashe }
 * + Gestion des sections dynamiques
 */

/* ============================================================
   CONFIGURATION & ÉTAT GLOBAL
   ============================================================ */

/** Types de sections supportés (les 5 par défaut) */
const DEFAULT_SECTION_TYPES = [
  "Dispersion 14h",
  "Arrivée 14h",
  "Dispersion 18h",
  "Arrivée 18h",
  "Concentration"
];

/** Mapping type -> IDs DOM + couleurs double série */
const DEFAULT_SECTION_CONFIG = {
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

/** Sections dynamiques (chargées depuis localStorage) */
let customSections = [];

/** Ordre des sections (chargé depuis localStorage) */
let sectionOrder = [];

/** Clé localStorage pour les sections personnalisées */
const CUSTOM_SECTIONS_KEY = "agc_custom_sections";

/** Clé localStorage pour l'ordre des sections */
const SECTION_ORDER_KEY = "agc_section_order";

/** Clé localStorage */
const STORAGE_KEY = "agc_dashboard_data";

/** Données en mémoire : tableau d'objets { type, date, colisAnnonces, colisFlashe } */
let appData = [];

/** Instances ECharts par type */
const chartInstances = {};

/** État des tris de tableaux { sectionName: 'asc' | 'desc' } */
const tableSortStates = {};

/** Édition en cours : index dans appData, ou null */
let editingIndex = null;

/** Section courante pour la modal */
let currentModalSection = null;

/** Edition de section en cours (pour les sections dynamiques) */
let editingSectionId = null;

/** Clés localStorage pour le backup */
const BACKUP_KEYS = [STORAGE_KEY, CUSTOM_SECTIONS_KEY, SECTION_ORDER_KEY];

/** État global des types et configs */
let SECTION_TYPES = [];
let SECTION_CONFIG = {};

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
      colisFlashe: row.colisFlashe,
      dynamicFields: row.dynamicFields
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
      colisFlashe: row.colisFlashe || 0,
      dynamicFields: row.dynamicFields || {}
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

  const rawHeaders = json[0].map(h => String(h).trim());
  const normalizedHeaders = rawHeaders.map(h => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  
  const idxType = normalizedHeaders.findIndex(h => h.includes("type"));
  const idxDate = normalizedHeaders.findIndex(h => h.includes("date"));

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

    const customSec = customSections.find(s => s.name === typeVal);
    
    if (customSec) {
      const dynamicFields = {};
      customSec.fields.forEach(field => {
        const fieldIdx = rawHeaders.findIndex(h => h.trim().toLowerCase() === field.name.toLowerCase());
        dynamicFields[field.name] = fieldIdx !== -1 ? parseNumber(r[fieldIdx]) : 0;
      });
      rows.push({ type: typeVal, date: dateVal, dynamicFields });
    } else {
      const idxAnnonces = normalizedHeaders.findIndex(h => h.includes("annonce"));
      const idxFlashe = normalizedHeaders.findIndex(h => h.includes("flash"));
      rows.push({
        type: typeVal,
        date: dateVal,
        colisAnnonces: idxAnnonces !== -1 ? parseNumber(r[idxAnnonces]) : 0,
        colisFlashe: idxFlashe !== -1 ? parseNumber(r[idxFlashe]) : 0
      });
    }
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
  if (!type) return "sec-" + Math.random().toString(36).substr(2, 9);
  return type.toLowerCase()
             .normalize("NFD")
             .replace(/[\u0300-\u036f]/g, "")
             .replace(/[^a-z0-9]/g, "-")
             .replace(/-+/g, "-")
             .replace(/^-|-$/g, "");
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

/** Get all field names for a section type (including dynamic fields) */
function getFieldNamesForSection(sectionType) {
  const customSec = customSections.find(s => s.name === sectionType);
  if (customSec && customSec.fields && customSec.fields.length > 0) {
    return customSec.fields.map(f => f.name);
  }
  // Default fields for standard sections
  return sectionType === "Concentration" ? ["colisFlashe"] : ["colisAnnonces", "colisFlashe"];
}

function groupDataDouble(filteredData, granularity, sectionType) {
  const map = new Map();
  
  // Get field names for this section type
  const fieldNames = getFieldNamesForSection(sectionType || (filteredData[0] ? filteredData[0].type : null));
  
  filteredData.forEach(row => {
    const d = row.date;
    if (!d || isNaN(d)) return;
    
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
      // Initialize with zeros for all field names
      const entry = {};
      fieldNames.forEach(fn => entry[fn] = 0);
      map.set(key, entry);
    }
    
    const entry = map.get(key);
    
    // Add values for each field
    fieldNames.forEach(fieldName => {
      if (row.dynamicFields && row.dynamicFields[fieldName] !== undefined) {
        entry[fieldName] += parseNumber(row.dynamicFields[fieldName]) || 0;
      } else if (row.colisAnnonces !== undefined && fieldName === "colisAnnonces") {
        entry[fieldName] += parseNumber(row.colisAnnonces) || 0;
      } else if (row.colisFlashe !== undefined && fieldName === "colisFlashe") {
        entry[fieldName] += parseNumber(row.colisFlashe) || 0;
      }
    });
  });
  
  const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  
  // Return structured data for chart
  const result = { categories: sorted.map(e => e[0]) };
  fieldNames.forEach(fn => {
    result[fn] = sorted.map(e => e[1][fn]);
  });
  
  return result;
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
    const cfg = SECTION_CONFIG[type];
    if (!cfg) return;
    const dom = document.getElementById(cfg.chart);
    if (!dom) return;

    // On dispose proprement l'instance existante pour éviter les conflits
    if (chartInstances[type]) {
      chartInstances[type].dispose();
    }
    
    chartInstances[type] = echarts.init(dom, null, { renderer: 'canvas', useDirtyRect: false });
    renderEmptyChart(type);
    
    // Observer pour le redimensionnement automatique (ex: ouverture details)
    const ro = new ResizeObserver(() => {
      if (chartInstances[type]) chartInstances[type].resize();
    });
    ro.observe(dom);
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

  chart.resize();

  if (data.length === 0) {
    renderEmptyChart(sectionType);
    return;
  }

  const filters = getFiltersForSection(sectionType);
  const filtered = filterData(data, filters);
  const grouped = groupDataDouble(filtered, filters.granularity, sectionType);

  if (grouped.categories.length === 0) {
    renderEmptyChart(sectionType);
    return;
  }

  const cfg = SECTION_CONFIG[sectionType];
  
  const customSec = customSections.find(s => s.name === sectionType);
  const chartType = customSec ? customSec.chartType : "line";

  // Fallback pour les sections par défaut si customSec n'est pas trouvé
  const fields = customSec ? customSec.fields : (sectionType === "Concentration" ? [{name:"colisFlashe", color:"#D97706"}] : [{name:"colisAnnonces", color:"#2563EB"}, {name:"colisFlashe", color:"#93C5FD"}]);

  const seriesList = [];
  const legendNames = [];
  
  fields.forEach((field, idx) => {
    const fieldData = grouped[field.name] || [];
    const fieldColor = field.color || "#2563EB";
    const displayName = field.name === "colisAnnonces" ? "Colis annoncé" : (field.name === "colisFlashe" ? "Colis Flashé" : field.name);
    
    legendNames.push(displayName);
    
    seriesList.push({
      name: displayName,
      type: chartType,
      smooth: chartType === "line",
      showSymbol: chartType === "line",
      symbol: 'circle',
      symbolSize: 8,
      data: fieldData,
      itemStyle: chartType === "bar" ? { 
        color: fieldColor,
        borderRadius: [6, 6, 0, 0] // Arrondis sur les barres
      } : { color: fieldColor, borderColor: '#fff', borderWidth: 2 },
      lineStyle: chartType === "line" ? { 
        width: 4, 
        color: fieldColor,
        shadowBlur: 12,
        shadowColor: 'rgba(0,0,0,0.2)',
        shadowOffsetY: 6
      } : undefined,
      areaStyle: chartType === "line" ? {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: fieldColor + '44' },
          { offset: 1, color: fieldColor + '00' }
        ])
      } : undefined,
      barMaxWidth: chartType === "bar" ? 40 : undefined,
      emphasis: { focus: 'series' }
    });
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
      data: legendNames,
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
  const cfg = SECTION_CONFIG[sectionType];
  if (!cfg) return;
  const table = document.getElementById(cfg.table);
  if (!table) return;
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");

  // Get field names for this section type
  const fieldNames = getFieldNamesForSection(sectionType);

  // Gestion du tri
  const sortOrder = tableSortStates[sectionType] || 'desc';

  // Correction : Mise à jour dynamique de l'en-tête pour éviter le décalage des colonnes
  let headerHtml = `<tr><th>Type</th><th>Date</th>`;
  
  // On vide et reconstruit pour attacher les listeners proprement
  thead.innerHTML = "";
  const trHeader = document.createElement("tr");
  trHeader.innerHTML = `<th>Type</th><th class="sortable-header" style="cursor:pointer; color:#2563EB" title="Trier par date">Date ${sortOrder === 'asc' ? '↑' : '↓'}</th>`;
  
  fieldNames.forEach(name => {
    const label = name === "colisAnnonces" ? "Colis annoncé" : (name === "colisFlashe" ? "Colis Flashé" : name);
    trHeader.innerHTML += `<th>${label}</th>`;
  });
  trHeader.innerHTML += `<th>Actions</th>`;
  thead.appendChild(trHeader);

  trHeader.querySelector(".sortable-header").addEventListener("click", () => {
    tableSortStates[sectionType] = sortOrder === 'asc' ? 'desc' : 'asc';
    updateTable(sectionType, data);
  });

  const filters = getFiltersForSection(sectionType);
  const filtered = filterData(data, filters);

  const badge = document.getElementById(`badge-${sectionTypeToSlug(sectionType)}`);
  if (badge) {
    badge.textContent = `${filtered.length} ligne${filtered.length > 1 ? 's' : ''}`;
    if (filtered.length > 0) {
      badge.classList.add("active");
    } else {
      badge.classList.remove("active");
    }
  }

  tbody.innerHTML = "";
  const colCount = fieldNames.length + 3; // Type + Date + Actions = 3

  if (filtered.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="${colCount}" class="no-data-message">Aucune donnée pour les filtres sélectionnés</td>`;
    tbody.appendChild(tr);
    return;
  }

  const sorted = [...filtered].sort((a, b) => {
    const dateA = a.date ? a.date.getTime() : 0;
    const dateB = b.date ? b.date.getTime() : 0;
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });

  sorted.forEach(row => {
    const realIndex = appData.indexOf(row);
    const tr = document.createElement("tr");
    
    // Build table cells dynamically based on field names
    let cellsHtml = `<td>${row.type}</td><td>${fmtDate(row.date)}</td>`;
    
    fieldNames.forEach(fieldName => {
      let fieldValue = 0;
      
      // Get value from dynamicFields or use default field names
      if (row.dynamicFields && row.dynamicFields[fieldName] !== undefined) {
        fieldValue = row.dynamicFields[fieldName];
      } else if (row.colisAnnonces !== undefined && fieldName === "colisAnnonces") {
        fieldValue = row.colisAnnonces;
      } else if (row.colisFlashe !== undefined && fieldName === "colisFlashe") {
        fieldValue = row.colisFlashe;
      }
      
      cellsHtml += `<td>${fieldValue}</td>`;
    });
    
    cellsHtml += `
      <td>
        <button class="btn-icon btn-edit" data-index="${realIndex}" title="Modifier">✏️</button>
        <button class="btn-icon btn-delete" data-index="${realIndex}" title="Supprimer">🗑️</button>
      </td>
    `;
    
    tr.innerHTML = cellsHtml;
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

  const fieldNames = getFieldNamesForSection(sectionType);
  const headers = ["Type", "Date", ...fieldNames.map(fn => fn === "colisAnnonces" ? "Colis annoncé" : (fn === "colisFlashe" ? "Colis Flashé" : fn))];

  const rows = sectionData.map(row => {
    const base = [row.type, fmtDate(row.date)];
    const fieldValues = fieldNames.map(fn => {
      if (row.dynamicFields && row.dynamicFields[fn] !== undefined) return row.dynamicFields[fn];
      if (fn === "colisAnnonces") return row.colisAnnonces || 0;
      if (fn === "colisFlashe") return row.colisFlashe || 0;
      return 0;
    });
    return [...base, ...fieldValues];
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
    const colCount = getFieldNamesForSection(type).length + 3;
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
  
  // Container for dynamic fields
  const dynamicFieldsContainer = document.getElementById("modal-dynamic-fields");

  typeSelect.innerHTML = "";
  SECTION_TYPES.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    typeSelect.appendChild(opt);
  });

  // Find custom section config
  const customSec = customSections.find(s => s.name === sectionType);
  const isCustomSection = customSec && customSec.fields && customSec.fields.length > 0;

  if (editingIndex !== null) {
    const row = appData[editingIndex];
    title.textContent = "Modifier une entrée";
    typeSelect.value = row.type;
    dateInput.value = formatISODate(row.date);
    
    // Check if it's a custom section with dynamic fields
    const rowCustomSec = customSections.find(s => s.name === row.type);
    const isRowCustomSection = rowCustomSec && rowCustomSec.fields && rowCustomSec.fields.length > 0;
    
    if (isRowCustomSection) {
      // Hide default fields, show dynamic fields
      if (annoncesGroup) annoncesGroup.style.display = "none";
      const flasheGroup = flasheInput?.closest(".form-group");
      if (flasheGroup) flasheGroup.style.display = "none";
      
      // Generate dynamic fields with values from row
      renderDynamicFieldsInModal(rowCustomSec, row);
    } else if (row.type === "Concentration") {
      if (annoncesGroup) annoncesGroup.style.display = "none";
      flasheInput.value = row.colisFlashe;
      if (dynamicFieldsContainer) dynamicFieldsContainer.innerHTML = "";
    } else {
      if (annoncesGroup) annoncesGroup.style.display = "flex";
      const flasheGroup = flasheInput?.closest(".form-group");
      if (flasheGroup) flasheGroup.style.display = "flex";
      annoncesInput.value = row.colisAnnonces;
      flasheInput.value = row.colisFlashe;
      if (dynamicFieldsContainer) dynamicFieldsContainer.innerHTML = "";
    }
    saveBtn.textContent = "💾 Modifier";
  } else {
    title.textContent = "Ajouter une entrée";
    typeSelect.value = sectionType;
    dateInput.value = "";
    
    if (isCustomSection) {
      // Hide default fields, show dynamic fields for new custom section
      if (annoncesGroup) annoncesGroup.style.display = "none";
      const flasheGroup = flasheInput?.closest(".form-group");
      if (flasheGroup) flasheGroup.style.display = "none";
      
      // Generate dynamic fields with default values
      renderDynamicFieldsInModal(customSec, null);
    } else if (sectionType === "Concentration") {
      if (annoncesGroup) annoncesGroup.style.display = "none";
      flasheInput.value = 0;
      if (dynamicFieldsContainer) dynamicFieldsContainer.innerHTML = "";
    } else {
      if (annoncesGroup) annoncesGroup.style.display = "flex";
      const flasheGroup = flasheInput?.closest(".form-group");
      if (flasheGroup) flasheGroup.style.display = "flex";
      annoncesInput.value = 0;
      flasheInput.value = 0;
      if (dynamicFieldsContainer) dynamicFieldsContainer.innerHTML = "";
    }
    saveBtn.textContent = "💾 Valider";
  }

// Check if the selected type is a custom section
  typeSelect.addEventListener("change", () => {
    const selectedType = typeSelect.value;
    const customSecNew = customSections.find(s => s.name === selectedType);
    
    if (customSecNew && customSecNew.fields && customSecNew.fields.length > 0) {
      // Hide default fields for custom sections
      if (annoncesGroup) annoncesGroup.style.display = "none";
      const flasheGroup = document.getElementById("modal-flashe")?.closest(".form-group");
      if (flasheGroup) flasheGroup.style.display = "none";
      
      // Generate dynamic fields
      renderDynamicFieldsInModal(customSecNew, null);
    } else if (selectedType === "Concentration") {
      if (annoncesGroup) annoncesGroup.style.display = "none";
      const flasheGroup = document.getElementById("modal-flashe")?.closest(".form-group");
      if (flasheGroup) flasheGroup.style.display = "flex";
      // Clear dynamic fields
      const dynContainer = document.getElementById("modal-dynamic-fields");
      if (dynContainer) dynContainer.innerHTML = "";
    } else {
      if (annoncesGroup) annoncesGroup.style.display = "flex";
      const flasheGroup = document.getElementById("modal-flashe")?.closest(".form-group");
      if (flasheGroup) flasheGroup.style.display = "flex";
      // Clear dynamic fields
      const dynContainer = document.getElementById("modal-dynamic-fields");
      if (dynContainer) dynContainer.innerHTML = "";
    }
  });

  overlay.style.display = "flex";
}

/** Render dynamic fields in the modal based on custom section configuration */
function renderDynamicFieldsInModal(customSec, existingRow) {
  const container = document.getElementById("modal-dynamic-fields");
  if (!container) return;
  
  container.innerHTML = "";
  
  if (!customSec || !customSec.fields || customSec.fields.length === 0) {
    return;
  }
  
  customSec.fields.forEach((field, idx) => {
    const formGroup = document.createElement("div");
    formGroup.className = "form-group";
    
    const label = document.createElement("label");
    label.textContent = field.name;
    
    const input = document.createElement("input");
    input.type = "number";
    input.className = "dynamic-field-input";
    input.dataset.fieldName = field.name;
    input.min = "0";
    
    // Get value from existing row or use default
    if (existingRow && existingRow.dynamicFields && existingRow.dynamicFields[field.name] !== undefined) {
      input.value = existingRow.dynamicFields[field.name];
    } else {
      input.value = field.value || 0;
    }
    
    formGroup.appendChild(label);
    formGroup.appendChild(input);
    container.appendChild(formGroup);
  });
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
  const dynamicFieldsContainer = document.getElementById("modal-dynamic-fields");

  if (!dateVal) {
    alert("Veuillez sélectionner une date.");
    return;
  }

  const dateObj = new Date(dateVal);
  if (isNaN(dateObj)) {
    alert("Date invalide.");
    return;
  }

  // Check if it's a custom section with dynamic fields
  const customSec = customSections.find(s => s.name === typeVal);
  const isCustomSection = customSec && customSec.fields && customSec.fields.length > 0;
  
  // Collect dynamic field values if present
  const dynamicFields = {};
  if (isCustomSection && dynamicFieldsContainer) {
    dynamicFieldsContainer.querySelectorAll(".dynamic-field-input").forEach(input => {
      const fieldName = input.dataset.fieldName;
      dynamicFields[fieldName] = parseInt(input.value, 10) || 0;
    });
  }

  const key = `${typeVal}|${dateObj.toISOString()}`;
  const existingIndex = appData.findIndex((r, idx) => idx !== editingIndex && `${r.type}|${r.date?.toISOString()}` === key);

  if (existingIndex !== -1) {
    if (!confirm("Une entrée existe déjà pour ce type et cette date. Voulez-vous la remplacer ?")) return;
    
    if (isCustomSection) {
      // Save custom section data with dynamic fields
      appData[existingIndex] = {
        type: typeVal,
        date: dateObj,
        dynamicFields: dynamicFields
      };
    } else {
      appData[existingIndex] = {
        type: typeVal,
        date: dateObj,
        colisAnnonces: annoncesInput && annoncesInput.parentElement.style.display !== "none" ? parseInt(annoncesInput.value, 10) || 0 : 0,
        colisFlashe: parseInt(flasheInput.value, 10) || 0
      };
    }
    if (editingIndex !== null && editingIndex !== existingIndex) {
      appData.splice(editingIndex, 1);
    }
  } else if (editingIndex !== null) {
    
    if (isCustomSection) {
      // Save custom section data with dynamic fields
      appData[editingIndex] = {
        type: typeVal,
        date: dateObj,
        dynamicFields: dynamicFields
      };
    } else {
      appData[editingIndex] = {
        type: typeVal,
        date: dateObj,
        colisAnnonces: annoncesInput && annoncesInput.parentElement.style.display !== "none" ? parseInt(annoncesInput.value, 10) || 0 : 0,
        colisFlashe: parseInt(flasheInput.value, 10) || 0
      };
    }
  } else {
    
    if (isCustomSection) {
      // Save custom section data with dynamic fields
      appData.push({
        type: typeVal,
        date: dateObj,
        dynamicFields: dynamicFields
      });
    } else {
      appData.push({
        type: typeVal,
        date: dateObj,
        colisAnnonces: annoncesInput && annoncesInput.parentElement.style.display !== "none" ? parseInt(annoncesInput.value, 10) || 0 : 0,
        colisFlashe: parseInt(flasheInput.value, 10) || 0
      });
    }
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
  const resetBtn = document.getElementById("btn-reset-all");
  if (resetBtn) resetBtn.addEventListener("click", clearAllData);

  // Menu Burger
  const burgerBtn = document.getElementById("burger-btn");
  const headerMenu = document.getElementById("header-menu");
  if (burgerBtn && headerMenu) {
    burgerBtn.addEventListener("click", () => {
      burgerBtn.classList.toggle("open");
      headerMenu.classList.toggle("active");
    });
  }

  // Bouton Info
  const btnInfo = document.getElementById("btn-info");
  if (btnInfo) btnInfo.addEventListener("click", () => {
    document.getElementById("modal-help-overlay").style.display = "flex";
  });

  // Sauvegarde & Import (Backup)
  const exportBackupBtn = document.getElementById("btn-export-backup");
  if (exportBackupBtn) exportBackupBtn.addEventListener("click", exportFullBackup);

  const importBackupInput = document.getElementById("btn-import-backup");
  if (importBackupInput) importBackupInput.addEventListener("change", importFullBackup);

  const modalClose = document.getElementById("modal-close-btn");
  if (modalClose) modalClose.addEventListener("click", closeModal);

  const modalCancel = document.getElementById("modal-cancel");
  if (modalCancel) modalCancel.addEventListener("click", closeModal);

  const modalSave = document.getElementById("modal-save");
  if (modalSave) modalSave.addEventListener("click", handleModalSave);

document.getElementById("modal-overlay").addEventListener("click", e => {
    if (e.target === document.getElementById("modal-overlay")) closeModal();
  });

  // === Gestion des sections dynamiques ===

  // Bouton "Ajouter une section"
  const btnAddSection = document.getElementById("btn-add-section");
  if (btnAddSection) btnAddSection.addEventListener("click", () => openSectionModal());

  // Fermer la modal de section
  const modalSectionClose = document.getElementById("modal-section-close-btn");
  if (modalSectionClose) modalSectionClose.addEventListener("click", closeSectionModal);

  const modalSectionCancel = document.getElementById("modal-section-cancel");
  if (modalSectionCancel) modalSectionCancel.addEventListener("click", closeSectionModal);

  const modalSectionSave = document.getElementById("modal-section-save");
  if (modalSectionSave) modalSectionSave.addEventListener("click", handleSectionSave);

  document.getElementById("modal-section-overlay").addEventListener("click", e => {
    if (e.target === document.getElementById("modal-section-overlay")) closeSectionModal();
  });

  // Ajouter un champ dynamique
  const btnAddField = document.getElementById("btn-add-field");
  if (btnAddField) btnAddField.addEventListener("click", () => addDynamicField());

  // Color presets
  document.querySelectorAll(".color-preset").forEach(btn => {
    btn.addEventListener("click", e => {
      const color = e.target.dataset.color;
      document.getElementById("modal-section-color").value = color;
      document.querySelectorAll(".color-preset").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
    });
  });
}

/* ============================================================
   FONCTIONS DE SAUVEGARDE COMPLÈTE (JSON)
   ============================================================ */

/** Exporte tout le dashboard (Config + Données) pour transfert */
function exportFullBackup() {
  const backup = {
    version: "1.1",
    timestamp: new Date().toISOString(),
    appData,
    customSections,
    sectionOrder
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup_dashboard_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Importe tout le dashboard depuis un fichier JSON */
function importFullBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const backup = JSON.parse(e.target.result);
      if (!backup.customSections || !backup.appData) throw new Error("Format de fichier invalide");
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(backup.appData));
      localStorage.setItem(CUSTOM_SECTIONS_KEY, JSON.stringify(backup.customSections));
      localStorage.setItem(SECTION_ORDER_KEY, JSON.stringify(backup.sectionOrder || []));
      
      alert("Restauration réussie !");
      location.reload();
    } catch (err) {
      alert("Erreur d'importation : " + err.message);
    }
  };
  reader.readAsText(file);
}

/* ============================================================
   GESTION DES SECTIONS DYNAMIQUES
   ============================================================ */

/** Couleurs prédéfinies */
const COLOR_PRESETS = [
  "#2563EB", "#059669", "#7C3AED", "#DC2626", "#D97706",
  "#0891B2", "#BE185D", "#15803D", "#4F46E5", "#EA580C"
];

/** Charger les sections personnalisées depuis localStorage */
function loadCustomSections() {
  try {
    const raw = localStorage.getItem(CUSTOM_SECTIONS_KEY);
    if (raw) {
      customSections = JSON.parse(raw);
    }
    const orderRaw = localStorage.getItem(SECTION_ORDER_KEY);
    if (orderRaw) {
      sectionOrder = JSON.parse(orderRaw);
    } else {
      sectionOrder = customSections.map(s => s.id);
      saveCustomSections();
    }
    // Synchroniser SECTION_TYPES
    SECTION_TYPES = customSections.map(s => s.name);
  } catch (e) {
    console.error("Erreur chargement sections:", e);
  }
}

/** Sauvegarder les sections et l'ordre */
function saveCustomSections() {
  try {
    localStorage.setItem(CUSTOM_SECTIONS_KEY, JSON.stringify(customSections));
    localStorage.setItem(SECTION_ORDER_KEY, JSON.stringify(sectionOrder));
  } catch (e) {
    console.error("Erreur sauvegarde sections:", e);
  }
}

/** Ouvrir la modale de création/édition de section */
function openSectionModal(sectionId) {
  editingSectionId = sectionId || null;
  const overlay = document.getElementById("modal-section-overlay");
  const title = document.getElementById("modal-section-title");
const nameInput = document.getElementById("modal-section-name");
  const chartType = document.getElementById("modal-section-chart-type");
  const fieldsContainer = document.getElementById("section-fields-container");
  const saveBtn = document.getElementById("modal-section-save");

  // Réinitialiser les champs
  fieldsContainer.innerHTML = "";
  nameInput.value = "";
  chartType.value = "line";

  // Ajouter un premier champ vide par défaut
  addDynamicField();

  if (sectionId) {
    // Mode édition
    const section = customSections.find(s => s.id === sectionId);
    if (section) {
      title.textContent = "Modifier la section";
      nameInput.value = section.name;
      chartType.value = section.chartType || "line";
      fieldsContainer.innerHTML = "";
      (section.fields || []).forEach(f => {
        addDynamicField(f.name, f.color);
      });
      saveBtn.textContent = "💾 Modifier";
    }
  } else {
    title.textContent = "Créer une nouvelle section";
    saveBtn.textContent = "➕ Créer";
  }

  overlay.style.display = "flex";
}

/** Fermer la modale de section */
function closeSectionModal() {
  document.getElementById("modal-section-overlay").style.display = "none";
  editingSectionId = null;
}

function addDynamicField(name = "", color = "#2563EB") {
  const container = document.getElementById("section-fields-container");

  const div = document.createElement("div");
  div.className = "dynamic-field-row";
  div.style.display = "flex";
  div.style.gap = "10px";
  div.style.marginBottom = "10px";
  div.innerHTML = `
    <input type="text" class="field-name-input" placeholder="Nom du champ" value="${name}" style="flex:1">
    <input type="color" class="field-color-input" value="${color}" style="width:50px">
    <button type="button" class="btn-icon btn-delete remove-field-btn" title="Supprimer">🗑️</button>
  `;

  div.querySelector(".remove-field-btn").addEventListener("click", () => {
    div.remove();
  });

  container.appendChild(div);
}

/** Sauvegarder la section */
function handleSectionSave() {
  const name = document.getElementById("modal-section-name").value.trim();
  const chartType = document.getElementById("modal-section-chart-type").value;
  const fieldsContainer = document.getElementById("section-fields-container");

  if (!name) {
    alert("Veuillez saisir le nom de la section.");
    return;
  }

  // Vérifier si le nom n'existe pas déjà
  const exists = customSections.some(s => s.name === name && s.id !== editingSectionId);
  if (exists) {
    alert("Une section avec ce nom existe déjà.");
    return;
  }

  // Collecter les champs
  const fields = [];
  fieldsContainer.querySelectorAll(".dynamic-field-row").forEach(row => {
    const fieldName = row.querySelector(".field-name-input").value.trim();
    const fieldColor = row.querySelector(".field-color-input")?.value || "#2563EB";
    if (fieldName) {
      fields.push({ name: fieldName, color: fieldColor });
    }
  });

  if (fields.length === 0) {
    alert("Veuillez ajouter au moins un champ.");
    return;
  }

  if (editingSectionId) {
    // Modifier existant
    const idx = customSections.findIndex(s => s.id === editingSectionId);
    if (idx !== -1) {
      const oldName = customSections[idx].name;
      // Suppression de la variable 'color' inexistante qui faisait planter le script
      customSections[idx] = { ...customSections[idx], name, chartType, fields };
      if (oldName !== name) {
        appData.forEach(r => { if (r.type === oldName) r.type = name; });
        saveToLocalStorage();
      }
    }
  } else {
    const newId = "section-" + Date.now();
    customSections.push({ id: newId, name, chartType, fields });
    sectionOrder.push(newId);
  }

  saveCustomSections();
  // On reconstruit la navigation immédiatement
  renderNavigation();
  // Refresh pour garantir l'initialisation ECharts sur le nouveau DOM
  location.reload();
}

/** Créer l'élément DOM pour une section personnalisée */
function createSectionElement(section) {
  const container = document.querySelector(".main-container");
  if (!container || !section) return;

  const slug = sectionTypeToSlug(section.name);
  const sectionId = slug; 

  // Vérifier si la section existe déjà dans le DOM
  if (document.getElementById(sectionId)) {
    return; // Section déjà présente
  }

  // Créer la section HTML
  const sectionEl = document.createElement("section");
  sectionEl.id = sectionId;
  sectionEl.className = "dashboard-section";
  sectionEl.dataset.type = section.name;
  const internalId = section.id; // ID unique de la section (ex: section-123...)

  sectionEl.innerHTML = `
    <div class="section-header">
      <h2>${section.name}</h2>
      <div class="section-actions">
        <button class="btn btn-secondary btn-edit-section" title="Modifier la section">✏️ Modifier</button>
        <button class="btn btn-secondary btn-move-up" title="Monter">↑</button>
        <button class="btn btn-secondary btn-move-down" title="Descendre">↓</button>
        <button class="btn btn-secondary btn-delete-section" title="Supprimer la section">🗑️</button>
        <label class="btn btn-primary file-label">
          <span>📁 Importer Excel</span>
          <input type="file" accept=".xlsx" class="file-input" data-section="${section.name}">
        </label>
        <button class="btn btn-secondary btn-export" data-section="${section.name}">📷 Exporter PNG</button>
        <button class="btn btn-secondary btn-export-excel" data-section="${section.name}">📊 Exporter Excel</button>
        <button class="btn btn-secondary btn-add-manual" data-section="${section.name}">➕ Ajouter manuellement</button>
      </div>
    </div>
    <div class="filters-bar">
      <div class="filter-group">
        <label for="filter-day-${slug}">Jour</label>
        <select id="filter-day-${slug}" class="filter-day" data-section="${section.name}"><option value="">Tous</option></select>
      </div>
      <div class="filter-group">
        <label for="filter-month-${slug}">Mois</label>
        <select id="filter-month-${slug}" class="filter-month" data-section="${section.name}"><option value="">Tous</option></select>
      </div>
      <div class="filter-group">
        <label for="filter-year-${slug}">Année</label>
        <select id="filter-year-${slug}" class="filter-year" data-section="${section.name}"><option value="">Toutes</option></select>
      </div>
      <div class="filter-group">
        <label for="filter-granularity-${slug}">Regroupement</label>
        <select id="filter-granularity-${slug}" class="filter-granularity" data-section="${section.name}">
          <option value="day">Jour</option>
          <option value="week">Semaine</option>
          <option value="month">Mois</option>
          <option value="year">Année</option>
        </select>
      </div>
    </div>
    <div id="chart-${sectionId}" class="chart-container"></div>
    <details class="table-details">
      <summary>
        <span>Données brutes — ${section.name}</span>
        <span id="badge-${sectionId}" class="status-badge">0 ligne</span>
      </summary>
      <div class="table-wrapper">
        <table class="data-table" id="table-${sectionId}">
          <thead>
            <tr>
              <th>Type</th>
              <th>Date</th>
              <th>Valeur</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </details>
  `;

  container.appendChild(sectionEl);

  // Ajouter la config pour la section dans SECTION_CONFIG
  SECTION_CONFIG[section.name] = {
    chart: `chart-${sectionId}`,
    table: `table-${sectionId}`,
    colorAnnonces: section.fields[0]?.color || "#2563EB",
    chartType: section.chartType || "line"
  };

  if (!SECTION_TYPES.includes(section.name)) {
    SECTION_TYPES.push(section.name);
  }

  // Attacher les événements aux nouveaux éléments
  attachSectionEvents(sectionEl, section.name, internalId);
}

function renderNavigation() {
  const nav = document.querySelector(".header-nav");
  if (!nav) return;
  nav.innerHTML = "";

  sectionOrder.forEach(id => {
    const section = customSections.find(s => s.id === id);
    if (section) {
      const slug = sectionTypeToSlug(section.name);
      const link = document.createElement("a");
      link.href = `#${slug}`;
      link.textContent = section.name;
      
      // Fermer le menu sur mobile lors du clic
      link.addEventListener("click", () => {
        const burgerBtn = document.getElementById("burger-btn");
        const headerMenu = document.getElementById("header-menu");
        if (burgerBtn && headerMenu && headerMenu.classList.contains("active")) {
          burgerBtn.classList.remove("open");
          headerMenu.classList.remove("active");
        }
      });
      
      nav.appendChild(link);
    }
  });
}

/** Attacher les événements pour une section */
function attachSectionEvents(sectionEl, sectionName, internalId) {
  // File input
  const fileInput = sectionEl.querySelector(".file-input");
  if (fileInput) {
    fileInput.addEventListener("change", e => handleFileImport(e, sectionName));
  }

  // Export PNG
  const exportBtn = sectionEl.querySelector(".btn-export");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => exportChartPNG(sectionName));
  }

  // Export Excel
  const exportExcelBtn = sectionEl.querySelector(".btn-export-excel");
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener("click", () => exportSectionExcel(sectionName));
  }

  // Add manual
  const addManualBtn = sectionEl.querySelector(".btn-add-manual");
  if (addManualBtn) {
    addManualBtn.addEventListener("click", () => openModal(sectionName, null));
  }

  // Edit Section
  const editSectionBtn = sectionEl.querySelector(".btn-edit-section");
  if (editSectionBtn && internalId) {
    editSectionBtn.addEventListener("click", () => openSectionModal(internalId));
  }

  // Move up
  const moveUpBtn = sectionEl.querySelector(".btn-move-up");
  if (moveUpBtn) {
    moveUpBtn.addEventListener("click", () => moveSection(internalId, -1));
  }

  // Move down
  const moveDownBtn = sectionEl.querySelector(".btn-move-down");
  if (moveDownBtn) {
    moveDownBtn.addEventListener("click", () => moveSection(internalId, 1));
  }

  // Delete section
  const deleteBtn = sectionEl.querySelector(".btn-delete-section");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      const sectionId = sectionEl.id;
      deleteSection(sectionId);
    });
  }

  // Filtres
  sectionEl.querySelectorAll(".filters-bar select").forEach(sel => {
    sel.addEventListener("change", () => renderSection(sectionName));
  });
}

/** Ajouter un lien dans la navigation */
/** Supprimer une section */
function deleteSection(domId) {
  if (!confirm("Voulez-vous vraiment supprimer cette section ?")) return;

  const sectionEl = document.getElementById(domId);
  if (!sectionEl) return;

  const sectionName = sectionEl.dataset.type;

  // 1. Supprimer des sections personnalisées et de l'ordre
  const customIdx = customSections.findIndex(s => s.name === sectionName);
  if (customIdx !== -1) {
    const sectionObj = customSections[customIdx];
    customSections.splice(customIdx, 1);
    
    const orderIdx = sectionOrder.indexOf(sectionObj.id);
    if (orderIdx !== -1) sectionOrder.splice(orderIdx, 1);
    
    saveCustomSections();
  }

  // 2. Nettoyer les configurations globales et instances
  const typeIdx = SECTION_TYPES.indexOf(sectionName);
  if (typeIdx !== -1) SECTION_TYPES.splice(typeIdx, 1);

  delete SECTION_CONFIG[sectionName];
  if (chartInstances[sectionName]) {
    chartInstances[sectionName].dispose();
    delete chartInstances[sectionName];
  }

  // 3. Supprimer les données associées (comparaison sur le nom exact)
  appData = appData.filter(r => r.type !== sectionName);
  saveToLocalStorage();

  // 4. Nettoyage de l'interface
  sectionEl.remove();
  renderNavigation();
  updateStatus(appData.length > 0);
  alert("Section supprimée !");
}

/** Réordonner les sections */
function moveSection(sectionId, direction) {
  const currentIdx = sectionOrder.indexOf(sectionId);
  if (currentIdx === -1) return;

  const newIdx = currentIdx + direction;
  if (newIdx < 0 || newIdx >= sectionOrder.length) return;

  // Échanger
  sectionOrder[currentIdx] = sectionOrder[newIdx];
  sectionOrder[newIdx] = sectionId;

  saveCustomSections();
  // Pro : Reload pour réinitialiser proprement les instances ECharts et le DOM
  location.reload();
}

/** Fermer la modal d'aide */
function closeHelpModal() {
  document.getElementById("modal-help-overlay").style.display = "none";
}

/* ============================================================
   POINT D'ENTRÉE
   ============================================================ */

function initApp() {
  // Charger les sections personnalisées depuis localStorage
  loadCustomSections();
  renderNavigation(); // Restaurer la navigation au démarrage
  
  // Créer les sections personnalisées selon l'ordre sauvegardé
  sectionOrder.forEach(id => {
    const section = customSections.find(s => s.id === id);
    if (section) createSectionElement(section);
  });

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
