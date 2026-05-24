import maplibregl, { LngLat } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { css as cssLanguage } from "@codemirror/lang-css";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as T;
};

const statusEl = $<HTMLSpanElement>("status");
const setStatus = (msg: string, kind: "" | "ok" | "error" = "") => {
  statusEl.textContent = msg;
  statusEl.className = `status ${kind}`.trim();
};

const widthInput = $<HTMLInputElement>("width");
const renderBtn = $<HTMLButtonElement>("render-btn");
const saveCssBtn = $<HTMLButtonElement>("save-css-btn");
const downloadBtn = $<HTMLButtonElement>("download-btn");
const downloadPngBtn = $<HTMLButtonElement>("download-png-btn");
const dpiInput = $<HTMLInputElement>("dpi");
const saveProjectBtn = $<HTMLButtonElement>("save-project-btn");
const loadProjectBtn = $<HTMLButtonElement>("load-project-btn");
const loadProjectFile = $<HTMLInputElement>("load-project-file");
const streetLabelsToggle = $<HTMLInputElement>("street-labels-toggle");
const placeLabelsToggle = $<HTMLInputElement>("place-labels-toggle");
const seaLabelsToggle = $<HTMLInputElement>("sea-labels-toggle");
const lakeLabelsToggle = $<HTMLInputElement>("lake-labels-toggle");
const riverLabelsToggle = $<HTMLInputElement>("river-labels-toggle");
const graticuleToggle = $<HTMLInputElement>("graticule-toggle");
const graticuleColorInput = $<HTMLInputElement>("graticule-color");
const graticuleHaloColorInput = $<HTMLInputElement>("graticule-halo-color");
const paneSplitter = $<HTMLDivElement>("pane-splitter");
const graticuleLabelsToggle = $<HTMLInputElement>("graticule-labels-toggle");
const crossToggle = $<HTMLInputElement>("cross-toggle");
const crossLatInput = $<HTMLInputElement>("cross-lat");
const crossLngInput = $<HTMLInputElement>("cross-lng");
const crossLabelsToggle = $<HTMLInputElement>("cross-labels-toggle");
const crossLatOffsetInput = $<HTMLInputElement>("cross-lat-offset");
const crossLngOffsetInput = $<HTMLInputElement>("cross-lng-offset");
const crossCenterBtn = $<HTMLButtonElement>("cross-center-btn");
const crossMarkerStyleSelect = $<HTMLSelectElement>("cross-marker-style");
const crossMarkerSizeInput = $<HTMLInputElement>("cross-marker-size");
const attribCornerSelect = $<HTMLSelectElement>("attrib-corner");
const canvasBgOverrideToggle = $<HTMLInputElement>("canvas-bg-override-toggle");
const canvasBgColorInput = $<HTMLInputElement>("canvas-bg-color");
const borderToggle = $<HTMLInputElement>("border-toggle");
const borderColorInput = $<HTMLInputElement>("border-color");
const borderWidthInput = $<HTMLInputElement>("border-width");
const freeformControls = $<HTMLDivElement>("freeform-controls");
const freeformXInput = $<HTMLInputElement>("freeform-x");
const freeformYInput = $<HTMLInputElement>("freeform-y");
const freeformWInput = $<HTMLInputElement>("freeform-w");
const freeformHInput = $<HTMLInputElement>("freeform-h");
const scalebarToggle = $<HTMLInputElement>("scalebar-toggle");
const scalebarAutoToggle = $<HTMLInputElement>("scalebar-auto");
const scalebarLengthInput = $<HTMLInputElement>("scalebar-length");
const scalebarSegmentsInput = $<HTMLInputElement>("scalebar-segments");
const scalebarXInput = $<HTMLInputElement>("scalebar-x");
const scalebarYInput = $<HTMLInputElement>("scalebar-y");
const addPoiBtn = $<HTMLButtonElement>("add-poi-btn");
const poiListEl = $<HTMLUListElement>("poi-list");
const poiEmptyEl = $<HTMLParagraphElement>("poi-empty");
const addRouteBtn = $<HTMLButtonElement>("add-route-btn");
const routeListEl = $<HTMLUListElement>("route-list");
const routeEmptyEl = $<HTMLParagraphElement>("route-empty");
const resetRectBtn = $<HTMLButtonElement>("reset-rect-btn");
const themeSelect = $<HTMLSelectElement>("theme");
const paperSelect = $<HTMLSelectElement>("paper");
const rotateBtn = $<HTMLButtonElement>("rotate-btn");
const lockBtn = $<HTMLButtonElement>("lock-btn");
const customPaperFields = $<HTMLSpanElement>("custom-paper-fields");
const customWInput = $<HTMLInputElement>("custom-w");
const customHInput = $<HTMLInputElement>("custom-h");
const cssEditorEl = $<HTMLDivElement>("css-editor");
// CodeMirror EditorView mounted into #css-editor. The `cssEditor` shim below
// preserves the old .value get/set API used throughout the rest of the file.
const cssEditorView = new EditorView({
  state: EditorState.create({
    doc: "",
    extensions: [
      basicSetup,
      cssLanguage(),
      EditorView.theme(
        {
          "&": { height: "100%" },
          ".cm-scroller": { overflow: "auto" },
        },
        { dark: true },
      ),
      keymap.of([
        {
          key: "Mod-Enter",
          run: () => {
            void render();
            return true;
          },
        },
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          if (crossToggle.checked) recompose();
        }
      }),
    ],
  }),
  parent: cssEditorEl,
});
const cssEditor = {
  get value(): string {
    return cssEditorView.state.doc.toString();
  },
  set value(v: string) {
    cssEditorView.dispatch({
      changes: { from: 0, to: cssEditorView.state.doc.length, insert: v },
    });
  },
};
const previewEl = $<HTMLDivElement>("preview");
const bboxLabel = $<HTMLDivElement>("bbox-label");
const bboxScaleEl = $<HTMLDivElement>("bbox-scale");
const mapEl = $<HTMLDivElement>("map");
const canvasSelect = $<HTMLSelectElement>("canvas-size");
const canvasRotateBtn = $<HTMLButtonElement>("canvas-rotate-btn");
const addTextBtn = $<HTMLButtonElement>("add-text-btn");
const addCoordsBtn = $<HTMLButtonElement>("add-coords-btn");
const mapSearchForm = $<HTMLFormElement>("map-search");
const mapSearchInput = $<HTMLInputElement>("map-search-input");
const overlayListEl = $<HTMLUListElement>("overlay-list");
const overlaysEmptyEl = $<HTMLParagraphElement>("overlays-empty");
const templateSelect = $<HTMLSelectElement>("template-select");
const templateSaveBtn = $<HTMLButtonElement>("template-save-btn");
const templateDeleteBtn = $<HTMLButtonElement>("template-delete-btn");

const map = new maplibregl.Map({
  container: "map",
  style: "https://tiles.openfreemap.org/styles/positron",
  center: [19.937, 50.061],
  zoom: 13,
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

// Right-click is reserved for dropping a POI (bound below). Rotation moves to
// middle-click + drag.
map.dragRotate.disable();

let bearingDrag:
  | { startX: number; startBearing: number; pointerId: number }
  | null = null;
mapEl.addEventListener("pointerdown", (e) => {
  if (e.button !== 1) return; // middle button only
  e.preventDefault();
  bearingDrag = {
    startX: e.clientX,
    startBearing: map.getBearing(),
    pointerId: e.pointerId,
  };
  try {
    mapEl.setPointerCapture(e.pointerId);
  } catch {
    /* not all browsers allow capture on the map container */
  }
});
mapEl.addEventListener("pointermove", (e) => {
  if (!bearingDrag || e.pointerId !== bearingDrag.pointerId) return;
  const dx = e.clientX - bearingDrag.startX;
  map.setBearing(bearingDrag.startBearing + dx * 0.4);
});
const endBearingDrag = (e: PointerEvent) => {
  if (!bearingDrag || e.pointerId !== bearingDrag.pointerId) return;
  bearingDrag = null;
};
mapEl.addEventListener("pointerup", endBearingDrag);
mapEl.addEventListener("pointercancel", endBearingDrag);
// When the picker's bearing settles, refresh the composed preview so it
// matches the new orientation.
map.on("rotateend", () => {
  if (lastMapSvg) recompose();
});
// Suppress browser autoscroll/middle-paste on the map.
mapEl.addEventListener("auxclick", (e) => {
  if (e.button === 1) e.preventDefault();
});

// -- Pane splitter ----------------------------------------------------------

const gridEl = document.querySelector<HTMLElement>(".grid")!;
const mapPaneEl = document.querySelector<HTMLElement>(".pane-map")!;
const settingsPaneEl = document.querySelector<HTMLElement>(".pane-settings")!;
const setPaneSplit = (leftPx: number | null) => {
  if (leftPx === null) {
    // Default split: map gets two thirds, settings gets one third.
    mapPaneEl.style.flex = "2 1 0";
    settingsPaneEl.style.flex = "1 1 0";
  } else {
    mapPaneEl.style.flex = `0 0 ${leftPx}px`;
    settingsPaneEl.style.flex = "1 1 0";
  }
};
let splitterPointerId: number | null = null;
paneSplitter.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  splitterPointerId = e.pointerId;
  paneSplitter.setPointerCapture(e.pointerId);
  paneSplitter.classList.add("dragging");
});
let splitterRaf = false;
paneSplitter.addEventListener("pointermove", (e) => {
  if (splitterPointerId !== e.pointerId) return;
  const rect = gridEl.getBoundingClientRect();
  const minLeft = 280;
  const minRight = 280;
  const x = Math.max(
    minLeft,
    Math.min(rect.width - minRight - paneSplitter.offsetWidth, e.clientX - rect.left),
  );
  setPaneSplit(x);
  if (!splitterRaf) {
    splitterRaf = true;
    requestAnimationFrame(() => {
      map.resize();
      drawRect();
      splitterRaf = false;
    });
  }
});
const endSplitterDrag = (e: PointerEvent) => {
  if (splitterPointerId !== e.pointerId) return;
  splitterPointerId = null;
  paneSplitter.classList.remove("dragging");
  map.resize();
  drawRect();
};
paneSplitter.addEventListener("pointerup", endSplitterDrag);
paneSplitter.addEventListener("pointercancel", endSplitterDrag);
paneSplitter.addEventListener("dblclick", () => {
  setPaneSplit(null);
  map.resize();
  drawRect();
});

// -- Sub-tab switching (scoped per panel) -----------------------------------

const wirePanelTabs = (root: HTMLElement, dataAttr: string) => {
  const tabs = root.querySelectorAll<HTMLButtonElement>(`.tabs > .tab[${dataAttr}]`);
  const panes = root.querySelectorAll<HTMLElement>(`.tab-pane[${dataAttr}]`);
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute(dataAttr)!;
      tabs.forEach((b) =>
        b.classList.toggle("active", b.getAttribute(dataAttr) === target),
      );
      panes.forEach((p) => {
        p.hidden = p.getAttribute(dataAttr) !== target;
      });
      // If we just revealed the Map preview pane, MapLibre's canvas may have
      // stale dimensions. For the picker we still want a resize on first show.
      if (dataAttr === "data-map-tab") {
        requestAnimationFrame(() => {
          map.resize();
          drawRect();
        });
      }
    });
  });
};
wirePanelTabs(mapPaneEl, "data-map-tab");
wirePanelTabs(settingsPaneEl, "data-settings-tab");

// -- Place search (Nominatim) -----------------------------------------------

const searchBtn = mapSearchForm.querySelector("button")!;
mapSearchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = mapSearchInput.value.trim();
  if (!q) return;
  setStatus(`searching “${q}”…`);
  searchBtn.disabled = true;
  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(q)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { "Accept-Language": navigator.language || "en" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arr = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name?: string;
      boundingbox?: string[];
    }>;
    if (arr.length === 0) {
      setStatus(`no results for “${q}”`, "error");
      return;
    }
    const r = arr[0];

    // Snapshot rect's on-screen size BEFORE the map moves so we can
    // re-center it on the destination while preserving its pixel size.
    const swBefore = map.project(rectSW);
    const neBefore = map.project(rectNE);
    const halfW = Math.abs(neBefore.x - swBefore.x) / 2;
    const halfH = Math.abs(neBefore.y - swBefore.y) / 2;

    if (r.boundingbox && r.boundingbox.length === 4) {
      const [s, n, w, e2] = r.boundingbox.map(parseFloat);
      map.fitBounds(
        [
          [w, s],
          [e2, n],
        ],
        { padding: 60, duration: 600 },
      );
    } else {
      map.flyTo({
        center: [parseFloat(r.lon), parseFloat(r.lat)],
        zoom: 14,
        duration: 600,
      });
    }

    map.once("moveend", () => {
      const c = map.project(map.getCenter());
      rectSW = map.unproject([c.x - halfW, c.y + halfH]);
      rectNE = map.unproject([c.x + halfW, c.y - halfH]);
      applyAspect();
      drawRect();
    });

    setStatus(r.display_name ?? q, "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "error");
  } finally {
    searchBtn.disabled = false;
  }
});

// -- Proportions -------------------------------------------------------------

type Paper = {
  id: string;
  label: string;
  short: number;
  long: number;
  shape?: "rect" | "circle";
};

const PAPERS: Paper[] = [
  { id: "free",   label: "Free",                 short: 0,   long: 0   },
  { id: "custom", label: "Custom…",              short: 0,   long: 0   },
  { id: "1x1",    label: "1:1 (square)",         short: 100, long: 100 },
  { id: "1414",   label: "1:1.41 (A-series)",    short: 100, long: 141 },
  { id: "10x15",  label: "2:3 (10×15 cm)",       short: 100, long: 150 },
  { id: "13x18",  label: "13:18 (13×18 cm)",     short: 130, long: 180 },
  { id: "circle", label: "Circle",               short: 100, long: 100, shape: "circle" },
];
for (const p of PAPERS) paperSelect.appendChild(new Option(p.label, p.id));

let landscape = true;
let aspect: number | null = null; // the locked aspect (width / height); null = unspecified
let aspectLocked = false;          // whether to enforce aspect during resize

const currentPaper = (): Paper =>
  PAPERS.find((p) => p.id === paperSelect.value) ?? PAPERS[0];

const computeAspect = (): number | null => {
  const p = currentPaper();
  if (p.id === "free") return null;
  if (p.id === "custom") {
    const w = parseFloat(customWInput.value);
    const h = parseFloat(customHInput.value);
    if (!(w > 0) || !(h > 0)) return null;
    const lo = Math.min(w, h);
    const hi = Math.max(w, h);
    return landscape ? hi / lo : lo / hi;
  }
  return landscape ? p.long / p.short : p.short / p.long;
};

const updateLockButton = () => {
  lockBtn.textContent = aspectLocked ? "🔒" : "🔓";
  lockBtn.title = aspectLocked
    ? "Aspect locked — click to unlock"
    : "Aspect unlocked — click to lock";
  lockBtn.classList.toggle("locked", aspectLocked);
};

const updateCustomVisibility = () => {
  customPaperFields.hidden = currentPaper().id !== "custom";
};

const updateRectShape = () => {
  rectEl.classList.toggle("circle", currentPaper().shape === "circle");
};

// -- Resizable bbox rectangle ------------------------------------------------

type Edges = { n: boolean; s: boolean; e: boolean; w: boolean };
type Drag =
  | { kind: "move"; startX: number; startY: number; originSW: LngLat; originNE: LngLat }
  | { kind: "resize"; edges: Edges; startX: number; startY: number; originSW: LngLat; originNE: LngLat };

let rectSW: LngLat = new LngLat(0, 0);
let rectNE: LngLat = new LngLat(0, 0);
let drag: Drag | null = null;

// Defined after the canvas section so it can use canvasDims/currentCanvas.
let updateRectScale: () => void = () => {};

const HANDLES: Array<{ id: string; edges: Edges }> = [
  { id: "nw", edges: { n: true,  s: false, e: false, w: true  } },
  { id: "ne", edges: { n: true,  s: false, e: true,  w: false } },
  { id: "sw", edges: { n: false, s: true,  e: false, w: true  } },
  { id: "se", edges: { n: false, s: true,  e: true,  w: false } },
  { id: "n",  edges: { n: true,  s: false, e: false, w: false } },
  { id: "s",  edges: { n: false, s: true,  e: false, w: false } },
  { id: "e",  edges: { n: false, s: false, e: true,  w: false } },
  { id: "w",  edges: { n: false, s: false, e: false, w: true  } },
];

const rectEl = document.createElement("div");
rectEl.className = "bbox-rect";
for (const h of HANDLES) {
  const hEl = document.createElement("div");
  hEl.className = `bbox-handle h-${h.id}`;
  hEl.dataset.edges = JSON.stringify(h.edges);
  rectEl.appendChild(hEl);
}
const gripEl = document.createElement("div");
gripEl.className = "bbox-grip";
gripEl.textContent = "✥";
gripEl.title = "Drag to move selection";
rectEl.appendChild(gripEl);
mapEl.appendChild(rectEl);

const initRectFromView = () => {
  const { clientWidth: w, clientHeight: h } = mapEl;
  const inset = 0.2;
  rectSW = map.unproject([w * inset, h * (1 - inset)]);
  rectNE = map.unproject([w * (1 - inset), h * inset]);
  applyAspect();
  drawRect();
};

/** Reshape the rect to the locked aspect, preserving its center and area. */
const applyAspect = () => {
  if (aspect === null) return;
  const sw = map.project(rectSW);
  const ne = map.project(rectNE);
  const cx = (sw.x + ne.x) / 2;
  const cy = (sw.y + ne.y) / 2;
  const w = Math.abs(ne.x - sw.x);
  const h = Math.abs(ne.y - sw.y);
  const area = Math.max(w * h, 80 * 80);
  const newW = Math.sqrt(area * aspect);
  const newH = newW / aspect;
  rectSW = map.unproject([cx - newW / 2, cy + newH / 2]);
  rectNE = map.unproject([cx + newW / 2, cy - newH / 2]);
};

const norm = () => {
  const south = Math.min(rectSW.lat, rectNE.lat);
  const north = Math.max(rectSW.lat, rectNE.lat);
  const west = Math.min(rectSW.lng, rectNE.lng);
  const east = Math.max(rectSW.lng, rectNE.lng);
  return { south, west, north, east };
};

const APP_VERSION = "0.1.0";

const updateBboxLabel = () => {
  const b = norm();
  bboxLabel.textContent =
    `S ${b.south.toFixed(5)}, W ${b.west.toFixed(5)}, ` +
    `N ${b.north.toFixed(5)}, E ${b.east.toFixed(5)}`;
  updatePageTitle();
};

/** Keep the document title in sync with the rectangle's center coords. */
const updatePageTitle = () => {
  const b = norm();
  if (!Number.isFinite(b.south) || b.north <= b.south) {
    document.title = `map2art v${APP_VERSION}`;
    return;
  }
  const lat = (b.south + b.north) / 2;
  const lng = (b.east + b.west) / 2;
  const latS = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}`;
  const lngS = `${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`;
  document.title = `map2art v${APP_VERSION} — ${latS}, ${lngS}`;
};

const drawRect = () => {
  const sw = map.project(rectSW);
  const ne = map.project(rectNE);
  const left = Math.min(sw.x, ne.x);
  const top = Math.min(sw.y, ne.y);
  const w = Math.max(8, Math.abs(ne.x - sw.x));
  const h = Math.max(8, Math.abs(ne.y - sw.y));
  rectEl.style.left = `${left}px`;
  rectEl.style.top = `${top}px`;
  rectEl.style.width = `${w}px`;
  rectEl.style.height = `${h}px`;
  updateBboxLabel();
  updateRectScale();
};

map.on("move", drawRect);
map.on("load", initRectFromView);

const beginDrag = (e: PointerEvent, mode: Drag) => {
  e.stopPropagation();
  e.preventDefault();
  drag = mode;
  map.dragPan.disable();
  (e.target as Element).setPointerCapture?.(e.pointerId);
};

gripEl.addEventListener("pointerdown", (e) => {
  beginDrag(e, {
    kind: "move",
    startX: e.clientX,
    startY: e.clientY,
    originSW: rectSW,
    originNE: rectNE,
  });
});

rectEl.querySelectorAll<HTMLDivElement>(".bbox-handle").forEach((h) => {
  h.addEventListener("pointerdown", (e) => {
    const edges: Edges = JSON.parse(h.dataset.edges!);
    beginDrag(e, {
      kind: "resize",
      edges,
      startX: e.clientX,
      startY: e.clientY,
      originSW: rectSW,
      originNE: rectNE,
    });
  });
});

document.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const dxPx = e.clientX - drag.startX;
  const dyPx = e.clientY - drag.startY;
  const swScreen = map.project(drag.originSW);
  const neScreen = map.project(drag.originNE);

  if (drag.kind === "move") {
    rectSW = map.unproject([swScreen.x + dxPx, swScreen.y + dyPx]);
    rectNE = map.unproject([neScreen.x + dxPx, neScreen.y + dyPx]);
  } else {
    const edges = drag.edges;
    let left = Math.min(swScreen.x, neScreen.x);
    let right = Math.max(swScreen.x, neScreen.x);
    let top = Math.min(swScreen.y, neScreen.y);
    let bottom = Math.max(swScreen.y, neScreen.y);
    if (edges.w) left += dxPx;
    if (edges.e) right += dxPx;
    if (edges.n) top += dyPx;
    if (edges.s) bottom += dyPx;

    if (aspectLocked && aspect !== null) {
      const horiz = edges.e || edges.w;
      const vert = edges.n || edges.s;
      if (horiz && vert) {
        // Corner: width drives, anchor at the opposite vertical edge.
        const newW = right - left;
        const newH = newW / aspect;
        if (edges.n) top = bottom - newH;
        else bottom = top + newH;
      } else if (horiz) {
        // Edge drag along x: keep vertical center, derive height from width.
        const newW = right - left;
        const newH = newW / aspect;
        const vc = (top + bottom) / 2;
        top = vc - newH / 2;
        bottom = vc + newH / 2;
      } else if (vert) {
        // Edge drag along y: keep horizontal center, derive width from height.
        const newH = bottom - top;
        const newW = newH * aspect;
        const hc = (left + right) / 2;
        left = hc - newW / 2;
        right = hc + newW / 2;
      }
    }

    if (right - left < 4) right = left + 4;
    if (bottom - top < 4) bottom = top + 4;
    rectSW = map.unproject([left, bottom]);
    rectNE = map.unproject([right, top]);
  }
  drawRect();
});

const endDrag = () => {
  if (drag) {
    drag = null;
    map.dragPan.enable();
  }
};
document.addEventListener("pointerup", endDrag);
document.addEventListener("pointercancel", endDrag);

resetRectBtn.addEventListener("click", initRectFromView);

paperSelect.addEventListener("change", () => {
  updateCustomVisibility();
  updateRectShape();
  const p = currentPaper();
  if (p.id === "free") {
    aspectLocked = false;
    aspect = null;
  } else {
    aspect = computeAspect();
    aspectLocked = aspect !== null;
  }
  applyAspect();
  drawRect();
  updateLockButton();
});

rotateBtn.addEventListener("click", () => {
  landscape = !landscape;
  const next = computeAspect();
  if (next !== null) {
    aspect = next;
    aspectLocked = true;
  }
  applyAspect();
  drawRect();
  updateLockButton();
});

lockBtn.addEventListener("click", () => {
  if (aspectLocked) {
    aspectLocked = false;
  } else {
    if (aspect === null) {
      // Capture the rect's current screen aspect.
      const sw = map.project(rectSW);
      const ne = map.project(rectNE);
      const w = Math.abs(ne.x - sw.x);
      const h = Math.abs(ne.y - sw.y);
      if (h > 0) aspect = w / h;
    }
    aspectLocked = aspect !== null;
  }
  updateLockButton();
});

const onCustomDimsChanged = () => {
  if (currentPaper().id !== "custom") return;
  aspect = computeAspect();
  aspectLocked = aspect !== null;
  applyAspect();
  drawRect();
  updateLockButton();
};
customWInput.addEventListener("input", onCustomDimsChanged);
customHInput.addEventListener("input", onCustomDimsChanged);

updateCustomVisibility();
updateLockButton();

// -- Themes ------------------------------------------------------------------

const THEME_CUSTOM = "__custom__";

const loadThemeList = async () => {
  themeSelect.innerHTML = "";
  themeSelect.appendChild(new Option("Custom (saved)", THEME_CUSTOM));
  try {
    const res = await fetch("/api/themes");
    if (res.ok) {
      const names: string[] = await res.json();
      for (const n of names) {
        themeSelect.appendChild(new Option(n, n));
      }
    }
  } catch {
    /* leave only Custom */
  }
};

const loadThemeIntoEditor = async (name: string) => {
  try {
    const url = name === THEME_CUSTOM ? "/api/style" : `/api/themes/${encodeURIComponent(name)}`;
    const res = await fetch(url);
    if (res.ok) cssEditor.value = await res.text();
  } catch {
    /* ignore */
  }
};

themeSelect.addEventListener("change", async () => {
  await loadThemeIntoEditor(themeSelect.value);
});

// -- Canvas size -------------------------------------------------------------

type Canvas = { id: string; label: string; short: number; long: number };

const CANVASES: Canvas[] = [
  { id: "match",  label: "Match map (no margins)", short: 0,   long: 0   },
  { id: "10x15",  label: "10×15 cm",               short: 100, long: 150 },
  { id: "13x18",  label: "13×18 cm",               short: 130, long: 180 },
  { id: "a4",     label: "A4 (210×297 mm)",        short: 210, long: 297 },
  { id: "a3",     label: "A3 (297×420 mm)",        short: 297, long: 420 },
  { id: "a3plus", label: "A3+ (329×483 mm)",       short: 329, long: 483 },
];
for (const c of CANVASES) canvasSelect.appendChild(new Option(c.label, c.id));

let canvasLandscape = true;

const currentCanvas = (): Canvas =>
  CANVASES.find((c) => c.id === canvasSelect.value) ?? CANVASES[0];

/** Returns { w, h } in mm (the canvas viewBox units). For "match" we fall
 *  back to a sensible default keyed off the map aspect at compose time. */
const canvasDims = (mapAspect: number): { w: number; h: number } => {
  const c = currentCanvas();
  if (c.id === "match") {
    const h = 200;
    return { w: h * mapAspect, h };
  }
  return canvasLandscape
    ? { w: c.long, h: c.short }
    : { w: c.short, h: c.long };
};

canvasSelect.addEventListener("change", () => {
  updateRectScale();
  recompose();
});
canvasRotateBtn.addEventListener("click", () => {
  canvasLandscape = !canvasLandscape;
  updateRectScale();
  recompose();
});

// -- Map frames --------------------------------------------------------------

type Frame = {
  id: string;
  label: string;
  description: string;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  decoration?: "shadow";
  canvasBg?: string;
  /** If true, composeSvg auto-prints the bbox center coords, dims, and scale
   *  into the bottom margin. Useful for field-notes / atlas layouts. */
  infoStrip?: boolean;
  /** Initial border state applied when this frame is selected. */
  border?: { enabled: boolean; color: string; width: number };
};

const FRAMES: Frame[] = [
  {
    id: "minimal",
    label: "Minimal",
    description: "Thin even margins. The map fills the canvas.",
    marginTop: 0.05, marginRight: 0.05, marginBottom: 0.05, marginLeft: 0.05,
    border: { enabled: false, color: "#222222", width: 0.5 },
  },
  {
    id: "polaroid",
    label: "Polaroid",
    description: "Instax-style: even sides + a wide caption strip at the bottom. White canvas, subtle drop shadow on the map.",
    marginTop: 0.07, marginRight: 0.07, marginBottom: 0.24, marginLeft: 0.07,
    decoration: "shadow",
    canvasBg: "#ffffff",
    border: { enabled: false, color: "#222222", width: 0.5 },
  },
  {
    id: "field-notes",
    label: "Field notes",
    description: "Thin black border around the map plus a metadata strip below — coordinates, scale, date.",
    marginTop: 0.05, marginRight: 0.05, marginBottom: 0.14, marginLeft: 0.05,
    canvasBg: "#f4efe2",
    border: { enabled: true, color: "#222222", width: 0.5 },
  },
  {
    id: "poster",
    label: "Poster",
    description: "Tall top margin for a large title strip, map dominates the bottom.",
    marginTop: 0.22, marginRight: 0.05, marginBottom: 0.08, marginLeft: 0.05,
    border: { enabled: false, color: "#222222", width: 0.5 },
  },
  {
    id: "atlas",
    label: "Atlas",
    description: "Field-notes layout that auto-prints the rectangle's coordinates, dimensions, and scale into the bottom strip — no overlay needed. Strip is draggable.",
    marginTop: 0.05, marginRight: 0.05, marginBottom: 0.18, marginLeft: 0.05,
    canvasBg: "#f4efe2",
    infoStrip: true,
    border: { enabled: true, color: "#222222", width: 0.5 },
  },
  {
    id: "freeform",
    label: "Freeform",
    description: "Position and size the map manually inside the canvas. Use the X / Y / W / H inputs below to place it anywhere.",
    marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
    border: { enabled: false, color: "#222222", width: 0.5 },
  },
];
let currentFrameId = "minimal";
const currentFrame = (): Frame =>
  FRAMES.find((f) => f.id === currentFrameId) ?? FRAMES[0];

// Atlas info-strip drag position (canvas fractions).
let atlasInfoXFrac = 0.5;
let atlasInfoYFrac = 0.93;

const applyFrameDefaults = (f: Frame) => {
  if (f.border) {
    borderToggle.checked = f.border.enabled;
    borderColorInput.value = f.border.color;
    borderWidthInput.value = String(f.border.width);
  }
  freeformControls.hidden = f.id !== "freeform";
  if (f.id === "atlas") {
    // Reset atlas strip to its default bottom-center position when picking atlas.
    atlasInfoXFrac = 0.5;
    atlasInfoYFrac = 0.93;
  }
};

const frameOptionsEl = $<HTMLUListElement>("frame-options");
const SVG_NS = "http://www.w3.org/2000/svg";
const renderFramePreview = (f: Frame): SVGSVGElement => {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 100 70");
  const bg = document.createElementNS(SVG_NS, "rect");
  bg.setAttribute("x", "0"); bg.setAttribute("y", "0");
  bg.setAttribute("width", "100"); bg.setAttribute("height", "70");
  bg.setAttribute("fill", f.canvasBg ?? "#fafafa");
  svg.appendChild(bg);
  const map = document.createElementNS(SVG_NS, "rect");
  map.setAttribute("x", String(f.marginLeft * 100));
  map.setAttribute("y", String(f.marginTop * 70));
  map.setAttribute("width", String((1 - f.marginLeft - f.marginRight) * 100));
  map.setAttribute("height", String((1 - f.marginTop - f.marginBottom) * 70));
  map.setAttribute("fill", "#9aa3ad");
  if (f.border?.enabled) {
    map.setAttribute("stroke", f.border.color);
    map.setAttribute("stroke-width", "0.5");
  }
  svg.appendChild(map);
  if (f.infoStrip) {
    const stripTop = f.marginTop * 70 + (1 - f.marginTop - f.marginBottom) * 70;
    const stripH = f.marginBottom * 70;
    const cx = 50;
    const lineW = 60;
    const line1 = document.createElementNS(SVG_NS, "rect");
    line1.setAttribute("x", String(cx - lineW / 2));
    line1.setAttribute("y", String(stripTop + stripH * 0.35));
    line1.setAttribute("width", String(lineW));
    line1.setAttribute("height", "1.2");
    line1.setAttribute("fill", "#3a3424");
    line1.setAttribute("opacity", "0.7");
    svg.appendChild(line1);
    const line2 = document.createElementNS(SVG_NS, "rect");
    line2.setAttribute("x", String(cx - lineW / 2.5));
    line2.setAttribute("y", String(stripTop + stripH * 0.65));
    line2.setAttribute("width", String(lineW * 0.8));
    line2.setAttribute("height", "1.0");
    line2.setAttribute("fill", "#3a3424");
    line2.setAttribute("opacity", "0.55");
    svg.appendChild(line2);
  }
  return svg;
};
const renderFrameOptions = () => {
  frameOptionsEl.innerHTML = "";
  for (const f of FRAMES) {
    const li = document.createElement("li");
    const lbl = document.createElement("label");
    lbl.className = "frame-option" + (f.id === currentFrameId ? " selected" : "");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "frame";
    input.value = f.id;
    input.checked = f.id === currentFrameId;
    input.addEventListener("change", () => {
      if (!input.checked) return;
      currentFrameId = f.id;
      for (const opt of frameOptionsEl.querySelectorAll<HTMLLabelElement>(".frame-option")) {
        opt.classList.remove("selected");
      }
      lbl.classList.add("selected");
      applyFrameDefaults(f);
      recompose();
    });
    const preview = renderFramePreview(f);
    const info = document.createElement("div");
    info.className = "frame-info";
    info.innerHTML = `<strong>${f.label}</strong><span>${f.description}</span>`;
    lbl.append(input, preview, info);
    li.appendChild(lbl);
    frameOptionsEl.appendChild(li);
  }
};
renderFrameOptions();
applyFrameDefaults(currentFrame());

// Wire border + freeform + canvas-bg inputs.
for (const el of [
  borderToggle, borderColorInput, borderWidthInput,
  freeformXInput, freeformYInput, freeformWInput, freeformHInput,
  canvasBgOverrideToggle, canvasBgColorInput,
] as const) {
  el.addEventListener("input", () => recompose());
  el.addEventListener("change", () => recompose());
}

// -- Scale of the selection -------------------------------------------------

const formatScaleRatio = (n: number): string => {
  if (n < 100) return Math.round(n).toString();
  if (n < 1000) return (Math.round(n / 10) * 10).toString();
  if (n < 10000) return (Math.round(n / 100) * 100).toString();
  if (n < 100000) return (Math.round(n / 1000) * 1000).toLocaleString("en-US");
  return (Math.round(n / 10000) * 10000).toLocaleString("en-US");
};

const formatMeters = (m: number): string =>
  m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;

updateRectScale = () => {
  const b = norm();
  if (!Number.isFinite(b.south) || b.north <= b.south) {
    bboxScaleEl.textContent = "";
    return;
  }
  const midLat = (b.north + b.south) / 2;
  const widthM =
    (b.east - b.west) * 111320 * Math.cos((midLat * Math.PI) / 180);
  const heightM = (b.north - b.south) * 111320;

  let suffix = "";
  const c = currentCanvas();
  if (c.id !== "match") {
    const sw = map.project(rectSW);
    const ne = map.project(rectNE);
    const rw = Math.abs(ne.x - sw.x);
    const rh = Math.max(1, Math.abs(ne.y - sw.y));
    const rectAspect = rw / rh;
    const { w: cw, h: ch } = canvasDims(rectAspect);
    const margin = Math.min(cw, ch) * 0.05;
    const availW = cw - 2 * margin;
    const availH = ch - 2 * margin;
    const mw =
      availW / availH > rectAspect ? availH * rectAspect : availW;
    const ratio = (widthM * 1000) / mw;
    if (Number.isFinite(ratio) && ratio > 0) {
      const shortLabel = c.label.split(" ")[0];
      suffix = `  •  1:${formatScaleRatio(ratio)} on ${shortLabel} ${
        canvasLandscape ? "landscape" : "portrait"
      }`;
    }
  }
  bboxScaleEl.textContent = `${formatMeters(widthM)} × ${formatMeters(heightM)}${suffix}`;
};

// -- Overlay snapping --------------------------------------------------------

const computeSnapCandidates = (
  excludeId: string,
): { xs: number[]; ys: number[] } => {
  const aspect = lastMapAspect ?? 1;
  const { w: cw, h: ch } = canvasDims(aspect);
  const margin =
    currentCanvas().id === "match" ? 0 : Math.min(cw, ch) * 0.05;
  const availW = cw - 2 * margin;
  const availH = ch - 2 * margin;
  let mw: number;
  let mh: number;
  if (availW / availH > aspect) {
    mh = availH;
    mw = mh * aspect;
  } else {
    mw = availW;
    mh = mw / aspect;
  }
  const mx = (cw - mw) / 2;
  const my = (ch - mh) / 2;
  const xs = [0, cw / 2, cw, mx, mx + mw / 2, mx + mw];
  const ys = [0, ch / 2, ch, my, my + mh / 2, my + mh];
  for (const o of overlays) {
    if (o.id === excludeId) continue;
    xs.push(o.x);
    ys.push(o.y);
  }
  return { xs, ys };
};

const snapThreshold = (): number => {
  const aspect = lastMapAspect ?? 1;
  const { w: cw, h: ch } = canvasDims(aspect);
  return Math.min(cw, ch) * 0.012;
};

const trySnap = (
  val: number,
  candidates: number[],
  threshold: number,
): { val: number; snapped: number | null } => {
  let best: number | null = null;
  let bestDist = threshold;
  for (const c of candidates) {
    const d = Math.abs(val - c);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best !== null ? { val: best, snapped: best } : { val, snapped: null };
};

const ensureSnapGroup = (svg: SVGSVGElement): SVGGElement => {
  let group = svg.querySelector<SVGGElement>("g.snap-guides");
  if (!group) {
    group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", "snap-guides");
    group.style.pointerEvents = "none";
    svg.appendChild(group);
  }
  return group;
};

const drawSnapGuides = (
  svg: SVGSVGElement,
  snappedX: number | null,
  snappedY: number | null,
) => {
  const group = ensureSnapGroup(svg);
  while (group.firstChild) group.removeChild(group.firstChild);
  const aspect = lastMapAspect ?? 1;
  const { w: cw, h: ch } = canvasDims(aspect);
  const sw = Math.max(0.15, Math.min(cw, ch) * 0.0015);
  const make = (x1: number, y1: number, x2: number, y2: number) => {
    const line = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line",
    );
    line.setAttribute("x1", String(x1));
    line.setAttribute("y1", String(y1));
    line.setAttribute("x2", String(x2));
    line.setAttribute("y2", String(y2));
    line.setAttribute("stroke", "#ff5db1");
    line.setAttribute("stroke-width", String(sw));
    line.setAttribute("stroke-dasharray", "2 1.5");
    return line;
  };
  if (snappedX !== null) group.appendChild(make(snappedX, 0, snappedX, ch));
  if (snappedY !== null) group.appendChild(make(0, snappedY, cw, snappedY));
};

const clearSnapGuides = (svg: SVGSVGElement) => {
  svg.querySelector("g.snap-guides")?.remove();
};

// -- Text overlays -----------------------------------------------------------

type Overlay = {
  id: string;
  text: string;
  x: number; // canvas viewBox units (mm)
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  rotation: number; // degrees clockwise around (x, y)
};

const FONT_FAMILIES: Array<{ label: string; css: string }> = [
  { label: "Georgia (serif)",    css: "Georgia, 'Times New Roman', serif" },
  { label: "Times (serif)",      css: "'Times New Roman', Times, serif" },
  { label: "Garamond (serif)",   css: "Garamond, Georgia, serif" },
  { label: "Playfair (serif)",   css: "'Playfair Display', Georgia, serif" },
  { label: "Inter (sans)",       css: "Inter, system-ui, -apple-system, sans-serif" },
  { label: "Helvetica (sans)",   css: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { label: "Futura (sans)",      css: "Futura, 'Trebuchet MS', sans-serif" },
  { label: "Impact (display)",   css: "Impact, 'Arial Black', sans-serif" },
  { label: "Courier (mono)",     css: "'Courier New', ui-monospace, monospace" },
  { label: "Brush (script)",     css: "'Brush Script MT', cursive" },
];
const DEFAULT_FONT = FONT_FAMILIES[0].css;

const overlays: Overlay[] = [];
const selectedIds = new Set<string>();

const syncSelectionVisuals = () => {
  const svg = previewEl.querySelector<SVGSVGElement>("svg");
  svg?.querySelectorAll<SVGTextElement>("text.overlay-text").forEach((t) => {
    t.classList.toggle("selected", selectedIds.has(t.dataset.id!));
  });
  overlayListEl.querySelectorAll<HTMLLIElement>(".overlay-row").forEach((li) => {
    li.classList.toggle("selected", selectedIds.has(li.dataset.id!));
  });
};

const clearSelection = () => {
  if (selectedIds.size === 0) return;
  selectedIds.clear();
  syncSelectionVisuals();
};

const escapeXml = (s: string): string =>
  s.replace(/&/g, "&amp;")
   .replace(/</g, "&lt;")
   .replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;");

const newOverlayId = () => Math.random().toString(36).slice(2, 10);

const addOverlay = () => {
  if (!lastMapSvg) {
    setStatus("render the map first, then add text", "error");
    return;
  }
  snapshot();
  const aspect = lastMapAspect ?? 1;
  const { w, h } = canvasDims(aspect);
  overlays.push({
    id: newOverlayId(),
    text: suggestedTitle ? suggestedTitle.toUpperCase() : "TITLE",
    x: w / 2,
    y: h * 0.92,
    fontSize: Math.round(Math.min(w, h) * 0.06 * 10) / 10,
    fontFamily: DEFAULT_FONT,
    color: "#111111",
    rotation: 0,
  });
  renderOverlayList();
  recompose();
};

addTextBtn.addEventListener("click", addOverlay);

const toDMS = (deg: number, pos: string, neg: string): string => {
  const sign = deg >= 0 ? pos : neg;
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60);
  return `${d}°${String(m).padStart(2, "0")}′${String(s).padStart(2, "0")}″${sign}`;
};

const addCoordsOverlay = () => {
  if (!lastMapSvg) {
    setStatus("render the map first, then add coordinates", "error");
    return;
  }
  const b = norm();
  const lat = (b.south + b.north) / 2;
  const lng = (b.west + b.east) / 2;
  const text = `${toDMS(lat, "N", "S")}  ·  ${toDMS(lng, "E", "W")}`;

  const aspect = lastMapAspect ?? 1;
  const { w, h } = canvasDims(aspect);
  overlays.push({
    id: newOverlayId(),
    text,
    x: w / 2,
    y: h * 0.97,
    fontSize: Math.round(Math.min(w, h) * 0.025 * 10) / 10,
    fontFamily: FONT_FAMILIES[8].css, // Courier (mono)
    color: "#333333",
    rotation: 0,
  });
  renderOverlayList();
  recompose();
};
addCoordsBtn.addEventListener("click", addCoordsOverlay);

const renderOverlayList = () => {
  overlayListEl.innerHTML = "";
  for (const o of overlays) {
    const li = document.createElement("li");
    li.className = "overlay-row";
    li.dataset.id = o.id;

    const text = document.createElement("textarea");
    text.rows = 1;
    text.value = o.text;
    text.placeholder = "text — newlines wrap";
    text.addEventListener("input", () => {
      o.text = text.value;
      recompose();
    });

    const controls = document.createElement("div");
    controls.className = "overlay-controls";

    const fam = document.createElement("select");
    for (const f of FONT_FAMILIES) {
      fam.appendChild(new Option(f.label, f.css));
    }
    if (![...fam.options].some((opt) => opt.value === o.fontFamily)) {
      fam.appendChild(new Option(o.fontFamily, o.fontFamily));
    }
    fam.value = o.fontFamily;
    fam.title = "Font family";
    fam.addEventListener("change", () => {
      o.fontFamily = fam.value;
      recompose();
    });

    const size = document.createElement("input");
    size.type = "number";
    size.step = "0.5";
    size.min = "1";
    size.value = String(o.fontSize);
    size.title = "Font size (mm)";
    size.addEventListener("input", () => {
      const v = parseFloat(size.value);
      if (Number.isFinite(v) && v > 0) {
        o.fontSize = v;
        recompose();
      }
    });

    const color = document.createElement("input");
    color.type = "color";
    color.value = o.color;
    color.title = "Color";
    color.addEventListener("input", () => {
      o.color = color.value;
      recompose();
    });

    const rot = document.createElement("input");
    rot.type = "number";
    rot.step = "5";
    rot.value = String(o.rotation);
    rot.title = "Rotation (°)";
    rot.addEventListener("input", () => {
      const v = parseFloat(rot.value);
      if (Number.isFinite(v)) {
        o.rotation = v;
        recompose();
      }
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete-btn";
    del.textContent = "✕";
    del.title = "Delete overlay";
    del.addEventListener("click", () => {
      snapshot();
      const i = overlays.findIndex((x) => x.id === o.id);
      if (i >= 0) overlays.splice(i, 1);
      selectedIds.delete(o.id);
      renderOverlayList();
      recompose();
    });

    controls.append(fam, size, color, rot, del);
    li.append(text, controls);
    overlayListEl.appendChild(li);
  }
  overlaysEmptyEl.hidden = overlays.length > 0;
};

// -- Templates ---------------------------------------------------------------

type TemplateOverlay = {
  text: string;
  xFrac: number;   // 0..1 across canvas width
  yFrac: number;   // 0..1 across canvas height
  sizeFrac: number; // relative to min(canvasW, canvasH)
  fontFamily: string;
  color: string;
  rotation: number;
};

type Template = {
  id: string;
  name: string;
  /** version 1 = positions are canvas fractions (legacy). version 2 =
   *  positions are MAP-AREA fractions: 0 = top-left of map, 1 = bottom-right.
   *  Values outside [0, 1] place the text in the canvas margin. Sizes are
   *  still canvas-relative so text doesn't shrink in small map areas. */
  version?: 1 | 2;
  overlays: TemplateOverlay[];
};

const BUILTIN_TEMPLATES: Template[] = [
  {
    id: "title",
    name: "Title (below map)",
    version: 2,
    overlays: [
      {
        text: "TITLE",
        xFrac: 0.5,
        yFrac: 1.10,
        sizeFrac: 0.05,
        fontFamily: FONT_FAMILIES[0].css,
        color: "#111111",
        rotation: 0,
      },
    ],
  },
  {
    id: "title-subtitle",
    name: "Title + subtitle",
    version: 2,
    overlays: [
      {
        text: "TITLE",
        xFrac: 0.5,
        yFrac: 1.08,
        sizeFrac: 0.06,
        fontFamily: FONT_FAMILIES[0].css,
        color: "#111111",
        rotation: 0,
      },
      {
        text: "subtitle",
        xFrac: 0.5,
        yFrac: 1.16,
        sizeFrac: 0.022,
        fontFamily: FONT_FAMILIES[0].css,
        color: "#444444",
        rotation: 0,
      },
    ],
  },
  {
    id: "title-coords",
    name: "Title + coordinates",
    version: 2,
    overlays: [
      {
        text: "KRAKÓW",
        xFrac: 0.5,
        yFrac: 1.08,
        sizeFrac: 0.055,
        fontFamily: FONT_FAMILIES[5].css,
        color: "#111111",
        rotation: 0,
      },
      {
        text: "50°03′N · 19°56′E",
        xFrac: 0.5,
        yFrac: 1.15,
        sizeFrac: 0.020,
        fontFamily: FONT_FAMILIES[8].css,
        color: "#444444",
        rotation: 0,
      },
    ],
  },
  {
    id: "polaroid-caption",
    name: "Polaroid caption",
    version: 2,
    overlays: [
      {
        text: "Kraków · summer",
        xFrac: 0.5,
        yFrac: 1.18,
        sizeFrac: 0.035,
        fontFamily: FONT_FAMILIES[9].css, // Brush Script
        color: "#222222",
        rotation: 0,
      },
    ],
  },
  {
    id: "side-label",
    name: "Side label (vertical)",
    version: 2,
    overlays: [
      {
        text: "TITLE",
        xFrac: -0.06,
        yFrac: 0.5,
        sizeFrac: 0.045,
        fontFamily: FONT_FAMILIES[0].css,
        color: "#111111",
        rotation: -90,
      },
    ],
  },
  {
    id: "poster-title",
    name: "Poster title (above map)",
    version: 2,
    overlays: [
      {
        text: "KRAKÓW",
        xFrac: 0.5,
        yFrac: -0.18,
        sizeFrac: 0.10,
        fontFamily: FONT_FAMILIES[5].css,
        color: "#111111",
        rotation: 0,
      },
      {
        text: "POLAND",
        xFrac: 0.5,
        yFrac: -0.10,
        sizeFrac: 0.025,
        fontFamily: FONT_FAMILIES[5].css,
        color: "#444444",
        rotation: 0,
      },
    ],
  },
];

const TEMPLATE_STORAGE_KEY = "map2art-templates";

const loadUserTemplates = (): Template[] => {
  try {
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveUserTemplates = (ts: Template[]) => {
  try {
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(ts));
  } catch (err) {
    console.error("failed to persist templates", err);
  }
};

const refreshTemplateSelect = () => {
  templateSelect.innerHTML = "";
  templateSelect.appendChild(new Option("— choose —", ""));

  const builtin = document.createElement("optgroup");
  builtin.label = "Built-in";
  for (const t of BUILTIN_TEMPLATES) {
    builtin.appendChild(new Option(t.name, `b:${t.id}`));
  }
  templateSelect.appendChild(builtin);

  const userTemplates = loadUserTemplates();
  if (userTemplates.length > 0) {
    const saved = document.createElement("optgroup");
    saved.label = "Saved";
    for (const t of userTemplates) {
      saved.appendChild(new Option(t.name, `u:${t.id}`));
    }
    templateSelect.appendChild(saved);
  }
};

const applyTemplate = (template: Template) => {
  snapshot();
  const aspect = lastMapAspect ?? 1;
  const { w: cw, h: ch } = canvasDims(aspect);
  const minDim = Math.min(cw, ch);
  const version = template.version ?? 1;
  // For v2 we position relative to the map area; for v1 (legacy) we keep
  // the old canvas-fraction interpretation.
  const { mx, my, mw, mh } = computeMapPlacement(cw, ch, aspect);
  overlays.length = 0;
  for (const t of template.overlays) {
    const x = version === 2 ? mx + t.xFrac * mw : t.xFrac * cw;
    const y = version === 2 ? my + t.yFrac * mh : t.yFrac * ch;
    overlays.push({
      id: newOverlayId(),
      text: t.text,
      x,
      y,
      fontSize: Math.round(t.sizeFrac * minDim * 10) / 10,
      fontFamily: t.fontFamily,
      color: t.color,
      rotation: t.rotation,
    });
  }
  renderOverlayList();
  recompose();
};

templateSelect.addEventListener("change", () => {
  const v = templateSelect.value;
  templateDeleteBtn.disabled = !v.startsWith("u:");
  if (!v) return;
  let template: Template | undefined;
  if (v.startsWith("b:")) {
    template = BUILTIN_TEMPLATES.find((t) => t.id === v.slice(2));
  } else if (v.startsWith("u:")) {
    template = loadUserTemplates().find((t) => t.id === v.slice(2));
  }
  if (template) applyTemplate(template);
});

templateSaveBtn.addEventListener("click", () => {
  if (overlays.length === 0) {
    setStatus("nothing to save — add overlays first", "error");
    return;
  }
  const name = prompt("Name for this template?");
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;

  const aspect = lastMapAspect ?? 1;
  const { w: cw, h: ch } = canvasDims(aspect);
  const minDim = Math.min(cw, ch);
  const { mx, my, mw, mh } = computeMapPlacement(cw, ch, aspect);

  const t: Template = {
    id: newOverlayId(),
    name: trimmed,
    version: 2,
    overlays: overlays.map((o) => ({
      text: o.text,
      xFrac: (o.x - mx) / mw,
      yFrac: (o.y - my) / mh,
      sizeFrac: o.fontSize / minDim,
      fontFamily: o.fontFamily,
      color: o.color,
      rotation: o.rotation,
    })),
  };
  const user = loadUserTemplates();
  user.push(t);
  saveUserTemplates(user);
  refreshTemplateSelect();
  templateSelect.value = `u:${t.id}`;
  templateDeleteBtn.disabled = false;
  setStatus(`saved template "${trimmed}"`, "ok");
});

templateDeleteBtn.addEventListener("click", () => {
  const v = templateSelect.value;
  if (!v.startsWith("u:")) return;
  const id = v.slice(2);
  const t = loadUserTemplates().find((x) => x.id === id);
  if (!t) return;
  if (!confirm(`Delete template "${t.name}"?`)) return;
  saveUserTemplates(loadUserTemplates().filter((x) => x.id !== id));
  refreshTemplateSelect();
  templateSelect.value = "";
  templateDeleteBtn.disabled = true;
  setStatus("template deleted", "ok");
});

refreshTemplateSelect();

// -- Points of interest ------------------------------------------------------

type PoiStyle = "pin" | "dot" | "bubble" | "numbered" | "flag";

type TextPosition = "top" | "bottom" | "left" | "right";

type Poi = {
  id: string;
  lat: number;
  lng: number;
  text: string;
  style: PoiStyle;
  /** Background / fill color (bubble bg, pin fill, numbered circle, flag). */
  color: string;
  /** Text color used wherever the marker renders text (label text on
   *  pin/dot/flag, the text inside a bubble, the number in a numbered marker). */
  textColor: string;
  /** Absolute marker size in SVG units (≈ mm on standard canvas). The
   *  marker icon scales independently from the label font size. */
  markerSize: number;
  /** Absolute label font size in SVG units (≈ mm at typical canvases). The
   *  label is decoupled from the icon: marker size scales independently. */
  fontSizePx: number;
  /** Optional rounded background behind the label (ignored for bubble). */
  textBg: boolean;
  textBgColor: string;
  /** Side of the marker where the label sits (ignored for bubble). */
  textPosition: TextPosition;
};

const POI_STYLES: Array<{ id: PoiStyle; label: string }> = [
  { id: "pin", label: "Pin" },
  { id: "dot", label: "Dot" },
  { id: "bubble", label: "Bubble" },
  { id: "numbered", label: "Numbered" },
  { id: "flag", label: "Flag" },
];

const pois: Poi[] = [];

const newPoiId = () => "p" + Math.random().toString(36).slice(2, 10);

// Reverse-geocoded place name (filled after each render); used as the default
// text for new title overlays.
let suggestedTitle: string | null = null;

// -- Undo / redo for overlays + POIs ----------------------------------------

type HistorySnap = { overlays: Overlay[]; pois: Poi[]; routes: Route[] };
const undoStack: HistorySnap[] = [];
const redoStack: HistorySnap[] = [];
const HISTORY_LIMIT = 80;

const cloneSnap = (): HistorySnap => ({
  overlays: overlays.map((o) => ({ ...o })),
  pois: pois.map((p) => ({ ...p })),
  routes: routes.map((r) => ({
    ...r,
    poiIds: r.poiIds.slice(),
    controlPoints: (r.controlPoints ?? []).map((c) => ({ ...c })),
  })),
});

const restoreSnap = (snap: HistorySnap) => {
  overlays.length = 0;
  for (const o of snap.overlays) overlays.push({ ...o });
  pois.length = 0;
  for (const p of snap.pois) pois.push({ ...p });
  routes.length = 0;
  for (const r of snap.routes) {
    routes.push({
      ...r,
      poiIds: r.poiIds.slice(),
      controlPoints: (r.controlPoints ?? []).map((c) => ({ ...c })),
    });
  }
  selectedIds.clear();
  renderOverlayList();
  renderPoiList();
  renderRouteList();
  recompose();
};

/** Capture the current overlays+pois state to the undo stack. */
const snapshot = () => {
  undoStack.push(cloneSnap());
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack.length = 0;
};

const undo = () => {
  if (undoStack.length === 0) return;
  redoStack.push(cloneSnap());
  const prev = undoStack.pop()!;
  restoreSnap(prev);
  setStatus("undo", "ok");
};

const redo = () => {
  if (redoStack.length === 0) return;
  undoStack.push(cloneSnap());
  const next = redoStack.pop()!;
  restoreSnap(next);
  setStatus("redo", "ok");
};

const fetchSuggestedTitle = async () => {
  const b = norm();
  const lat = (b.south + b.north) / 2;
  const lng = (b.east + b.west) / 2;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&accept-language=${encodeURIComponent(navigator.language || "en")}`,
    );
    if (!res.ok) return;
    const data = (await res.json()) as {
      address?: Record<string, string>;
      name?: string;
    };
    const a = data.address ?? {};
    const name =
      a.city || a.town || a.village || a.hamlet || a.suburb ||
      a.county || a.state || data.name || "";
    suggestedTitle = name.trim() || null;
    if (suggestedTitle) {
      setStatus(`Place: ${suggestedTitle} — used for next “+ Add text”`, "ok");
    }
  } catch {
    /* offline / rate-limited; ignore */
  }
};

const addPoi = (atLat?: number, atLng?: number) => {
  snapshot();
  const b = norm();
  const lat = atLat ?? (b.south + b.north) / 2;
  const lng = atLng ?? (b.west + b.east) / 2;
  pois.push({
    id: newPoiId(),
    lat,
    lng,
    text: `POI ${pois.length + 1}`,
    style: "pin",
    color: "#e25c5c",
    textColor: "#1a1a1a",
    markerSize: 8,
    fontSizePx: 4,
    textBg: false,
    textBgColor: "#ffffff",
    textPosition: "bottom",
  });
  renderPoiList();
  recompose();
};

const renderPoiList = () => {
  poiListEl.innerHTML = "";
  for (const p of pois) {
    const li = document.createElement("li");
    li.className = "poi-row";
    li.dataset.id = p.id;

    const text = document.createElement("input");
    text.type = "text";
    text.value = p.text;
    text.placeholder = "label";
    text.addEventListener("input", () => {
      p.text = text.value;
      recompose();
    });

    const controls = document.createElement("div");
    controls.className = "poi-controls";

    const lat = document.createElement("input");
    lat.type = "number";
    lat.step = "0.000001";
    lat.value = p.lat.toFixed(6);
    lat.title = "Latitude";
    lat.addEventListener("input", () => {
      const v = parseFloat(lat.value);
      if (Number.isFinite(v)) { p.lat = v; recompose(); }
    });

    const lng = document.createElement("input");
    lng.type = "number";
    lng.step = "0.000001";
    lng.value = p.lng.toFixed(6);
    lng.title = "Longitude";
    lng.addEventListener("input", () => {
      const v = parseFloat(lng.value);
      if (Number.isFinite(v)) { p.lng = v; recompose(); }
    });

    const style = document.createElement("select");
    for (const s of POI_STYLES) {
      style.appendChild(new Option(s.label, s.id));
    }
    style.value = p.style;
    style.title = "Marker style";
    style.addEventListener("change", () => {
      p.style = style.value as PoiStyle;
      recompose();
    });

    const color = document.createElement("input");
    color.type = "color";
    color.value = p.color;
    color.title = "Fill / background color";
    color.addEventListener("input", () => {
      p.color = color.value;
      recompose();
    });

    const textColor = document.createElement("input");
    textColor.type = "color";
    textColor.value = p.textColor;
    textColor.title = "Text color (label / inside bubble / number)";
    textColor.addEventListener("input", () => {
      p.textColor = textColor.value;
      recompose();
    });

    const size = document.createElement("input");
    size.type = "number";
    size.step = "0.5";
    size.min = "0.5";
    size.value = String(p.markerSize);
    size.title = "Marker size (SVG units; ≈ mm at standard canvas)";
    size.addEventListener("input", () => {
      const v = parseFloat(size.value);
      if (Number.isFinite(v) && v > 0) { p.markerSize = v; recompose(); }
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete-btn";
    del.textContent = "✕";
    del.title = "Delete POI";
    del.addEventListener("click", () => {
      snapshot();
      const i = pois.findIndex((x) => x.id === p.id);
      if (i >= 0) pois.splice(i, 1);
      // Drop the deleted POI from every route and resync segment controls so
      // controlPoints[i] keeps pointing at the same segment afterwards.
      for (const r of routes) {
        if (r.poiIds.includes(p.id)) {
          r.poiIds = r.poiIds.filter((id) => id !== p.id);
          syncRouteControlPoints(r);
        }
      }
      renderPoiList();
      renderRouteList();
      recompose();
    });

    controls.append(lat, lng, style, color, textColor, size, del);

    const extras = document.createElement("div");
    extras.className = "poi-extras";

    const fontSize = document.createElement("input");
    fontSize.type = "number";
    fontSize.step = "0.5";
    fontSize.min = "1";
    fontSize.value = String(p.fontSizePx);
    fontSize.title = "Label font size (SVG units; ≈ mm at standard canvas)";
    const fontSizeLbl = document.createElement("label");
    fontSizeLbl.append("Text size", fontSize);
    fontSizeLbl.addEventListener("input", () => {
      const v = parseFloat(fontSize.value);
      if (Number.isFinite(v) && v > 0) {
        p.fontSizePx = v;
        recompose();
      }
    });

    const posSel = document.createElement("select");
    for (const pos of ["top", "bottom", "left", "right"] as const) {
      const opt = new Option(pos, pos);
      posSel.appendChild(opt);
    }
    posSel.value = p.textPosition;
    posSel.title = "Label position relative to the marker";
    posSel.addEventListener("change", () => {
      p.textPosition = posSel.value as TextPosition;
      recompose();
    });
    const posLbl = document.createElement("label");
    posLbl.append("Text pos", posSel);

    const bgCheck = document.createElement("input");
    bgCheck.type = "checkbox";
    bgCheck.checked = p.textBg;
    bgCheck.title = "Show a rounded background behind the label";
    bgCheck.addEventListener("change", () => {
      p.textBg = bgCheck.checked;
      recompose();
    });
    const bgCheckRow = document.createElement("label");
    bgCheckRow.className = "check-row";
    bgCheckRow.append(bgCheck, "bg");

    const bgColor = document.createElement("input");
    bgColor.type = "color";
    bgColor.value = p.textBgColor;
    bgColor.title = "Label background color";
    bgColor.addEventListener("input", () => {
      p.textBgColor = bgColor.value;
      recompose();
    });

    extras.append(fontSizeLbl, posLbl, bgCheckRow, bgColor);
    li.append(text, controls, extras);
    poiListEl.appendChild(li);
  }
  poiEmptyEl.hidden = pois.length > 0;
  refreshPoiMapMarkers();
};

addPoiBtn.addEventListener("click", () => addPoi());

// -- Routes connecting POIs -------------------------------------------------

type RouteStyle = "solid" | "dashed" | "dotted" | "arrow";

type RouteCurveCtrl = { lat: number; lng: number };

type Route = {
  id: string;
  name: string;
  color: string;
  style: RouteStyle;
  widthMm: number;
  /** Ordered list of POI ids the line passes through. */
  poiIds: string[];
  /** When true, each consecutive POI pair is connected by a quadratic Bezier
   *  whose control point lives in `controlPoints`. The control defaults to the
   *  segment's midpoint — so an un-touched curved route renders identically to
   *  the straight one until the user drags a handle. */
  curved: boolean;
  /** One control point per segment (length = max(0, poiIds.length - 1)).
   *  Stored as lat/lng so handles pan/zoom with the underlying map. */
  controlPoints: RouteCurveCtrl[];
};

/** Midpoint of two POIs in lat/lng space — the default control position for a
 *  curve segment (renders as a straight line). */
const segmentMidLatLng = (a: Poi, b: Poi): RouteCurveCtrl => ({
  lat: (a.lat + b.lat) / 2,
  lng: (a.lng + b.lng) / 2,
});

/** Resize `r.controlPoints` to match `poiIds.length - 1`. Existing entries are
 *  preserved by index; new entries are seeded to the segment midpoint. */
const syncRouteControlPoints = (r: Route) => {
  const segCount = Math.max(0, r.poiIds.length - 1);
  const old = r.controlPoints ?? [];
  const next: RouteCurveCtrl[] = [];
  for (let i = 0; i < segCount; i++) {
    if (old[i]) {
      next.push({ lat: old[i].lat, lng: old[i].lng });
      continue;
    }
    const a = pois.find((p) => p.id === r.poiIds[i]);
    const b = pois.find((p) => p.id === r.poiIds[i + 1]);
    next.push(a && b ? segmentMidLatLng(a, b) : { lat: 0, lng: 0 });
  }
  r.controlPoints = next;
};

const routes: Route[] = [];
const newRouteId = () => "rt" + Math.random().toString(36).slice(2, 10);

const addRoute = () => {
  snapshot();
  routes.push({
    id: newRouteId(),
    name: `Route ${routes.length + 1}`,
    color: "#4ea4ff",
    style: "solid",
    widthMm: 0.8,
    poiIds: [],
    curved: false,
    controlPoints: [],
  });
  renderRouteList();
  recompose();
};
addRouteBtn.addEventListener("click", addRoute);

const renderRouteList = () => {
  routeListEl.innerHTML = "";
  for (const r of routes) {
    const li = document.createElement("li");
    li.className = "route-row";
    li.dataset.id = r.id;

    const name = document.createElement("input");
    name.type = "text";
    name.value = r.name;
    name.placeholder = "route name";
    name.addEventListener("input", () => {
      r.name = name.value;
    });

    const seq = document.createElement("input");
    seq.type = "text";
    seq.placeholder = "POI numbers (e.g. 1, 3, 5)";
    seq.value = r.poiIds
      .map((id) => {
        const idx = pois.findIndex((p) => p.id === id);
        return idx >= 0 ? String(idx + 1) : "";
      })
      .filter((s) => s)
      .join(", ");
    seq.addEventListener("input", () => {
      const nums = seq.value
        .split(/[,\s]+/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0);
      r.poiIds = nums
        .map((n) => pois[n - 1]?.id)
        .filter((id): id is string => !!id);
      syncRouteControlPoints(r);
      recompose();
    });

    const controls = document.createElement("div");
    controls.className = "route-controls";

    const style = document.createElement("select");
    for (const s of ["solid", "dashed", "dotted", "arrow"] as const) {
      style.appendChild(new Option(s, s));
    }
    style.value = r.style;
    style.title = "Line style";
    style.addEventListener("change", () => {
      r.style = style.value as RouteStyle;
      recompose();
    });

    const color = document.createElement("input");
    color.type = "color";
    color.value = r.color;
    color.title = "Line color";
    color.addEventListener("input", () => {
      r.color = color.value;
      recompose();
    });

    const width = document.createElement("input");
    width.type = "number";
    width.step = "0.1";
    width.min = "0.1";
    width.value = String(r.widthMm);
    width.title = "Width (mm)";
    width.addEventListener("input", () => {
      const v = parseFloat(width.value);
      if (Number.isFinite(v) && v > 0) {
        r.widthMm = v;
        recompose();
      }
    });

    const curveCheck = document.createElement("input");
    curveCheck.type = "checkbox";
    curveCheck.checked = r.curved;
    curveCheck.title = "Smooth curve — drag the handles to shape it";
    const curveLbl = document.createElement("label");
    curveLbl.className = "check-row";
    curveLbl.append(curveCheck, "curve");
    curveCheck.addEventListener("change", () => {
      r.curved = curveCheck.checked;
      if (r.curved) syncRouteControlPoints(r);
      recompose();
    });

    const resetCurve = document.createElement("button");
    resetCurve.type = "button";
    resetCurve.className = "route-reset-curve";
    resetCurve.textContent = "⤺";
    resetCurve.title = "Reset curve handles to straight";
    resetCurve.addEventListener("click", () => {
      snapshot();
      r.controlPoints = [];
      syncRouteControlPoints(r);
      recompose();
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete-btn";
    del.textContent = "✕";
    del.title = "Delete route";
    del.addEventListener("click", () => {
      snapshot();
      const i = routes.findIndex((x) => x.id === r.id);
      if (i >= 0) routes.splice(i, 1);
      renderRouteList();
      recompose();
    });

    controls.append(style, color, width, curveLbl, resetCurve, del);
    li.append(name, seq, controls);
    routeListEl.appendChild(li);
  }
  routeEmptyEl.hidden = routes.length > 0;
};

const projectPoiToCanvas = (
  poi: Poi,
  mx: number, my: number, mw: number, mh: number,
): { x: number; y: number } | null => {
  const b = norm();
  if (poi.lat < b.south || poi.lat > b.north || poi.lng < b.west || poi.lng > b.east) {
    return null;
  }
  const minB = mercatorXY(b.west, b.south);
  const maxB = mercatorXY(b.east, b.north);
  const dx = maxB.x - minB.x;
  const dy = maxB.y - minB.y;
  if (!(dx > 0) || !(dy > 0)) return null;
  const m = mercatorXY(poi.lng, poi.lat);
  const u = (m.x - minB.x) / dx;
  const v = (maxB.y - m.y) / dy;
  return { x: mx + u * mw, y: my + v * mh };
};

/** Project a lat/lng to canvas coordinates without rejecting points outside
 *  the bbox — useful for curve control handles, which the user may drag past
 *  the visible map area. */
const projectLatLngToCanvasRaw = (
  lng: number, lat: number,
  mx: number, my: number, mw: number, mh: number,
): { x: number; y: number } | null => {
  const b = norm();
  const minB = mercatorXY(b.west, b.south);
  const maxB = mercatorXY(b.east, b.north);
  const dx = maxB.x - minB.x;
  const dy = maxB.y - minB.y;
  if (!(dx > 0) || !(dy > 0)) return null;
  const m = mercatorXY(lng, lat);
  const u = (m.x - minB.x) / dx;
  const v = (maxB.y - m.y) / dy;
  return { x: mx + u * mw, y: my + v * mh };
};

/** Build a per-segment quadratic-Bezier path string. Each segment from pts[i]
 *  to pts[i+1] uses ctrls[i] as its off-curve control. When the control sits
 *  at the segment midpoint the segment is straight. */
const buildCurvedPathD = (
  pts: { x: number; y: number }[],
  ctrls: { x: number; y: number }[],
): string => {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const c = ctrls[i] ?? {
      x: (pts[i].x + pts[i + 1].x) / 2,
      y: (pts[i].y + pts[i + 1].y) / 2,
    };
    d +=
      ` Q${c.x.toFixed(2)},${c.y.toFixed(2)} ` +
      `${pts[i + 1].x.toFixed(2)},${pts[i + 1].y.toFixed(2)}`;
  }
  return d;
};

const renderRoutes = (
  mx: number, my: number, mw: number, mh: number,
  forExport = false,
): { defs: string; body: string } => {
  if (routes.length === 0) return { defs: "", body: "" };
  let defs = "";
  let body = "";
  for (const r of routes) {
    if (r.poiIds.length < 2) continue;
    if (!r.controlPoints || r.controlPoints.length !== r.poiIds.length - 1) {
      syncRouteControlPoints(r);
    }

    // Resolve the projected POI positions in poiIds order, remembering each
    // point's original POI index so we can look up the matching control point.
    const segPts: { x: number; y: number; fromIdx: number }[] = [];
    for (let i = 0; i < r.poiIds.length; i++) {
      const poi = pois.find((p) => p.id === r.poiIds[i]);
      if (!poi) continue;
      const p = projectPoiToCanvas(poi, mx, my, mw, mh);
      if (p) segPts.push({ x: p.x, y: p.y, fromIdx: i });
    }
    if (segPts.length < 2) continue;

    const sw = Math.max(0.15, r.widthMm).toFixed(2);
    let dashAttr = "";
    let markerAttr = "";
    switch (r.style) {
      case "dashed":
        dashAttr = ` stroke-dasharray="${(r.widthMm * 4).toFixed(2)} ${(r.widthMm * 2).toFixed(2)}"`;
        break;
      case "dotted":
        dashAttr = ` stroke-dasharray="${(r.widthMm * 0.5).toFixed(2)} ${(r.widthMm * 1.8).toFixed(2)}"`;
        break;
      case "arrow":
        markerAttr = ` marker-end="url(#arrow-${r.id})"`;
        defs +=
          `<marker id="arrow-${r.id}" viewBox="0 0 10 10" ` +
          `refX="9" refY="5" markerWidth="${(r.widthMm * 5).toFixed(2)}" ` +
          `markerHeight="${(r.widthMm * 5).toFixed(2)}" orient="auto-start-reverse">` +
          `<path d="M0,0 L10,5 L0,10 Z" fill="${r.color}"/></marker>`;
        break;
    }
    const common =
      `fill="none" stroke="${r.color}" stroke-width="${sw}" ` +
      `stroke-linecap="round" stroke-linejoin="round"${dashAttr}${markerAttr}`;

    if (r.curved) {
      // Project each segment's control point to canvas; fall back to the
      // segment midpoint when the control hasn't been synced yet.
      const pts = segPts.map((p) => ({ x: p.x, y: p.y }));
      const ctrls: { x: number; y: number }[] = [];
      const handles: { x: number; y: number; segIdx: number }[] = [];
      for (let i = 0; i < segPts.length - 1; i++) {
        const a = segPts[i];
        const b = segPts[i + 1];
        const segIdx = a.fromIdx;
        const cp = r.controlPoints[segIdx];
        let cx = (a.x + b.x) / 2;
        let cy = (a.y + b.y) / 2;
        if (cp) {
          const proj = projectLatLngToCanvasRaw(cp.lng, cp.lat, mx, my, mw, mh);
          if (proj) { cx = proj.x; cy = proj.y; }
        }
        ctrls.push({ x: cx, y: cy });
        handles.push({ x: cx, y: cy, segIdx });
      }
      const d = buildCurvedPathD(pts, ctrls);
      body +=
        `    <path class="route route-${r.style} route-curved" data-id="${r.id}" d="${d}" ${common}/>\n`;
      if (!forExport) {
        const handleR = Math.max(0.9, r.widthMm * 1.8);
        const handleStroke = Math.max(0.18, r.widthMm * 0.45).toFixed(2);
        for (const h of handles) {
          body +=
            `    <circle class="route-curve-handle" data-route-id="${r.id}" ` +
            `data-seg-idx="${h.segIdx}" ` +
            `cx="${h.x.toFixed(2)}" cy="${h.y.toFixed(2)}" ` +
            `r="${handleR.toFixed(2)}" fill="#4ea4ff" fill-opacity="0.85" ` +
            `stroke="#ffffff" stroke-width="${handleStroke}" ` +
            `style="cursor:move"/>\n`;
        }
      }
    } else {
      const pointsStr = segPts
        .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
        .join(" ");
      body +=
        `    <polyline class="route route-${r.style}" data-id="${r.id}" points="${pointsStr}" ${common}/>\n`;
    }
  }
  if (body) body = `  <g class="layer-routes">\n${body}  </g>\n`;
  return { defs, body };
};

// -- POI markers on the editor map ------------------------------------------

const poiMapMarkers = new Map<string, maplibregl.Marker>();

const refreshPoiMapMarkers = () => {
  // Remove markers for POIs that no longer exist.
  for (const [id, m] of poiMapMarkers) {
    if (!pois.find((p) => p.id === id)) {
      m.remove();
      poiMapMarkers.delete(id);
    }
  }
  // Add / update markers for current POIs.
  for (const p of pois) {
    let m = poiMapMarkers.get(p.id);
    if (!m) {
      const el = document.createElement("div");
      el.className = "map-poi-marker";
      const dot = document.createElement("div");
      dot.className = "map-poi-dot";
      const label = document.createElement("div");
      label.className = "map-poi-label";
      el.append(dot, label);
      m = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([p.lng, p.lat])
        .addTo(map);
      poiMapMarkers.set(p.id, m);
    }
    m.setLngLat([p.lng, p.lat]);
    const el = m.getElement();
    const dot = el.querySelector<HTMLElement>(".map-poi-dot");
    const label = el.querySelector<HTMLElement>(".map-poi-label");
    if (dot) dot.style.background = p.color;
    if (label) label.textContent = p.text;
  }
};

// Left-click or right-click on the map drops a POI at the clicked location.
// MapLibre's click event suppresses itself after a drag, so panning still works.
const dropPoiAt = (e: maplibregl.MapMouseEvent) => {
  addPoi(e.lngLat.lat, e.lngLat.lng);
  setStatus(
    `POI dropped at ${e.lngLat.lat.toFixed(5)}, ${e.lngLat.lng.toFixed(5)}`,
    "ok",
  );
};
map.on("click", dropPoiAt);
map.on("contextmenu", (e) => {
  e.originalEvent.preventDefault();
  dropPoiAt(e);
});

// -- POI marker SVG generators ----------------------------------------------

const mercatorXY = (lng: number, lat: number) => {
  const R = 6378137;
  const x = (R * lng * Math.PI) / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return { x, y };
};

const inverseMercator = (x: number, y: number) => {
  const R = 6378137;
  const lng = ((x / R) * 180) / Math.PI;
  const lat =
    ((2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180) / Math.PI;
  return { lng, lat };
};

/** Place a label relative to a marker's bounding box and optionally render a
 *  rounded background behind it. Returns the SVG fragment (rect + text). */
const renderPoiLabel = (
  poi: Poi,
  bounds: { top: number; bottom: number; left: number; right: number },
  _baseFontSize: number,
  weight: number | string = 500,
  halo: boolean = true,
): string => {
  if (!poi.text) return "";
  // Font size is the absolute user value — independent of marker scale.
  const fontSize = poi.fontSizePx > 0 ? poi.fontSizePx : 4;
  const pad = fontSize * 0.32;
  void _baseFontSize;
  let x: number;
  let y: number;
  let anchor: "start" | "middle" | "end";
  let baseline: "alphabetic" | "middle" | "hanging";
  switch (poi.textPosition) {
    case "top":
      x = (bounds.left + bounds.right) / 2;
      y = bounds.top - pad;
      anchor = "middle";
      baseline = "alphabetic";
      break;
    case "left":
      x = bounds.left - pad;
      y = (bounds.top + bounds.bottom) / 2;
      anchor = "end";
      baseline = "middle";
      break;
    case "right":
      x = bounds.right + pad;
      y = (bounds.top + bounds.bottom) / 2;
      anchor = "start";
      baseline = "middle";
      break;
    case "bottom":
    default:
      x = (bounds.left + bounds.right) / 2;
      y = bounds.bottom + pad + fontSize * 0.85;
      anchor = "middle";
      baseline = "alphabetic";
      break;
  }

  let bg = "";
  if (poi.textBg) {
    const estimatedW = Math.max(1, poi.text.length) * fontSize * 0.55;
    const padX = fontSize * 0.45;
    const padY = fontSize * 0.28;
    let rx: number;
    if (anchor === "start") rx = x - padX;
    else if (anchor === "end") rx = x - estimatedW - padX;
    else rx = x - estimatedW / 2 - padX;
    let ry: number;
    if (baseline === "alphabetic") ry = y - fontSize + padY * 0.4;
    else ry = y - fontSize / 2 - padY * 0.2; // "middle"
    const rw = estimatedW + 2 * padX;
    const rh = fontSize + 2 * padY * 0.7;
    const radius = Math.min(rh / 2, fontSize * 0.5);
    bg =
      `    <rect x="${rx.toFixed(2)}" y="${ry.toFixed(2)}" ` +
      `width="${rw.toFixed(2)}" height="${rh.toFixed(2)}" ` +
      `rx="${radius.toFixed(2)}" ry="${radius.toFixed(2)}" ` +
      `fill="${poi.textBgColor}" stroke="rgba(0,0,0,0.18)" stroke-width="${(fontSize * 0.04).toFixed(3)}"/>\n`;
  }

  // When a bg is shown the halo is redundant and just thickens the type;
  // skip it. Otherwise paint-order + white stroke keeps text legible
  // against busy map backgrounds.
  const haloAttrs =
    halo && !poi.textBg
      ? ` paint-order="stroke" stroke="#ffffff" stroke-width="${(fontSize * 0.18).toFixed(3)}"`
      : "";

  return (
    bg +
    `    <text x="${x.toFixed(2)}" y="${y.toFixed(2)}" ` +
    `font-size="${fontSize.toFixed(2)}" font-family="Helvetica, Arial, sans-serif" ` +
    `font-weight="${weight}" text-anchor="${anchor}" ` +
    `dominant-baseline="${baseline}" fill="${poi.textColor}"${haloAttrs}>${escapeXml(poi.text)}</text>\n`
  );
};

const renderPoiPin = (poi: Poi, x: number, y: number, s: number): string => {
  const m = s;
  const fontSize = s * 0.42;
  const bounds = {
    top: y - m * 1.5,
    bottom: y,
    left: x - m * 0.52,
    right: x + m * 0.52,
  };
  return (
    `  <g class="poi poi-pin" data-id="${poi.id}" style="cursor:move">\n` +
    `    <path d="M ${x.toFixed(2)},${y.toFixed(2)} L ${(x - m * 0.42).toFixed(2)},${(y - m * 0.95).toFixed(2)} A ${(m * 0.52).toFixed(2)},${(m * 0.52).toFixed(2)} 0 1 1 ${(x + m * 0.42).toFixed(2)},${(y - m * 0.95).toFixed(2)} Z" fill="${poi.color}" stroke="#111" stroke-width="${(m * 0.04).toFixed(3)}"/>\n` +
    `    <circle cx="${x.toFixed(2)}" cy="${(y - m * 1.05).toFixed(2)}" r="${(m * 0.16).toFixed(2)}" fill="#ffffff"/>\n` +
    renderPoiLabel(poi, bounds, fontSize, 600) +
    `  </g>\n`
  );
};

const renderPoiDot = (poi: Poi, x: number, y: number, s: number): string => {
  const r = s * 0.20;
  const fontSize = s * 0.36;
  const bounds = { top: y - r, bottom: y + r, left: x - r, right: x + r };
  return (
    `  <g class="poi poi-dot" data-id="${poi.id}" style="cursor:move">\n` +
    `    <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}" fill="${poi.color}" stroke="#111" stroke-width="${(s * 0.03).toFixed(3)}"/>\n` +
    renderPoiLabel(poi, bounds, fontSize, 500) +
    `  </g>\n`
  );
};

const renderPoiBubble = (poi: Poi, x: number, y: number, s: number): string => {
  const ms = s;
  const fontSize = s * 0.4;
  const padX = ms * 0.28;
  const padY = ms * 0.22;
  const textW =
    Math.max(1, poi.text.length) * fontSize * 0.55 + padX * 2;
  const textH = fontSize + padY * 2;
  const tailH = ms * 0.32;
  const bx = x - textW / 2;
  const by = y - textH - tailH;
  const r = Math.min(textH * 0.35, ms * 0.18);
  const tailW = ms * 0.28;
  const path =
    `M ${(bx + r).toFixed(2)},${by.toFixed(2)} ` +
    `H ${(bx + textW - r).toFixed(2)} ` +
    `A ${r.toFixed(2)},${r.toFixed(2)} 0 0 1 ${(bx + textW).toFixed(2)},${(by + r).toFixed(2)} ` +
    `V ${(by + textH - r).toFixed(2)} ` +
    `A ${r.toFixed(2)},${r.toFixed(2)} 0 0 1 ${(bx + textW - r).toFixed(2)},${(by + textH).toFixed(2)} ` +
    `H ${(x + tailW / 2).toFixed(2)} ` +
    `L ${x.toFixed(2)},${y.toFixed(2)} ` +
    `L ${(x - tailW / 2).toFixed(2)},${(by + textH).toFixed(2)} ` +
    `H ${(bx + r).toFixed(2)} ` +
    `A ${r.toFixed(2)},${r.toFixed(2)} 0 0 1 ${bx.toFixed(2)},${(by + textH - r).toFixed(2)} ` +
    `V ${(by + r).toFixed(2)} ` +
    `A ${r.toFixed(2)},${r.toFixed(2)} 0 0 1 ${(bx + r).toFixed(2)},${by.toFixed(2)} Z`;
  return (
    `  <g class="poi poi-bubble" data-id="${poi.id}" style="cursor:move">\n` +
    `    <path d="${path}" fill="${poi.color}" stroke="#111" stroke-width="${(ms * 0.04).toFixed(3)}"/>\n` +
    (poi.text
      ? `    <text x="${x.toFixed(2)}" y="${(by + textH / 2 + fontSize * 0.34).toFixed(2)}" font-size="${fontSize.toFixed(2)}" font-family="Helvetica, Arial, sans-serif" font-weight="500" text-anchor="middle" fill="${poi.textColor}">${escapeXml(poi.text)}</text>\n`
      : "") +
    `  </g>\n`
  );
};

const renderPoiNumbered = (
  poi: Poi,
  x: number,
  y: number,
  s: number,
  index: number,
): string => {
  const r = s * 0.42;
  const numberSize = r * 1.1; // number sized to fit inside the scaled circle
  const labelSize = s * 0.32;
  const bounds = { top: y - r, bottom: y + r, left: x - r, right: x + r };
  return (
    `  <g class="poi poi-numbered" data-id="${poi.id}" style="cursor:move">\n` +
    `    <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}" fill="${poi.color}" stroke="#111" stroke-width="${(s * 0.05).toFixed(3)}"/>\n` +
    `    <text x="${x.toFixed(2)}" y="${(y + numberSize * 0.33).toFixed(2)}" font-size="${numberSize.toFixed(2)}" font-family="Helvetica, Arial, sans-serif" font-weight="700" text-anchor="middle" fill="${poi.textColor}">${index}</text>\n` +
    renderPoiLabel(poi, bounds, labelSize, 500) +
    `  </g>\n`
  );
};

const renderPoiFlag = (poi: Poi, x: number, y: number, s: number): string => {
  const ms = s;
  const poleH = ms * 1.0;
  const flagW = ms * 0.65;
  const flagH = ms * 0.42;
  const top = y - poleH;
  // Label sits below the pole base, centered on x (same convention as Pin),
  // not under the flag's visible right-side rectangle.
  const bounds = {
    top,
    bottom: y,
    left: x - ms * 0.5,
    right: x + ms * 0.5,
  };
  return (
    `  <g class="poi poi-flag" data-id="${poi.id}" style="cursor:move">\n` +
    `    <line x1="${x.toFixed(2)}" y1="${y.toFixed(2)}" x2="${x.toFixed(2)}" y2="${top.toFixed(2)}" stroke="#111" stroke-width="${(ms * 0.06).toFixed(3)}" stroke-linecap="round"/>\n` +
    `    <path d="M ${x.toFixed(2)},${top.toFixed(2)} L ${(x + flagW).toFixed(2)},${(top + flagH * 0.25).toFixed(2)} L ${x.toFixed(2)},${(top + flagH).toFixed(2)} Z" fill="${poi.color}" stroke="#111" stroke-width="${(ms * 0.04).toFixed(3)}" stroke-linejoin="round"/>\n` +
    renderPoiLabel(poi, bounds, 0, 600) +
    `  </g>\n`
  );
};

const renderPoiMarker = (
  poi: Poi,
  x: number,
  y: number,
  s: number,
  index: number,
): string => {
  switch (poi.style) {
    case "pin":      return renderPoiPin(poi, x, y, s);
    case "dot":      return renderPoiDot(poi, x, y, s);
    case "bubble":   return renderPoiBubble(poi, x, y, s);
    case "numbered": return renderPoiNumbered(poi, x, y, s, index);
    case "flag":     return renderPoiFlag(poi, x, y, s);
  }
};

// -- Graticule (lat / lng grid) ---------------------------------------------

const niceInterval = (range: number): number => {
  if (!(range > 0)) return 1;
  const target = range / 6;
  const log = Math.floor(Math.log10(target));
  const base = Math.pow(10, log);
  const ratio = target / base;
  if (ratio < 1.5) return base;
  if (ratio < 3.5) return 2 * base;
  if (ratio < 7.5) return 5 * base;
  return 10 * base;
};

const fmtCoord = (val: number, interval: number, pos: string, neg: string): string => {
  const decimals = Math.max(0, Math.min(6, -Math.floor(Math.log10(interval))));
  return `${Math.abs(val).toFixed(decimals)}°${val >= 0 ? pos : neg}`;
};

const renderGraticule = (
  b: { south: number; west: number; north: number; east: number },
  mx: number, my: number, mw: number, mh: number,
  minDim: number,
  showLabels: boolean,
  labelColor: string,
  haloColor: string,
): string => {
  const minBbox = mercatorXY(b.west, b.south);
  const maxBbox = mercatorXY(b.east, b.north);
  const dxMerc = maxBbox.x - minBbox.x;
  const dyMerc = maxBbox.y - minBbox.y;
  if (!(dxMerc > 0) || !(dyMerc > 0)) return "";

  const latStep = niceInterval(b.north - b.south);
  const lngStep = niceInterval(b.east - b.west);
  const lineColor = labelColor;
  const lineOpacity = "0.35";
  const lineW = Math.max(0.15, minDim * 0.0008).toFixed(2);
  const fs = minDim * 0.014;
  const halo = (fs * 0.22).toFixed(2);

  let lines = "";
  let labels = "";

  // Horizontal lines (constant latitude).
  const startLat = Math.ceil(b.south / latStep) * latStep;
  let count = 0;
  for (let lat = startLat; lat <= b.north + 1e-9 && count < 64; lat += latStep, count++) {
    const v = (maxBbox.y - mercatorXY(0, lat).y) / dyMerc;
    const y = my + v * mh;
    lines +=
      `    <line x1="${mx.toFixed(2)}" y1="${y.toFixed(2)}" ` +
      `x2="${(mx + mw).toFixed(2)}" y2="${y.toFixed(2)}" ` +
      `stroke="${lineColor}" stroke-width="${lineW}" stroke-opacity="${lineOpacity}"/>\n`;
    if (showLabels) {
      labels +=
        `    <text x="${(mx + fs * 0.45).toFixed(2)}" y="${(y - fs * 0.3).toFixed(2)}" ` +
        `font-size="${fs.toFixed(2)}" font-family="ui-monospace, 'Courier New', monospace" ` +
        `fill="${lineColor}" paint-order="stroke" stroke="${haloColor}" ` +
        `stroke-width="${halo}" letter-spacing="0.04em">${fmtCoord(lat, latStep, "N", "S")}</text>\n`;
    }
  }

  // Vertical lines (constant longitude).
  const startLng = Math.ceil(b.west / lngStep) * lngStep;
  count = 0;
  for (let lng = startLng; lng <= b.east + 1e-9 && count < 64; lng += lngStep, count++) {
    const u = (mercatorXY(lng, 0).x - minBbox.x) / dxMerc;
    const x = mx + u * mw;
    lines +=
      `    <line x1="${x.toFixed(2)}" y1="${my.toFixed(2)}" ` +
      `x2="${x.toFixed(2)}" y2="${(my + mh).toFixed(2)}" ` +
      `stroke="${lineColor}" stroke-width="${lineW}" stroke-opacity="${lineOpacity}"/>\n`;
    if (showLabels) {
      labels +=
        `    <text x="${(x + fs * 0.35).toFixed(2)}" y="${(my + mh - fs * 0.5).toFixed(2)}" ` +
        `font-size="${fs.toFixed(2)}" font-family="ui-monospace, 'Courier New', monospace" ` +
        `fill="${lineColor}" paint-order="stroke" stroke="${haloColor}" ` +
        `stroke-width="${halo}" letter-spacing="0.04em">${fmtCoord(lng, lngStep, "E", "W")}</text>\n`;
    }
  }

  return `  <g class="graticule" style="pointer-events:none">\n${lines}${labels}  </g>\n`;
};

// -- Theme leading color (used by the cross + marker) ----------------------

/** Extract the theme's background color from `.background { fill: … }`. Used
 *  as the default canvas-bg so the print's outer paper matches the theme. */
const themeBackgroundColor = (css: string): string => {
  const m = css.match(
    /\.background\s*\{[^}]*?\bfill\s*:\s*([^;}\s!]+)/i,
  );
  if (m) {
    const v = m[1].trim();
    if (v && v !== "none" && v !== "inherit" && v !== "currentColor") {
      return v;
    }
  }
  return "#fafafa";
};

/** Extract a representative stroke color from the active CSS — used so the
 *  lat/lng cross + marker tonally match the theme without a manual picker. */
const themeLeadingColor = (css: string): string => {
  const probes: RegExp[] = [
    /\.road-motorway\s*\{[^}]*?\bstroke\s*:\s*([^;}\s!]+)/i,
    /\.road-trunk\s*\{[^}]*?\bstroke\s*:\s*([^;}\s!]+)/i,
    /\.road-primary\s*\{[^}]*?\bstroke\s*:\s*([^;}\s!]+)/i,
    /\.coastline\s*\{[^}]*?\bstroke\s*:\s*([^;}\s!]+)/i,
    /\.layer-road\s+polyline\s*\{[^}]*?\bstroke\s*:\s*([^;}\s!]+)/i,
  ];
  for (const re of probes) {
    const m = css.match(re);
    if (m) {
      const v = m[1].trim();
      if (v && v !== "none" && v !== "inherit" && v !== "currentColor") {
        return v;
      }
    }
  }
  return "#111";
};

// -- Cross at chosen lat/lng + styled marker --------------------------------

type CrossMarkerStyle = "crosshair" | "target" | "diamond" | "compass";

const renderCrosshair = (x: number, y: number, r: number, color: string): string => {
  const sw = Math.max(0.2, r * 0.08);
  return (
    `    <line x1="${(x - r).toFixed(2)}" y1="${y.toFixed(2)}" x2="${(x + r).toFixed(2)}" y2="${y.toFixed(2)}" stroke="${color}" stroke-width="${sw.toFixed(2)}" stroke-linecap="round"/>\n` +
    `    <line x1="${x.toFixed(2)}" y1="${(y - r).toFixed(2)}" x2="${x.toFixed(2)}" y2="${(y + r).toFixed(2)}" stroke="${color}" stroke-width="${sw.toFixed(2)}" stroke-linecap="round"/>\n` +
    `    <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(r * 0.18).toFixed(2)}" fill="${color}"/>\n`
  );
};

const renderTarget = (x: number, y: number, r: number, color: string): string => {
  const sw = Math.max(0.2, r * 0.06);
  return (
    `    <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}" fill="none" stroke="${color}" stroke-width="${sw.toFixed(2)}"/>\n` +
    `    <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(r * 0.66).toFixed(2)}" fill="none" stroke="${color}" stroke-width="${sw.toFixed(2)}"/>\n` +
    `    <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(r * 0.33).toFixed(2)}" fill="none" stroke="${color}" stroke-width="${sw.toFixed(2)}"/>\n` +
    `    <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(r * 0.10).toFixed(2)}" fill="${color}"/>\n`
  );
};

const renderDiamond = (x: number, y: number, r: number, color: string): string => {
  const sw = Math.max(0.25, r * 0.08);
  return (
    `    <path d="M ${x.toFixed(2)},${(y - r).toFixed(2)} L ${(x + r).toFixed(2)},${y.toFixed(2)} L ${x.toFixed(2)},${(y + r).toFixed(2)} L ${(x - r).toFixed(2)},${y.toFixed(2)} Z" fill="${color}" stroke="#111" stroke-width="${sw.toFixed(2)}" stroke-linejoin="round"/>\n` +
    `    <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(r * 0.18).toFixed(2)}" fill="#ffffff"/>\n`
  );
};

const renderCompass = (x: number, y: number, r: number, color: string): string => {
  const sw = Math.max(0.25, r * 0.06);
  // 4-point star (N/E/S/W) + inner ring + N label.
  const a = r;
  const i = r * 0.32;
  const star =
    `M ${x.toFixed(2)},${(y - a).toFixed(2)} ` +
    `L ${(x + i).toFixed(2)},${(y - i).toFixed(2)} ` +
    `L ${(x + a).toFixed(2)},${y.toFixed(2)} ` +
    `L ${(x + i).toFixed(2)},${(y + i).toFixed(2)} ` +
    `L ${x.toFixed(2)},${(y + a).toFixed(2)} ` +
    `L ${(x - i).toFixed(2)},${(y + i).toFixed(2)} ` +
    `L ${(x - a).toFixed(2)},${y.toFixed(2)} ` +
    `L ${(x - i).toFixed(2)},${(y - i).toFixed(2)} Z`;
  // Two-tone halves: split along the N-S axis using two triangles.
  const right =
    `M ${x.toFixed(2)},${(y - a).toFixed(2)} ` +
    `L ${(x + i).toFixed(2)},${(y - i).toFixed(2)} ` +
    `L ${(x + a).toFixed(2)},${y.toFixed(2)} ` +
    `L ${(x + i).toFixed(2)},${(y + i).toFixed(2)} ` +
    `L ${x.toFixed(2)},${(y + a).toFixed(2)} Z`;
  return (
    `    <path d="${star}" fill="${color}" stroke="#111" stroke-width="${sw.toFixed(2)}" stroke-linejoin="round"/>\n` +
    `    <path d="${right}" fill="#ffffff" fill-opacity="0.32"/>\n` +
    `    <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(r * 0.22).toFixed(2)}" fill="none" stroke="#111" stroke-width="${sw.toFixed(2)}"/>\n` +
    `    <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(r * 0.09).toFixed(2)}" fill="#111"/>\n` +
    `    <text x="${x.toFixed(2)}" y="${(y - a - r * 0.18).toFixed(2)}" font-size="${(r * 0.42).toFixed(2)}" font-family="Helvetica, Arial, sans-serif" font-weight="700" text-anchor="middle" fill="#111" paint-order="stroke" stroke="#ffffff" stroke-width="${(r * 0.08).toFixed(2)}">N</text>\n`
  );
};

const renderCrossMarker = (
  x: number, y: number, r: number, style: CrossMarkerStyle, color: string,
): string => {
  switch (style) {
    case "crosshair": return renderCrosshair(x, y, r, color);
    case "target":    return renderTarget(x, y, r, color);
    case "diamond":   return renderDiamond(x, y, r, color);
    case "compass":   return renderCompass(x, y, r, color);
  }
};

const renderCross = (
  b: { south: number; west: number; north: number; east: number },
  mx: number, my: number, mw: number, mh: number,
  minDim: number,
  lat: number, lng: number,
  lineColor: string,
  marker: { style: CrossMarkerStyle; color: string; sizeFrac: number },
  showLabels: boolean,
  /** Both in [-1, 1]; ±0.5 = at the respective edge. */
  latLabelOffset: number,
  lngLabelOffset: number,
): string => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  if (lat < b.south || lat > b.north || lng < b.west || lng > b.east) return "";
  const minBbox = mercatorXY(b.west, b.south);
  const maxBbox = mercatorXY(b.east, b.north);
  const dx = maxBbox.x - minBbox.x;
  const dy = maxBbox.y - minBbox.y;
  if (!(dx > 0) || !(dy > 0)) return "";

  const m = mercatorXY(lng, lat);
  const u = (m.x - minBbox.x) / dx;
  const v = (maxBbox.y - m.y) / dy;
  const cx = mx + u * mw;
  const cy = my + v * mh;

  const lineW = Math.max(0.2, minDim * 0.0012).toFixed(2);
  const r = Math.max(2, minDim * marker.sizeFrac);

  let labels = "";
  if (showLabels) {
    const fs = minDim * 0.018;
    const halo = (fs * 0.22).toFixed(2);
    const latTxt = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}`;
    const lngTxt = `${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`;

    // Latitude label slides along the horizontal line. offset −0.5 = left edge,
    // 0 = at the intersection, +0.5 = right edge. ±1 puts it in the margin.
    const latPosX = mx + mw * (0.5 + latLabelOffset);
    const latAnchor =
      latLabelOffset < -0.25 ? "start" : latLabelOffset > 0.25 ? "end" : "middle";
    const latPad =
      latAnchor === "start" ? fs * 0.4 : latAnchor === "end" ? -fs * 0.4 : 0;
    labels +=
      `    <text x="${(latPosX + latPad).toFixed(2)}" y="${(cy - fs * 0.4).toFixed(2)}" ` +
      `font-size="${fs.toFixed(2)}" font-family="ui-monospace, 'Courier New', monospace" ` +
      `font-weight="600" fill="${lineColor}" text-anchor="${latAnchor}" ` +
      `paint-order="stroke" stroke="#fafafa" stroke-width="${halo}" ` +
      `letter-spacing="0.05em">${latTxt}</text>\n`;

    // Longitude label slides along the vertical line. offset −0.5 = top edge,
    // 0 = at the intersection, +0.5 = bottom edge.
    const lngPosY = my + mh * (0.5 + lngLabelOffset);
    // Flip baseline so the label sits *inside* the map relative to its anchor.
    const lngBaseline =
      lngLabelOffset < -0.25 ? "hanging" :
      lngLabelOffset > 0.25 ? "alphabetic" : "middle";
    const lngPad =
      lngBaseline === "hanging" ? fs * 0.35 :
      lngBaseline === "alphabetic" ? -fs * 0.35 : 0;
    labels +=
      `    <text x="${(cx + fs * 0.45).toFixed(2)}" y="${(lngPosY + lngPad).toFixed(2)}" ` +
      `font-size="${fs.toFixed(2)}" font-family="ui-monospace, 'Courier New', monospace" ` +
      `font-weight="600" fill="${lineColor}" dominant-baseline="${lngBaseline}" ` +
      `paint-order="stroke" stroke="#fafafa" stroke-width="${halo}" ` +
      `letter-spacing="0.05em">${lngTxt}</text>\n`;
  }

  return (
    `  <g class="cross" style="pointer-events:none">\n` +
    `    <line x1="${mx.toFixed(2)}" y1="${cy.toFixed(2)}" x2="${(mx + mw).toFixed(2)}" y2="${cy.toFixed(2)}" stroke="${lineColor}" stroke-width="${lineW}" stroke-dasharray="${(r * 0.18).toFixed(2)} ${(r * 0.14).toFixed(2)}" stroke-opacity="0.75"/>\n` +
    `    <line x1="${cx.toFixed(2)}" y1="${my.toFixed(2)}" x2="${cx.toFixed(2)}" y2="${(my + mh).toFixed(2)}" stroke="${lineColor}" stroke-width="${lineW}" stroke-dasharray="${(r * 0.18).toFixed(2)} ${(r * 0.14).toFixed(2)}" stroke-opacity="0.75"/>\n` +
    labels +
    renderCrossMarker(cx, cy, r, marker.style, marker.color) +
    `  </g>\n`
  );
};

// "Use rect center" button + auto-recompose hooks.
crossCenterBtn.addEventListener("click", () => {
  const b = norm();
  crossLatInput.value = ((b.south + b.north) / 2).toFixed(6);
  crossLngInput.value = ((b.west + b.east) / 2).toFixed(6);
  if (!crossToggle.checked) crossToggle.checked = true;
  recompose();
});
crossToggle.addEventListener("change", () => {
  if (crossToggle.checked && !crossLatInput.value && !crossLngInput.value) {
    const b = norm();
    crossLatInput.value = ((b.south + b.north) / 2).toFixed(6);
    crossLngInput.value = ((b.west + b.east) / 2).toFixed(6);
  }
  recompose();
});
for (const el of [
  crossLatInput, crossLngInput,
  crossMarkerStyleSelect, crossMarkerSizeInput,
  crossLatOffsetInput, crossLngOffsetInput,
  graticuleLabelsToggle, crossLabelsToggle,
  graticuleColorInput, graticuleHaloColorInput,
  scalebarToggle, scalebarAutoToggle, scalebarLengthInput,
  scalebarSegmentsInput, scalebarXInput, scalebarYInput,
] as const) {
  el.addEventListener("input", () => recompose());
  el.addEventListener("change", () => recompose());
}

// -- Scale bar overlay ------------------------------------------------------

const niceScaleMeters = (targetMeters: number): number => {
  if (!(targetMeters > 0)) return 100;
  const log = Math.floor(Math.log10(targetMeters));
  const base = Math.pow(10, log);
  const r = targetMeters / base;
  if (r < 1.5) return base;
  if (r < 3.5) return 2 * base;
  if (r < 7.5) return 5 * base;
  return 10 * base;
};

const formatMetersLabel = (m: number): string =>
  m >= 1000 ? `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)} km` : `${Math.round(m)} m`;

const renderScaleBar = (
  cw: number,
  ch: number,
  minDim: number,
  mw: number,
  widthMeters: number,
  color: string,
): string => {
  if (!(mw > 0) || !(widthMeters > 0)) return "";

  let lengthM: number;
  if (scalebarAutoToggle.checked) {
    // Aim for ~20% of map width as the bar length, snapped to a nice 1/2/5.
    lengthM = niceScaleMeters(widthMeters * 0.2);
  } else {
    const n = parseFloat(scalebarLengthInput.value);
    if (!Number.isFinite(n) || n <= 0) return "";
    lengthM = n;
  }

  const segments = Math.max(
    2,
    Math.min(10, Math.round(parseFloat(scalebarSegmentsInput.value) || 4)),
  );
  const xFrac = Math.max(0, Math.min(1, parseFloat(scalebarXInput.value) || 0));
  const yFrac = Math.max(0, Math.min(1, parseFloat(scalebarYInput.value) || 0));

  const barW = (lengthM / widthMeters) * mw;
  const barH = Math.max(1.5, minDim * 0.008);
  const segW = barW / segments;
  const startX = xFrac * (cw - barW);
  const startY = yFrac * (ch - barH);

  const lightFill = "#ffffff";
  const fs = Math.max(2.5, minDim * 0.013);
  const halo = (fs * 0.22).toFixed(2);

  let body = "";
  for (let i = 0; i < segments; i++) {
    const fill = i % 2 === 0 ? color : lightFill;
    body +=
      `    <rect x="${(startX + i * segW).toFixed(2)}" y="${startY.toFixed(2)}" ` +
      `width="${segW.toFixed(2)}" height="${barH.toFixed(2)}" ` +
      `fill="${fill}" stroke="${color}" stroke-width="${(barH * 0.08).toFixed(2)}"/>\n`;
  }
  // End-tick labels at 0, mid, and end.
  const labelY = (startY + barH + fs * 1.1).toFixed(2);
  const drawLabel = (val: number, x: number, anchor: string) =>
    `    <text x="${x.toFixed(2)}" y="${labelY}" ` +
    `font-size="${fs.toFixed(2)}" font-family="ui-monospace, 'Courier New', monospace" ` +
    `fill="${color}" text-anchor="${anchor}" ` +
    `paint-order="stroke" stroke="#ffffff" stroke-width="${halo}" ` +
    `letter-spacing="0.04em">${formatMetersLabel(val)}</text>\n`;
  let labels = "";
  labels += drawLabel(0, startX, "start");
  labels += drawLabel(lengthM / 2, startX + barW / 2, "middle");
  labels += drawLabel(lengthM, startX + barW, "end");

  return (
    `  <g class="scalebar" style="cursor:move">\n${body}${labels}  </g>\n`
  );
};

// -- OSM attribution ---------------------------------------------------------

/** Absolute attribution position (canvas mm). null = derive from corner. */
let attribAbsX: number | null = null;
let attribAbsY: number | null = null;

const renderAttribution = (
  cw: number,
  ch: number,
  minDim: number,
  corner: string,
): string => {
  const pad = minDim * 0.014;
  const fs = Math.max(2, minDim * 0.014);
  const halo = (fs * 0.22).toFixed(2);
  let x: number;
  let y: number;
  let anchor: "start" | "end";
  switch (corner) {
    case "tl": x = pad;       y = pad + fs;    anchor = "start"; break;
    case "tr": x = cw - pad;  y = pad + fs;    anchor = "end";   break;
    case "bl": x = pad;       y = ch - pad;    anchor = "start"; break;
    case "br":
    default:   x = cw - pad;  y = ch - pad;    anchor = "end";   break;
  }
  if (attribAbsX !== null && attribAbsY !== null) {
    x = attribAbsX;
    y = attribAbsY;
    anchor = "start"; // freely placed — left-anchor for predictable drag
  }
  return (
    `  <text class="attribution" x="${x.toFixed(2)}" y="${y.toFixed(2)}" ` +
    `font-size="${fs.toFixed(2)}" font-family="Helvetica, Arial, sans-serif" ` +
    `fill="#555" text-anchor="${anchor}" ` +
    `paint-order="stroke" stroke="#ffffff" stroke-width="${halo}" ` +
    `style="cursor:move">Map data from OpenStreetMap</text>\n`
  );
};

attribCornerSelect.addEventListener("change", () => {
  // Re-pick a corner clears any free-drag override.
  attribAbsX = null;
  attribAbsY = null;
  recompose();
});

// -- Water labels (client-side rendering + drag) ----------------------------

type WaterKind = "sea" | "lake" | "river";
type WaterFeature = { name: string; kind: WaterKind; lat: number; lng: number };

/** Parsed once per render from the hidden data block emitted by the backend. */
let waterFeatures: WaterFeature[] = [];

/** Per-name canvas-mm position overrides for dragged labels. */
const waterOverrides = new Map<string, { x: number; y: number }>();

const extractWaterFeatures = (doc: Document): WaterFeature[] => {
  const features: WaterFeature[] = [];
  doc.querySelectorAll<SVGElement>(".water-feature").forEach((el) => {
    const name = el.getAttribute("data-name") ?? "";
    const kind = el.getAttribute("data-kind") as WaterKind | null;
    const lat = parseFloat(el.getAttribute("data-lat") ?? "");
    const lng = parseFloat(el.getAttribute("data-lng") ?? "");
    if (name && kind && Number.isFinite(lat) && Number.isFinite(lng)) {
      features.push({ name, kind, lat, lng });
    }
  });
  // Remove the hidden data block from the parsed inner SVG.
  doc.querySelectorAll(".layer-water-features-data").forEach((g) => g.remove());
  return features;
};

const renderWaterLabels = (
  mx: number, my: number, mw: number, mh: number, minDim: number,
): string => {
  if (waterFeatures.length === 0) return "";
  const showSea = seaLabelsToggle.checked;
  const showLake = lakeLabelsToggle.checked;
  const showRiver = riverLabelsToggle.checked;
  if (!showSea && !showLake && !showRiver) return "";

  const fs = minDim * 0.018;
  let body = "";
  for (const f of waterFeatures) {
    if (f.kind === "sea" && !showSea) continue;
    if (f.kind === "lake" && !showLake) continue;
    if (f.kind === "river" && !showRiver) continue;
    let x: number;
    let y: number;
    const override = waterOverrides.get(f.name);
    if (override) {
      x = override.x;
      y = override.y;
    } else {
      const fake: Poi = {
        id: "", lat: f.lat, lng: f.lng,
        text: "", style: "pin",
        color: "", textColor: "", markerSize: 0,
        fontSizePx: 4, textBg: false, textBgColor: "", textPosition: "bottom",
      };
      const p = projectPoiToCanvas(fake, mx, my, mw, mh);
      if (!p) continue;
      x = p.x;
      y = p.y;
    }
    body +=
      `    <text class="water-label water-${f.kind}" data-name="${escapeXml(f.name)}" ` +
      `x="${x.toFixed(2)}" y="${y.toFixed(2)}" ` +
      `font-size="${fs.toFixed(2)}" text-anchor="middle" ` +
      `style="cursor:move">${escapeXml(f.name)}</text>\n`;
  }
  if (!body) return "";
  return `  <g class="layer-water-labels" data-source="client">\n${body}  </g>\n`;
};

// -- Composition -------------------------------------------------------------

let lastMapSvg: string | null = null;
let lastMapAspect: number | null = null;
let lastComposedUrl: string | null = null;

/** Compute the map's pixel-mm placement inside the canvas given the frame. */
const computeMapPlacement = (cw: number, ch: number, aspect: number) => {
  const f = currentFrame();
  if (f.id === "freeform") {
    const mw = Math.max(1, parseFloat(freeformWInput.value) || 1);
    const mh = Math.max(1, parseFloat(freeformHInput.value) || 1);
    const mx = parseFloat(freeformXInput.value) || 0;
    const my = parseFloat(freeformYInput.value) || 0;
    return { mx, my, mw, mh };
  }
  const usingFrame = currentCanvas().id !== "match";
  const mt = usingFrame ? ch * f.marginTop : 0;
  const mb = usingFrame ? ch * f.marginBottom : 0;
  const ml = usingFrame ? cw * f.marginLeft : 0;
  const mr = usingFrame ? cw * f.marginRight : 0;
  const availW = Math.max(1, cw - ml - mr);
  const availH = Math.max(1, ch - mt - mb);
  let mw: number, mh: number;
  if (availW / availH > aspect) {
    mh = availH;
    mw = mh * aspect;
  } else {
    mw = availW;
    mh = mw / aspect;
  }
  const mx = ml + (availW - mw) / 2;
  const my = mt + (availH - mh) / 2;
  return { mx, my, mw, mh };
};

/** Freeform-mode resize/move handles. Rendered into the preview SVG only. */
const renderFreeformHandles = (
  mx: number, my: number, mw: number, mh: number, minDim: number,
): string => {
  const r = Math.max(2, minDim * 0.011);
  const sw = Math.max(0.3, r * 0.16).toFixed(2);
  const dash = `${(r * 1.6).toFixed(2)} ${(r * 1.2).toFixed(2)}`;
  type H = { id: string; cx: number; cy: number; cursor: string };
  const handles: H[] = [
    { id: "nw", cx: mx,        cy: my,        cursor: "nwse-resize" },
    { id: "n",  cx: mx + mw/2, cy: my,        cursor: "ns-resize"   },
    { id: "ne", cx: mx + mw,   cy: my,        cursor: "nesw-resize" },
    { id: "e",  cx: mx + mw,   cy: my + mh/2, cursor: "ew-resize"   },
    { id: "se", cx: mx + mw,   cy: my + mh,   cursor: "nwse-resize" },
    { id: "s",  cx: mx + mw/2, cy: my + mh,   cursor: "ns-resize"   },
    { id: "sw", cx: mx,        cy: my + mh,   cursor: "nesw-resize" },
    { id: "w",  cx: mx,        cy: my + mh/2, cursor: "ew-resize"   },
  ];
  let out = `  <g class="freeform-handles">\n`;
  // Outline of the freeform map area.
  out +=
    `    <rect x="${mx.toFixed(2)}" y="${my.toFixed(2)}" ` +
    `width="${mw.toFixed(2)}" height="${mh.toFixed(2)}" fill="none" ` +
    `stroke="#4ea4ff" stroke-width="${sw}" stroke-dasharray="${dash}" ` +
    `pointer-events="none"/>\n`;
  // Center move grip.
  const gripR = r * 1.4;
  out +=
    `    <rect data-handle="move" ` +
    `x="${(mx + mw/2 - gripR).toFixed(2)}" y="${(my + mh/2 - gripR).toFixed(2)}" ` +
    `width="${(gripR * 2).toFixed(2)}" height="${(gripR * 2).toFixed(2)}" ` +
    `rx="${(gripR * 0.4).toFixed(2)}" fill="#4ea4ff" fill-opacity="0.55" ` +
    `stroke="#ffffff" stroke-width="${sw}" style="cursor:move"/>\n`;
  for (const h of handles) {
    out +=
      `    <rect data-handle="${h.id}" ` +
      `x="${(h.cx - r).toFixed(2)}" y="${(h.cy - r).toFixed(2)}" ` +
      `width="${(r * 2).toFixed(2)}" height="${(r * 2).toFixed(2)}" ` +
      `fill="#4ea4ff" stroke="#ffffff" stroke-width="${sw}" ` +
      `style="cursor:${h.cursor}"/>\n`;
  }
  out += `  </g>\n`;
  return out;
};

/** Build the final SVG: outer canvas (mm) + nested map svg + overlays.
 *  When `forExport` is true, preview-only chrome (freeform handles) is omitted. */
const composeSvg = (forExport = false): string | null => {
  if (!lastMapSvg) return null;
  const aspect = lastMapAspect ?? 1;
  const { w: cw, h: ch } = canvasDims(aspect);
  const frame = currentFrame();
  const { mx, my, mw, mh } = computeMapPlacement(cw, ch, aspect);

  // Strip the outer <svg> wrapper from the map svg, keep its children.
  const parser = new DOMParser();
  const doc = parser.parseFromString(lastMapSvg, "image/svg+xml");
  const mapSvgEl = doc.querySelector("svg");
  if (!mapSvgEl) return null;
  const mapVb = mapSvgEl.getAttribute("viewBox") ?? `0 0 1000 ${1000 / aspect}`;
  // Pull water features out so the frontend can render labels client-side
  // (and let users drag them). The extractor also strips the hidden block.
  waterFeatures = extractWaterFeatures(doc);
  // Hoist the map's <style> blocks (theme CSS) up to the outer SVG so the
  // rules apply during <img>/createImageBitmap rasterization. Some browsers
  // don't reliably apply <style> nested inside an inner <svg> when the outer
  // document is rendered as a raster image, which made the map appear empty
  // in the exported PNG.
  let hoistedStyle = "";
  doc.querySelectorAll("style").forEach((s) => {
    hoistedStyle += `<style>${s.textContent ?? ""}</style>`;
    s.remove();
  });
  const mapInner = mapSvgEl.innerHTML;

  const overlaysXml = overlays
    .map((o) => {
      const lines = o.text.length > 0 ? o.text.split("\n") : [""];
      const tspans = lines
        .map(
          (line, i) =>
            `<tspan x="${o.x}" dy="${i === 0 ? 0 : 1.15}em">${escapeXml(line)}</tspan>`,
        )
        .join("");
      const rot =
        o.rotation !== 0
          ? ` transform="rotate(${o.rotation} ${o.x} ${o.y})"`
          : "";
      return (
        `<text class="overlay-text" data-id="${o.id}" x="${o.x}" y="${o.y}" ` +
        `font-family="${escapeXml(o.fontFamily)}" font-size="${o.fontSize}" ` +
        `fill="${o.color}" text-anchor="middle" ` +
        `dominant-baseline="alphabetic"${rot}>${tspans}</text>`
      );
    })
    .join("\n  ");

  const canvasBg = canvasBgOverrideToggle.checked
    ? canvasBgColorInput.value
    : (frame.canvasBg ?? themeBackgroundColor(cssEditor.value));
  const minDim = Math.min(cw, ch);
  let defs = "";
  let mapAttrs = "";
  let borderRect = "";
  if (frame.decoration === "shadow") {
    const d = (minDim * 0.005).toFixed(3);
    defs = `<defs><filter id="map-shadow" x="-3%" y="-3%" width="106%" height="106%"><feDropShadow dx="0" dy="${d}" stdDeviation="${d}" flood-opacity="0.22"/></filter></defs>`;
    mapAttrs = ` filter="url(#map-shadow)"`;
  }
  if (borderToggle.checked) {
    const sw = Math.max(0.05, parseFloat(borderWidthInput.value) || 0.5);
    borderRect = `  <rect x="${mx.toFixed(2)}" y="${my.toFixed(2)}" width="${mw.toFixed(2)}" height="${mh.toFixed(2)}" fill="none" stroke="${borderColorInput.value}" stroke-width="${sw}"/>\n`;
  }

  let infoStripXml = "";
  if (frame.infoStrip) {
    const b = norm();
    const midLat = (b.south + b.north) / 2;
    const midLng = (b.west + b.east) / 2;
    const widthM =
      (b.east - b.west) * 111320 * Math.cos((midLat * Math.PI) / 180);
    const heightM = (b.north - b.south) * 111320;
    const fmtM = (m: number) =>
      m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
    const coords =
      `${toDMS(midLat, "N", "S")}  ·  ${toDMS(midLng, "E", "W")}`;
    let dims = `${fmtM(widthM)}  ×  ${fmtM(heightM)}`;
    const c = currentCanvas();
    if (c.id !== "match" && mw > 0 && widthM > 0) {
      const ratio = (widthM * 1000) / mw;
      if (Number.isFinite(ratio) && ratio > 0) {
        dims += `   ·   1:${formatScaleRatio(ratio)}`;
      }
    }
    const fs1 = minDim * 0.022;
    const fs2 = minDim * 0.018;
    const cxText = cw * atlasInfoXFrac;
    const cyText = ch * atlasInfoYFrac;
    // Line 1 above the anchor point, line 2 below.
    const y1 = cyText - fs2 * 0.5;
    const y2 = cyText + fs1 * 0.8;
    infoStripXml =
      `  <g class="info-strip" font-family="'Courier New', ui-monospace, monospace" fill="#3a3424" text-anchor="middle" style="cursor:move">\n` +
      `    <text x="${cxText.toFixed(2)}" y="${y1.toFixed(2)}" font-size="${fs1.toFixed(2)}" letter-spacing="0.08em">${escapeXml(coords)}</text>\n` +
      `    <text x="${cxText.toFixed(2)}" y="${y2.toFixed(2)}" font-size="${fs2.toFixed(2)}" letter-spacing="0.12em">${escapeXml(dims)}</text>\n` +
      `  </g>\n`;
  }

  // Lat/Lng graticule (lines + optional edge labels) drawn over the map.
  let graticuleXml = "";
  if (graticuleToggle.checked) {
    graticuleXml = renderGraticule(
      norm(), mx, my, mw, mh, minDim,
      graticuleLabelsToggle.checked,
      graticuleColorInput.value,
      graticuleHaloColorInput.value,
    );
  }

  // Optional cross at a chosen lat/lng with a styled marker on top.
  // Color is auto-derived from the leading stroke of the active theme.
  let crossXml = "";
  if (crossToggle.checked) {
    const lat = parseFloat(crossLatInput.value);
    const lng = parseFloat(crossLngInput.value);
    const leadingColor = themeLeadingColor(cssEditor.value);
    const latOff = Math.max(-1, Math.min(1, parseFloat(crossLatOffsetInput.value) || -0.5));
    const lngOff = Math.max(-1, Math.min(1, parseFloat(crossLngOffsetInput.value) || 0.5));
    crossXml = renderCross(
      norm(), mx, my, mw, mh, minDim, lat, lng,
      leadingColor,
      {
        style: crossMarkerStyleSelect.value as CrossMarkerStyle,
        color: leadingColor,
        sizeFrac: Math.max(0.001, parseFloat(crossMarkerSizeInput.value) || 0.001),
      },
      crossLabelsToggle.checked,
      latOff,
      lngOff,
    );
  }

  // POI markers projected from lat/lng into canvas mm coordinates.
  let poiXml = "";
  if (pois.length > 0) {
    const b = norm();
    const minBbox = mercatorXY(b.west, b.south);
    const maxBbox = mercatorXY(b.east, b.north);
    const dxMerc = maxBbox.x - minBbox.x;
    const dyMerc = maxBbox.y - minBbox.y;
    if (dxMerc > 0 && dyMerc > 0) {
      pois.forEach((p, i) => {
        if (p.lat < b.south || p.lat > b.north || p.lng < b.west || p.lng > b.east) {
          return;
        }
        const m = mercatorXY(p.lng, p.lat);
        const u = (m.x - minBbox.x) / dxMerc;
        const v = (maxBbox.y - m.y) / dyMerc;
        const canvasX = mx + u * mw;
        const canvasY = my + v * mh;
        const s = Math.max(0.5, p.markerSize);
        poiXml += renderPoiMarker(p, canvasX, canvasY, s, i + 1);
      });
    }
  }

  // Picker bearing rotates the displayed map; the bbox+content stay north-up
  // (Mercator projection unchanged). The map content is clipped back to the
  // original rectangle so it doesn't bleed into the canvas margins.
  const bearing = map.getBearing();
  let rotationDefs = "";
  let rotationOpen = "";
  let rotationClose = "";
  if (Math.abs(bearing) > 0.01) {
    rotationDefs =
      `<clipPath id="map-rotate-clip"><rect x="${mx.toFixed(2)}" y="${my.toFixed(2)}" width="${mw.toFixed(2)}" height="${mh.toFixed(2)}"/></clipPath>`;
    rotationOpen =
      `  <g clip-path="url(#map-rotate-clip)">\n` +
      `  <g transform="rotate(${(-bearing).toFixed(2)} ${(mx + mw / 2).toFixed(2)} ${(my + mh / 2).toFixed(2)})">\n`;
    rotationClose = `  </g>\n  </g>\n`;
  }
  defs = defs
    ? defs.replace("</defs>", rotationDefs + "</defs>")
    : rotationDefs
      ? `<defs>${rotationDefs}</defs>`
      : "";

  // Map content + everything anchored by lat/lng (graticule, cross, POIs,
  // routes) rotates together. Anything anchored to the canvas (border, scale
  // bar, attribution, info strip, overlays) stays axis-aligned.
  //
  // Wrap the parsed map content in a <g transform="…"> instead of a nested
  // <svg viewBox="…">. The two are visually equivalent under xMidYMid-meet,
  // but Firefox stops cascading CSS with descendant combinators across a
  // nested-<svg> boundary when rasterizing (e.g. `.layer-road polyline` won't
  // match inside the inner viewport), so polylines fall back to default
  // black fill in exported PNGs. Keeping everything in one SVG document tree
  // makes the theme styles apply uniformly.
  const vbParts = mapVb.split(/\s+/).map((n) => parseFloat(n));
  const srcW = Number.isFinite(vbParts[2]) && vbParts[2] > 0 ? vbParts[2] : 1000;
  const srcH = Number.isFinite(vbParts[3]) && vbParts[3] > 0 ? vbParts[3] : 1000;
  const vbScale = Math.min(mw / srcW, mh / srcH);
  const vbTx = mx + (mw - vbScale * srcW) / 2;
  const vbTy = my + (mh - vbScale * srcH) / 2;
  const mapBlock =
    `  <g class="map-content" transform="translate(${vbTx.toFixed(3)} ${vbTy.toFixed(3)}) scale(${vbScale.toFixed(6)})"${mapAttrs}>\n` +
    mapInner +
    `  </g>\n`;
  const { defs: routeDefs, body: routeXml } = renderRoutes(mx, my, mw, mh, forExport);
  if (routeDefs) {
    defs = defs
      ? defs.replace("</defs>", routeDefs + "</defs>")
      : `<defs>${routeDefs}</defs>`;
  }
  // Water labels follow routes and sit under POIs so place markers stay on top.
  const waterLabelsXml = renderWaterLabels(mx, my, mw, mh, minDim);
  // Routes draw BEFORE POIs so markers sit on top of the line.
  const latLngAnchored =
    mapBlock + graticuleXml + routeXml + waterLabelsXml + crossXml + poiXml;
  const wrappedLatLng = rotationOpen
    ? rotationOpen + latLngAnchored + rotationClose
    : latLngAnchored;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="0 0 ${cw} ${ch}" width="${cw}mm" height="${ch}mm">\n` +
    (hoistedStyle ? `  ${hoistedStyle}\n` : "") +
    (defs ? `  ${defs}\n` : "") +
    `  <rect class="canvas-bg" width="${cw}" height="${ch}" fill="${canvasBg}"/>\n` +
    wrappedLatLng +
    borderRect +
    infoStripXml +
    (scalebarToggle.checked
      ? renderScaleBar(
          cw, ch, minDim, mw,
          (() => {
            const b = norm();
            const midLat = (b.south + b.north) / 2;
            return (b.east - b.west) * 111320 * Math.cos((midLat * Math.PI) / 180);
          })(),
          themeLeadingColor(cssEditor.value),
        )
      : "") +
    (overlaysXml ? `  ${overlaysXml}\n` : "") +
    renderAttribution(cw, ch, minDim, attribCornerSelect.value) +
    (!forExport && currentFrame().id === "freeform"
      ? renderFreeformHandles(mx, my, mw, mh, minDim)
      : "") +
    `</svg>\n`
  );
};

/** Recompose and re-inject the SVG into the preview, then rebind drag handlers. */
const recompose = () => {
  refreshPoiMapMarkers();
  const composed = composeSvg();
  if (!composed) {
    previewEl.innerHTML = "";
    downloadBtn.disabled = true;
    downloadPngBtn.disabled = true;
    return;
  }
  previewEl.innerHTML = composed;
  if (lastComposedUrl) URL.revokeObjectURL(lastComposedUrl);
  lastComposedUrl = URL.createObjectURL(
    new Blob([composed], { type: "image/svg+xml" }),
  );
  downloadBtn.disabled = false;
  downloadPngBtn.disabled = false;
  bindOverlayDragHandlers();
  bindPoiDragHandlers();
  bindRouteCurveHandles();
  bindAtlasInfoDrag();
  bindFreeformHandles();
  bindScaleBarDrag();
  bindAttributionDrag();
  bindWaterLabelDrag();
};

// -- Overlay drag on preview SVG ---------------------------------------------

type DragState = {
  draggedId: string;
  startSvg: { x: number; y: number };
  origins: Map<string, { x: number; y: number }>;
  svg: SVGSVGElement;
  onMove: (e: PointerEvent) => void;
  onUp: (e: PointerEvent) => void;
};
let overlayDrag: DragState | null = null;

const toSvgPoint = (svg: SVGSVGElement, clientX: number, clientY: number) => {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
};

const bindOverlayDragHandlers = () => {
  const svg = previewEl.querySelector<SVGSVGElement>("svg");
  if (!svg) return;

  // Background click clears selection (text handlers stop propagation, so
  // this only fires for clicks on the map/background/anything-not-text).
  svg.addEventListener("pointerdown", () => clearSelection());

  syncSelectionVisuals();

  svg.querySelectorAll<SVGTextElement>("text.overlay-text").forEach((t) => {
    const id = t.dataset.id!;

    t.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      const o = overlays.find((x) => x.id === id);
      if (!o) return;

      const additive = e.shiftKey || e.ctrlKey || e.metaKey;
      if (additive) {
        if (selectedIds.has(id)) {
          selectedIds.delete(id);
          syncSelectionVisuals();
          return; // deselected — don't start drag
        }
        selectedIds.add(id);
      } else if (!selectedIds.has(id)) {
        selectedIds.clear();
        selectedIds.add(id);
      }
      syncSelectionVisuals();
      snapshot();

      const origins = new Map<string, { x: number; y: number }>();
      for (const sid of selectedIds) {
        const so = overlays.find((x) => x.id === sid);
        if (so) origins.set(sid, { x: so.x, y: so.y });
      }
      const startSvg = toSvgPoint(svg, e.clientX, e.clientY);

      const onMove = (ev: PointerEvent) => {
        if (!overlayDrag) return;
        const p = toSvgPoint(svg, ev.clientX, ev.clientY);
        let dx = p.x - overlayDrag.startSvg.x;
        let dy = p.y - overlayDrag.startSvg.y;

        // Snap relative to the dragged overlay's new position.
        let snappedX: number | null = null;
        let snappedY: number | null = null;
        const draggedOrigin = overlayDrag.origins.get(overlayDrag.draggedId);
        if (draggedOrigin && !ev.shiftKey) {
          const newX = draggedOrigin.x + dx;
          const newY = draggedOrigin.y + dy;
          const { xs, ys } = computeSnapCandidates(overlayDrag.draggedId);
          const thresh = snapThreshold();
          const sx = trySnap(newX, xs, thresh);
          const sy = trySnap(newY, ys, thresh);
          dx = sx.val - draggedOrigin.x;
          dy = sy.val - draggedOrigin.y;
          snappedX = sx.snapped;
          snappedY = sy.snapped;
        }

        for (const [sid, orig] of overlayDrag.origins) {
          const so = overlays.find((x) => x.id === sid);
          if (!so) continue;
          so.x = orig.x + dx;
          so.y = orig.y + dy;
          const el = overlayDrag.svg.querySelector<SVGTextElement>(
            `text.overlay-text[data-id="${sid}"]`,
          );
          if (el) {
            el.setAttribute("x", String(so.x));
            el.setAttribute("y", String(so.y));
            el.querySelectorAll<SVGTSpanElement>("tspan").forEach((sp) =>
              sp.setAttribute("x", String(so.x)),
            );
            if (so.rotation !== 0) {
              el.setAttribute(
                "transform",
                `rotate(${so.rotation} ${so.x} ${so.y})`,
              );
            }
          }
        }
        drawSnapGuides(overlayDrag.svg, snappedX, snappedY);
      };

      const onUp = () => {
        if (!overlayDrag) return;
        clearSnapGuides(overlayDrag.svg);
        document.removeEventListener("pointermove", overlayDrag.onMove);
        document.removeEventListener("pointerup", overlayDrag.onUp);
        document.removeEventListener("pointercancel", overlayDrag.onUp);
        overlayDrag = null;
      };

      overlayDrag = {
        draggedId: id,
        startSvg,
        origins,
        svg,
        onMove,
        onUp,
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    });
  });
};

// -- Freeform map area resize/move ------------------------------------------

const bindFreeformHandles = () => {
  if (currentFrame().id !== "freeform") return;
  const svg0 = previewEl.querySelector<SVGSVGElement>("svg");
  if (!svg0) return;
  svg0.querySelectorAll<SVGRectElement>("[data-handle]").forEach((h) => {
    const handleId = h.dataset.handle!;

    h.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      // Read initial SVG point + bounds at pointerdown.
      const start = toSvgPoint(svg0, e.clientX, e.clientY);
      const sX = parseFloat(freeformXInput.value) || 0;
      const sY = parseFloat(freeformYInput.value) || 0;
      const sW = parseFloat(freeformWInput.value) || 1;
      const sH = parseFloat(freeformHInput.value) || 1;

      let raf: number | null = null;
      let pX = sX, pY = sY, pW = sW, pH = sH;

      const flush = () => {
        freeformXInput.value = pX.toFixed(2);
        freeformYInput.value = pY.toFixed(2);
        freeformWInput.value = pW.toFixed(2);
        freeformHInput.value = pH.toFixed(2);
        recompose();
        raf = null;
      };

      const onMove = (ev: PointerEvent) => {
        // Recompose replaces the SVG element each frame, so re-query
        // every move to avoid using a detached node.
        const svg = previewEl.querySelector<SVGSVGElement>("svg");
        if (!svg) return;
        const p = toSvgPoint(svg, ev.clientX, ev.clientY);
        const dx = p.x - start.x;
        const dy = p.y - start.y;
        let nx = sX, ny = sY, nw = sW, nh = sH;
        switch (handleId) {
          case "move": nx = sX + dx; ny = sY + dy; break;
          case "nw": nx = sX + dx; ny = sY + dy; nw = sW - dx; nh = sH - dy; break;
          case "n":                  ny = sY + dy;              nh = sH - dy; break;
          case "ne":                  ny = sY + dy; nw = sW + dx; nh = sH - dy; break;
          case "e":                                 nw = sW + dx;              break;
          case "se":                                 nw = sW + dx; nh = sH + dy; break;
          case "s":                                                nh = sH + dy; break;
          case "sw": nx = sX + dx;                  nw = sW - dx; nh = sH + dy; break;
          case "w":  nx = sX + dx;                  nw = sW - dx;              break;
        }
        if (nw < 10) { nw = 10; if (handleId.includes("w")) nx = sX + sW - 10; }
        if (nh < 10) { nh = 10; if (handleId.includes("n")) ny = sY + sH - 10; }

        // Snap to canvas center / edges when moving (and Shift not held).
        if (handleId === "move" && !ev.shiftKey) {
          const aspect = lastMapAspect ?? 1;
          const { w: cw, h: ch } = canvasDims(aspect);
          const thresh = Math.min(cw, ch) * 0.015;
          const xCandidates = [0, cw - nw, (cw - nw) / 2];
          const yCandidates = [0, ch - nh, (ch - nh) / 2];
          for (const xc of xCandidates) {
            if (Math.abs(nx - xc) < thresh) { nx = xc; break; }
          }
          for (const yc of yCandidates) {
            if (Math.abs(ny - yc) < thresh) { ny = yc; break; }
          }
        }

        pX = nx; pY = ny; pW = nw; pH = nh;
        if (raf === null) raf = requestAnimationFrame(flush);
      };

      const onUp = () => {
        if (raf !== null) {
          cancelAnimationFrame(raf);
          flush();
        }
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    });

    if (handleId === "move") {
      h.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        const aspect = lastMapAspect ?? 1;
        const { w: cw, h: ch } = canvasDims(aspect);
        // Default: 70% of the canvas, centered.
        const nw = cw * 0.7;
        const nh = ch * 0.7;
        const nx = (cw - nw) / 2;
        const ny = (ch - nh) / 2;
        freeformXInput.value = nx.toFixed(2);
        freeformYInput.value = ny.toFixed(2);
        freeformWInput.value = nw.toFixed(2);
        freeformHInput.value = nh.toFixed(2);
        recompose();
      });
    }
  });
};

// -- Water label drag --------------------------------------------------------

const bindWaterLabelDrag = () => {
  const svg = previewEl.querySelector<SVGSVGElement>("svg");
  if (!svg) return;
  svg
    .querySelectorAll<SVGTextElement>('g.layer-water-labels[data-source="client"] text.water-label')
    .forEach((t) => {
      const name = t.dataset.name;
      if (!name) return;

      t.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        e.preventDefault();
        const startSvg = toSvgPoint(svg, e.clientX, e.clientY);
        const sX = parseFloat(t.getAttribute("x") ?? "0");
        const sY = parseFloat(t.getAttribute("y") ?? "0");
        let raf: number | null = null;

        const onMove = (ev: PointerEvent) => {
          const cur = previewEl.querySelector<SVGSVGElement>("svg");
          if (!cur) return;
          const p = toSvgPoint(cur, ev.clientX, ev.clientY);
          const nx = sX + (p.x - startSvg.x);
          const ny = sY + (p.y - startSvg.y);
          waterOverrides.set(name, { x: nx, y: ny });
          if (raf === null) {
            raf = requestAnimationFrame(() => {
              recompose();
              raf = null;
            });
          }
        };
        const onUp = () => {
          if (raf !== null) cancelAnimationFrame(raf);
          document.removeEventListener("pointermove", onMove);
          document.removeEventListener("pointerup", onUp);
          document.removeEventListener("pointercancel", onUp);
          recompose();
        };
        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onUp);
        document.addEventListener("pointercancel", onUp);
      });
    });
};

// -- Scale bar drag ----------------------------------------------------------

const bindScaleBarDrag = () => {
  if (!scalebarToggle.checked) return;
  const svg = previewEl.querySelector<SVGSVGElement>("svg");
  if (!svg) return;
  const sb = svg.querySelector<SVGGElement>("g.scalebar");
  if (!sb) return;

  sb.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    e.preventDefault();
    const startSvg = toSvgPoint(svg, e.clientX, e.clientY);
    const sX = parseFloat(scalebarXInput.value) || 0;
    const sY = parseFloat(scalebarYInput.value) || 0;
    let raf: number | null = null;

    const onMove = (ev: PointerEvent) => {
      const cur = previewEl.querySelector<SVGSVGElement>("svg");
      if (!cur) return;
      const p = toSvgPoint(cur, ev.clientX, ev.clientY);
      const aspect = lastMapAspect ?? 1;
      const { w: cw, h: ch } = canvasDims(aspect);
      const nx = Math.max(0, Math.min(1, sX + (p.x - startSvg.x) / cw));
      const ny = Math.max(0, Math.min(1, sY + (p.y - startSvg.y) / ch));
      scalebarXInput.value = nx.toFixed(3);
      scalebarYInput.value = ny.toFixed(3);
      if (raf === null) {
        raf = requestAnimationFrame(() => {
          recompose();
          raf = null;
        });
      }
    };
    const onUp = () => {
      if (raf !== null) cancelAnimationFrame(raf);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      recompose();
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  });
};

// -- Attribution drag --------------------------------------------------------

const bindAttributionDrag = () => {
  const svg = previewEl.querySelector<SVGSVGElement>("svg");
  if (!svg) return;
  const a = svg.querySelector<SVGTextElement>("text.attribution");
  if (!a) return;

  a.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    e.preventDefault();
    const startSvg = toSvgPoint(svg, e.clientX, e.clientY);
    const sX = parseFloat(a.getAttribute("x") ?? "0");
    const sY = parseFloat(a.getAttribute("y") ?? "0");
    let raf: number | null = null;

    const onMove = (ev: PointerEvent) => {
      const cur = previewEl.querySelector<SVGSVGElement>("svg");
      if (!cur) return;
      const p = toSvgPoint(cur, ev.clientX, ev.clientY);
      attribAbsX = sX + (p.x - startSvg.x);
      attribAbsY = sY + (p.y - startSvg.y);
      if (raf === null) {
        raf = requestAnimationFrame(() => {
          recompose();
          raf = null;
        });
      }
    };
    const onUp = () => {
      if (raf !== null) cancelAnimationFrame(raf);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      recompose();
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  });
};

// -- Atlas info-strip drag --------------------------------------------------

const bindAtlasInfoDrag = () => {
  const svg = previewEl.querySelector<SVGSVGElement>("svg");
  if (!svg) return;
  const strip = svg.querySelector<SVGGElement>("g.info-strip");
  if (!strip) return;

  let startSvg: { x: number; y: number } | null = null;
  let startX = 0;
  let startY = 0;

  strip.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    e.preventDefault();
    startSvg = toSvgPoint(svg, e.clientX, e.clientY);
    startX = atlasInfoXFrac;
    startY = atlasInfoYFrac;
    try {
      strip.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  });

  strip.addEventListener("pointermove", (e) => {
    if (!startSvg) return;
    const p = toSvgPoint(svg, e.clientX, e.clientY);
    const dx = p.x - startSvg.x;
    const dy = p.y - startSvg.y;
    strip.setAttribute("transform", `translate(${dx} ${dy})`);
  });

  const end = (e: PointerEvent) => {
    if (!startSvg) return;
    const p = toSvgPoint(svg, e.clientX, e.clientY);
    const dx = p.x - startSvg.x;
    const dy = p.y - startSvg.y;
    startSvg = null;
    try {
      strip.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const aspect = lastMapAspect ?? 1;
    const { w: cw, h: ch } = canvasDims(aspect);
    atlasInfoXFrac = Math.max(0, Math.min(1, startX + dx / cw));
    atlasInfoYFrac = Math.max(0, Math.min(1, startY + dy / ch));
    recompose();
  };
  strip.addEventListener("pointerup", end);
  strip.addEventListener("pointercancel", end);
};

// -- POI drag in preview SVG ------------------------------------------------

const bindPoiDragHandlers = () => {
  const svg = previewEl.querySelector<SVGSVGElement>("svg");
  if (!svg) return;
  svg.querySelectorAll<SVGGElement>("g.poi").forEach((g) => {
    const id = g.dataset.id;
    if (!id) return;
    const poi = pois.find((p) => p.id === id);
    if (!poi) return;

    let startSvg: { x: number; y: number } | null = null;
    let startLat = 0;
    let startLng = 0;

    g.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      snapshot();
      startSvg = toSvgPoint(svg, e.clientX, e.clientY);
      startLat = poi.lat;
      startLng = poi.lng;
      try {
        g.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    });

    g.addEventListener("pointermove", (e) => {
      if (!startSvg) return;
      const p = toSvgPoint(svg, e.clientX, e.clientY);
      const dx = p.x - startSvg.x;
      const dy = p.y - startSvg.y;
      g.setAttribute("transform", `translate(${dx} ${dy})`);
    });

    const end = (e: PointerEvent) => {
      if (!startSvg) return;
      const p = toSvgPoint(svg, e.clientX, e.clientY);
      const dx = p.x - startSvg.x;
      const dy = p.y - startSvg.y;
      startSvg = null;
      try {
        g.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      // Convert the (dx, dy) canvas-mm delta back to a lat/lng delta using
      // the same Mercator transform the renderer uses.
      const aspect = lastMapAspect ?? 1;
      const { w: cw, h: ch } = canvasDims(aspect);
      const { mx, my, mw, mh } = computeMapPlacement(cw, ch, aspect);
      const b = norm();
      const minB = mercatorXY(b.west, b.south);
      const maxB = mercatorXY(b.east, b.north);
      const dxMerc = maxB.x - minB.x;
      const dyMerc = maxB.y - minB.y;
      if (mw > 0 && mh > 0 && dxMerc > 0 && dyMerc > 0) {
        const orig = mercatorXY(startLng, startLat);
        const newMercX = orig.x + (dx / mw) * dxMerc;
        const newMercY = orig.y - (dy / mh) * dyMerc;
        const ll = inverseMercator(newMercX, newMercY);
        poi.lat = ll.lat;
        poi.lng = ll.lng;
      }
      // mx/my unused beyond their inclusion via computeMapPlacement.
      void mx;
      void my;
      renderPoiList();
      recompose();
    };
    g.addEventListener("pointerup", end);
    g.addEventListener("pointercancel", end);
  });
};

// -- Route curve handles ----------------------------------------------------

/** Drag the per-segment control points of curved routes. The drag updates the
 *  affected `<path>` and handle live; on release the new position is converted
 *  to lat/lng and stored in `route.controlPoints[segIdx]`. */
const bindRouteCurveHandles = () => {
  const svg = previewEl.querySelector<SVGSVGElement>("svg");
  if (!svg) return;
  svg.querySelectorAll<SVGCircleElement>("circle.route-curve-handle").forEach((h) => {
    const routeId = h.dataset.routeId;
    const segIdx = parseInt(h.dataset.segIdx ?? "-1", 10);
    if (!routeId || !(segIdx >= 0)) return;
    const r = routes.find((x) => x.id === routeId);
    if (!r || !r.controlPoints[segIdx]) return;

    // Cache state needed for live path updates so we don't recompose mid-drag.
    let startSvg: { x: number; y: number } | null = null;
    let startLat = 0;
    let startLng = 0;
    let startCx = 0;
    let startCy = 0;
    let cachedPts: { x: number; y: number }[] = [];
    let cachedCtrls: { x: number; y: number }[] = [];
    let localSegIdx = -1;
    let pathEl: SVGPathElement | null = null;

    h.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      snapshot();
      startSvg = toSvgPoint(svg, e.clientX, e.clientY);
      startLat = r.controlPoints[segIdx].lat;
      startLng = r.controlPoints[segIdx].lng;
      startCx = parseFloat(h.getAttribute("cx") ?? "0");
      startCy = parseFloat(h.getAttribute("cy") ?? "0");

      // Collect every handle for this route — their cx/cy are the current
      // control-point canvas positions and stay constant during this drag
      // except for the one being moved.
      const peerHandles = svg.querySelectorAll<SVGCircleElement>(
        `circle.route-curve-handle[data-route-id="${routeId}"]`,
      );
      cachedCtrls = [];
      localSegIdx = -1;
      peerHandles.forEach((peer, idx) => {
        cachedCtrls.push({
          x: parseFloat(peer.getAttribute("cx") ?? "0"),
          y: parseFloat(peer.getAttribute("cy") ?? "0"),
        });
        if (peer === h) localSegIdx = idx;
      });

      // Resolve POI canvas positions for this route from current map placement.
      const aspect = lastMapAspect ?? 1;
      const { w: cw, h: ch } = canvasDims(aspect);
      const { mx, my, mw, mh } = computeMapPlacement(cw, ch, aspect);
      void cw; void ch;
      cachedPts = [];
      for (const id of r.poiIds) {
        const poi = pois.find((p) => p.id === id);
        if (!poi) continue;
        const p = projectPoiToCanvas(poi, mx, my, mw, mh);
        if (p) cachedPts.push(p);
      }

      pathEl = svg.querySelector<SVGPathElement>(
        `path.route-curved[data-id="${routeId}"]`,
      );
      try {
        h.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    });

    h.addEventListener("pointermove", (e) => {
      if (!startSvg) return;
      const p = toSvgPoint(svg, e.clientX, e.clientY);
      const dx = p.x - startSvg.x;
      const dy = p.y - startSvg.y;
      const nx = startCx + dx;
      const ny = startCy + dy;
      h.setAttribute("cx", nx.toFixed(2));
      h.setAttribute("cy", ny.toFixed(2));
      if (pathEl && localSegIdx >= 0) {
        cachedCtrls[localSegIdx] = { x: nx, y: ny };
        pathEl.setAttribute("d", buildCurvedPathD(cachedPts, cachedCtrls));
      }
    });

    const end = (e: PointerEvent) => {
      if (!startSvg) return;
      const p = toSvgPoint(svg, e.clientX, e.clientY);
      const dx = p.x - startSvg.x;
      const dy = p.y - startSvg.y;
      startSvg = null;
      try {
        h.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      // Convert the canvas delta back to a lat/lng delta via Mercator —
      // same math used by the POI drag handler.
      const aspect = lastMapAspect ?? 1;
      const { w: cw, h: ch } = canvasDims(aspect);
      const { mx, my, mw, mh } = computeMapPlacement(cw, ch, aspect);
      void cw; void ch; void mx; void my;
      const b = norm();
      const minB = mercatorXY(b.west, b.south);
      const maxB = mercatorXY(b.east, b.north);
      const dxMerc = maxB.x - minB.x;
      const dyMerc = maxB.y - minB.y;
      if (mw > 0 && mh > 0 && dxMerc > 0 && dyMerc > 0) {
        const orig = mercatorXY(startLng, startLat);
        const newMercX = orig.x + (dx / mw) * dxMerc;
        const newMercY = orig.y - (dy / mh) * dyMerc;
        const ll = inverseMercator(newMercX, newMercY);
        r.controlPoints[segIdx] = { lat: ll.lat, lng: ll.lng };
      }
      recompose();
    };
    h.addEventListener("pointerup", end);
    h.addEventListener("pointercancel", end);
  });
};

// -- Render / save / download ------------------------------------------------

const render = async () => {
  const b = norm();
  const dLat = b.north - b.south;
  const dLng = b.east - b.west;
  const BBOX_WARN = 0.5;
  if (dLat > BBOX_WARN || dLng > BBOX_WARN) {
    const ok = confirm(
      `Bounding box is ${dLat.toFixed(2)}° × ${dLng.toFixed(2)}° — Overpass can ` +
        `time out for large areas. Continue?`,
    );
    if (!ok) {
      setStatus("render cancelled", "");
      return;
    }
  }

  setStatus("rendering…");
  renderBtn.disabled = true;
  downloadBtn.disabled = true;
  downloadPngBtn.disabled = true;
  previewEl.classList.add("loading");
  try {
    const width = parseFloat(widthInput.value) || 2000;
    const shape = currentPaper().shape ?? "rect";
    const street_labels = streetLabelsToggle.checked;
    const place_labels = placeLabelsToggle.checked;
    const water_labels =
      seaLabelsToggle.checked ||
      lakeLabelsToggle.checked ||
      riverLabelsToggle.checked;
    const hidden = collectHiddenLayers();
    const res = await fetch("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...b,
        width,
        css: cssEditor.value,
        shape,
        street_labels,
        place_labels,
        water_labels,
        hidden,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    lastMapSvg = await res.text();

    // Extract aspect from the viewBox.
    const m = lastMapSvg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    lastMapAspect = m ? parseFloat(m[1]) / parseFloat(m[2]) : 1;

    recompose();
    setStatus("rendered", "ok");
    // Flip the Map pane to its Render sub-tab so the result is visible.
    mapPaneEl
      .querySelector<HTMLButtonElement>('.tab[data-map-tab="preview"]')
      ?.click();
    // Reverse-geocode in the background so "+ Add text" can suggest a title.
    void fetchSuggestedTitle();
  } catch (err) {
    console.error(err);
    setStatus(err instanceof Error ? err.message : String(err), "error");
  } finally {
    renderBtn.disabled = false;
    previewEl.classList.remove("loading");
  }
};

const saveCss = async () => {
  setStatus("saving CSS…");
  saveCssBtn.disabled = true;
  try {
    const res = await fetch("/api/style", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ css: cssEditor.value }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setStatus("CSS saved", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "error");
  } finally {
    saveCssBtn.disabled = false;
  }
};

/** Filename convention: map2art-YYYYMMDD_HH:MM:SS-<lat><N|S>_<lng><E|W>.<ext> */
const exportFilename = (ext: string): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const date =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time =
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const b = norm();
  const lat = (b.south + b.north) / 2;
  const lng = (b.west + b.east) / 2;
  const latStr = `${Math.abs(lat).toFixed(4)}${lat >= 0 ? "N" : "S"}`;
  const lngStr = `${Math.abs(lng).toFixed(4)}${lng >= 0 ? "E" : "W"}`;
  return `map2art-${date}_${time}-${latStr}_${lngStr}.${ext}`;
};

const download = () => {
  const composed = composeSvg(true);
  if (!composed) return;
  const url = URL.createObjectURL(
    new Blob([composed], { type: "image/svg+xml" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFilename("svg");
  a.click();
  URL.revokeObjectURL(url);
};

/** Resolve the canvas-bg color, defaulting to a visible cream so the PNG is
 *  never silently transparent or black. */
const resolveCanvasBg = (): string => {
  let bg: string | undefined;
  if (canvasBgOverrideToggle.checked) bg = canvasBgColorInput.value;
  else bg = currentFrame().canvasBg ?? themeBackgroundColor(cssEditor.value);
  if (!bg || bg === "none" || bg === "transparent" || bg === "inherit") {
    return "#fafafa";
  }
  return bg;
};

const downloadPng = async () => {
  const composed = composeSvg(true);
  if (!composed) return;
  const dpi = Math.max(36, parseFloat(dpiInput.value) || 300);
  const aspect = lastMapAspect ?? 1;
  const { w: cw, h: ch } = canvasDims(aspect);
  const widthPx = Math.max(1, Math.round((cw * dpi) / 25.4));
  const heightPx = Math.max(1, Math.round((ch * dpi) / 25.4));

  // Rasterize on the backend with resvg (a real SVG renderer) instead of
  // round-tripping through <img>/createImageBitmap, which mis-renders the
  // composed SVG in Firefox (descendant CSS combinators get dropped during
  // <img>-based SVG rasterization, leaving polylines black-filled).
  setStatus(`rasterizing ${widthPx}×${heightPx}…`);
  downloadPngBtn.disabled = true;
  try {
    const res = await fetch("/api/raster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        svg: composed,
        width_px: widthPx,
        height_px: heightPx,
        background: resolveCanvasBg(),
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HTTP ${res.status}: ${txt}`);
    }
    const blob = await res.blob();
    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = dlUrl;
    a.download = exportFilename("png");
    a.click();
    URL.revokeObjectURL(dlUrl);
    setStatus(`PNG ${widthPx}×${heightPx} @ ${dpi}dpi`, "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "error");
  } finally {
    downloadPngBtn.disabled = false;
  }
};

renderBtn.addEventListener("click", render);
saveCssBtn.addEventListener("click", saveCss);
for (const t of [streetLabelsToggle, placeLabelsToggle]) {
  t.addEventListener("change", () => {
    if (lastMapSvg) void render();
  });
}
// Water-label toggles filter client-side, so a recompose is enough
// (unless we need to fetch new data because all three were off before).
for (const t of [seaLabelsToggle, lakeLabelsToggle, riverLabelsToggle]) {
  t.addEventListener("change", () => {
    if (lastMapSvg) {
      const anyOn =
        seaLabelsToggle.checked ||
        lakeLabelsToggle.checked ||
        riverLabelsToggle.checked;
      // If turning on for the first time after a no-water render, refetch
      // so the backend embeds the data block. Otherwise recompose only.
      if (anyOn && !lastMapSvg.includes("layer-water-features-data")) {
        void render();
      } else {
        recompose();
      }
    }
  });
}
graticuleToggle.addEventListener("change", () => recompose());

// -- Layer toggles -----------------------------------------------------------

const LAYER_BACKEND_NAMES: Record<string, string[]> = {
  landuse: ["landuse"],
  leisure: ["leisure"],
  water: ["water", "waterway", "coastline"],
  buildings: ["building"],
  rail: ["rail"],
  roads: ["road"],
};
const layerCheckboxes = (): NodeListOf<HTMLInputElement> =>
  document.querySelectorAll<HTMLInputElement>("input[data-layer]");

const collectHiddenLayers = (): string[] => {
  const hidden: string[] = [];
  for (const cb of layerCheckboxes()) {
    if (cb.checked) continue;
    const key = cb.dataset.layer!;
    const mapped = LAYER_BACKEND_NAMES[key] ?? [key];
    hidden.push(...mapped);
  }
  return hidden;
};

for (const cb of layerCheckboxes()) {
  cb.addEventListener("change", () => {
    if (lastMapSvg) void render();
  });
}
downloadBtn.addEventListener("click", download);
downloadPngBtn.addEventListener("click", downloadPng);

// -- Save / load project state ---------------------------------------------

type SavedProject = {
  version: 1;
  map: { lng: number; lat: number; zoom: number };
  rect: { south: number; west: number; north: number; east: number };
  paper: { id: string; landscape: boolean; customW: number; customH: number };
  aspectLocked: boolean;
  canvas: { id: string; landscape: boolean };
  theme: string;
  css: string;
  width: number;
  dpi: number;
  streetLabels: boolean;
  placeLabels: boolean;
  seaLabels?: boolean;
  lakeLabels?: boolean;
  riverLabels?: boolean;
  graticule?: boolean;
  graticuleLabels?: boolean;
  graticuleColor?: string;
  graticuleHaloColor?: string;
  cross?: {
    show: boolean;
    labels?: boolean;
    labelLatOffset?: number;
    labelLngOffset?: number;
    lat: number;
    lng: number;
    /** Legacy fields kept so older project files still load. */
    color?: string;
    marker: { style: string; color?: string; sizeFrac: number };
  };
  attribCorner?: string;
  attribAbs?: { x: number; y: number } | null;
  scalebar?: {
    show: boolean;
    auto: boolean;
    lengthM: number;
    segments: number;
    x: number;
    y: number;
  };
  border?: { enabled: boolean; color: string; width: number };
  freeform?: { x: number; y: number; w: number; h: number };
  atlasInfo?: { xFrac: number; yFrac: number };
  canvasBg?: { override: boolean; color: string };
  waterOverrides?: Record<string, { x: number; y: number }>;
  hiddenLayerKeys: string[];
  frame: string;
  overlays: Overlay[];
  pois: Poi[];
  routes?: Route[];
};

const saveProject = () => {
  const c = map.getCenter();
  const proj: SavedProject = {
    version: 1,
    map: { lng: c.lng, lat: c.lat, zoom: map.getZoom() },
    rect: norm(),
    paper: {
      id: paperSelect.value,
      landscape,
      customW: parseFloat(customWInput.value) || 200,
      customH: parseFloat(customHInput.value) || 200,
    },
    aspectLocked,
    canvas: { id: canvasSelect.value, landscape: canvasLandscape },
    theme: themeSelect.value,
    css: cssEditor.value,
    width: parseFloat(widthInput.value) || 2000,
    dpi: parseFloat(dpiInput.value) || 300,
    streetLabels: streetLabelsToggle.checked,
    placeLabels: placeLabelsToggle.checked,
    seaLabels: seaLabelsToggle.checked,
    lakeLabels: lakeLabelsToggle.checked,
    riverLabels: riverLabelsToggle.checked,
    graticule: graticuleToggle.checked,
    graticuleLabels: graticuleLabelsToggle.checked,
    graticuleColor: graticuleColorInput.value,
    graticuleHaloColor: graticuleHaloColorInput.value,
    cross: {
      show: crossToggle.checked,
      labels: crossLabelsToggle.checked,
      labelLatOffset: parseFloat(crossLatOffsetInput.value) || -0.5,
      labelLngOffset: parseFloat(crossLngOffsetInput.value) || 0.5,
      lat: parseFloat(crossLatInput.value) || 0,
      lng: parseFloat(crossLngInput.value) || 0,
      marker: {
        style: crossMarkerStyleSelect.value,
        sizeFrac: parseFloat(crossMarkerSizeInput.value) || 0.001,
      },
    },
    attribCorner: attribCornerSelect.value,
    attribAbs:
      attribAbsX !== null && attribAbsY !== null
        ? { x: attribAbsX, y: attribAbsY }
        : null,
    scalebar: {
      show: scalebarToggle.checked,
      auto: scalebarAutoToggle.checked,
      lengthM: parseFloat(scalebarLengthInput.value) || 500,
      segments: parseFloat(scalebarSegmentsInput.value) || 4,
      x: parseFloat(scalebarXInput.value) || 0.08,
      y: parseFloat(scalebarYInput.value) || 0.92,
    },
    border: {
      enabled: borderToggle.checked,
      color: borderColorInput.value,
      width: parseFloat(borderWidthInput.value) || 0.5,
    },
    freeform: {
      x: parseFloat(freeformXInput.value) || 20,
      y: parseFloat(freeformYInput.value) || 20,
      w: parseFloat(freeformWInput.value) || 180,
      h: parseFloat(freeformHInput.value) || 180,
    },
    atlasInfo: { xFrac: atlasInfoXFrac, yFrac: atlasInfoYFrac },
    waterOverrides: Object.fromEntries(waterOverrides),
    canvasBg: {
      override: canvasBgOverrideToggle.checked,
      color: canvasBgColorInput.value,
    },
    hiddenLayerKeys: Array.from(layerCheckboxes())
      .filter((cb) => !cb.checked)
      .map((cb) => cb.dataset.layer!),
    frame: currentFrameId,
    overlays: overlays.map((o) => ({ ...o })),
    pois: pois.map((p) => ({ ...p })),
    routes: routes.map((r) => ({
    ...r,
    poiIds: r.poiIds.slice(),
    controlPoints: (r.controlPoints ?? []).map((c) => ({ ...c })),
  })),
  };
  const blob = new Blob([JSON.stringify(proj, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFilename("project.json");
  a.click();
  URL.revokeObjectURL(url);
  setStatus("project saved", "ok");
};

const applyProject = (p: SavedProject) => {
  paperSelect.value = p.paper.id;
  customWInput.value = String(p.paper.customW);
  customHInput.value = String(p.paper.customH);
  landscape = p.paper.landscape;
  aspect = computeAspect();
  aspectLocked = p.aspectLocked && aspect !== null;
  updateCustomVisibility();
  updateRectShape();
  updateLockButton();
  streetLabelsToggle.checked = !!p.streetLabels;
  placeLabelsToggle.checked = !!p.placeLabels;
  seaLabelsToggle.checked = !!p.seaLabels;
  lakeLabelsToggle.checked = !!p.lakeLabels;
  riverLabelsToggle.checked = !!p.riverLabels;
  graticuleToggle.checked = !!p.graticule;
  if (typeof p.graticuleLabels === "boolean") {
    graticuleLabelsToggle.checked = p.graticuleLabels;
  }
  if (p.graticuleColor) graticuleColorInput.value = p.graticuleColor;
  if (p.graticuleHaloColor) graticuleHaloColorInput.value = p.graticuleHaloColor;
  if (p.cross) {
    crossToggle.checked = !!p.cross.show;
    crossLabelsToggle.checked = !!p.cross.labels;
    crossLatInput.value = String(p.cross.lat ?? "");
    crossLngInput.value = String(p.cross.lng ?? "");
    if (typeof p.cross.labelLatOffset === "number") {
      crossLatOffsetInput.value = String(p.cross.labelLatOffset);
    }
    if (typeof p.cross.labelLngOffset === "number") {
      crossLngOffsetInput.value = String(p.cross.labelLngOffset);
    }
    if (p.cross.marker) {
      crossMarkerStyleSelect.value = p.cross.marker.style ?? "crosshair";
      crossMarkerSizeInput.value = String(p.cross.marker.sizeFrac ?? 0.001);
    }
  }
  if (p.attribCorner) attribCornerSelect.value = p.attribCorner;
  if (p.attribAbs) {
    attribAbsX = p.attribAbs.x;
    attribAbsY = p.attribAbs.y;
  } else {
    attribAbsX = null;
    attribAbsY = null;
  }
  if (p.scalebar) {
    scalebarToggle.checked = !!p.scalebar.show;
    scalebarAutoToggle.checked = !!p.scalebar.auto;
    scalebarLengthInput.value = String(p.scalebar.lengthM);
    scalebarSegmentsInput.value = String(p.scalebar.segments);
    scalebarXInput.value = String(p.scalebar.x);
    scalebarYInput.value = String(p.scalebar.y);
  }
  if (p.border) {
    borderToggle.checked = p.border.enabled;
    borderColorInput.value = p.border.color;
    borderWidthInput.value = String(p.border.width);
  }
  if (p.freeform) {
    freeformXInput.value = String(p.freeform.x);
    freeformYInput.value = String(p.freeform.y);
    freeformWInput.value = String(p.freeform.w);
    freeformHInput.value = String(p.freeform.h);
  }
  if (p.atlasInfo) {
    atlasInfoXFrac = p.atlasInfo.xFrac;
    atlasInfoYFrac = p.atlasInfo.yFrac;
  }
  if (p.canvasBg) {
    canvasBgOverrideToggle.checked = p.canvasBg.override;
    canvasBgColorInput.value = p.canvasBg.color;
  }
  waterOverrides.clear();
  if (p.waterOverrides) {
    for (const [name, pos] of Object.entries(p.waterOverrides)) {
      waterOverrides.set(name, pos);
    }
  }
  freeformControls.hidden = currentFrame().id !== "freeform";
  const hiddenSet = new Set(p.hiddenLayerKeys ?? []);
  for (const cb of layerCheckboxes()) {
    cb.checked = !hiddenSet.has(cb.dataset.layer!);
  }
  if (p.frame && FRAMES.some((f) => f.id === p.frame)) {
    currentFrameId = p.frame;
    renderFrameOptions();
  }

  canvasSelect.value = p.canvas.id;
  canvasLandscape = p.canvas.landscape;

  themeSelect.value = p.theme;
  cssEditor.value = p.css;
  widthInput.value = String(p.width);
  dpiInput.value = String(p.dpi);

  overlays.length = 0;
  for (const o of p.overlays) overlays.push({ ...o });
  renderOverlayList();

  pois.length = 0;
  for (const x of p.pois ?? []) {
    pois.push({
      ...x,
      textColor: x.textColor ?? "#1a1a1a",
      markerSize: x.markerSize ?? 8,
      fontSizePx: x.fontSizePx ?? 4,
      textBg: x.textBg ?? false,
      textBgColor: x.textBgColor ?? "#ffffff",
      textPosition: x.textPosition ?? "bottom",
    });
  }
  renderPoiList();

  routes.length = 0;
  for (const r of p.routes ?? []) {
    const loaded: Route = {
      id: r.id,
      name: r.name,
      color: r.color,
      style: r.style,
      widthMm: r.widthMm,
      poiIds: (r.poiIds ?? []).slice(),
      curved: r.curved ?? false,
      controlPoints: (r.controlPoints ?? []).map((c: RouteCurveCtrl) => ({ ...c })),
    };
    syncRouteControlPoints(loaded);
    routes.push(loaded);
  }
  renderRouteList();

  map.once("moveend", () => {
    rectSW = new LngLat(p.rect.west, p.rect.south);
    rectNE = new LngLat(p.rect.east, p.rect.north);
    drawRect();
  });
  map.flyTo({
    center: [p.map.lng, p.map.lat],
    zoom: p.map.zoom,
    duration: 600,
  });
};

saveProjectBtn.addEventListener("click", saveProject);
loadProjectBtn.addEventListener("click", () => loadProjectFile.click());
loadProjectFile.addEventListener("change", async () => {
  const file = loadProjectFile.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const p = JSON.parse(text) as SavedProject;
    if (p.version !== 1) {
      setStatus(`unknown project version ${p.version}`, "error");
      return;
    }
    applyProject(p);
    setStatus(`loaded ${file.name}`, "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "error");
  } finally {
    loadProjectFile.value = "";
  }
});

// CodeMirror handles Ctrl/Cmd+Enter via keymap and triggers recompose via its
// updateListener — both configured at editor creation.

// Ctrl/Cmd+Z = undo; Ctrl+Shift+Z or Ctrl+Y = redo. Skip when an input is focused.
document.addEventListener("keydown", (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  const a = document.activeElement;
  if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT")) {
    return;
  }
  const key = e.key.toLowerCase();
  if (key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
  else if ((key === "z" && e.shiftKey) || key === "y") { e.preventDefault(); redo(); }
});

// Delete / Backspace removes selected overlays, unless an input is focused.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Delete" && e.key !== "Backspace") return;
  if (selectedIds.size === 0) return;
  const a = document.activeElement;
  if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT")) {
    return;
  }
  e.preventDefault();
  snapshot();
  for (const id of Array.from(selectedIds)) {
    const i = overlays.findIndex((o) => o.id === id);
    if (i >= 0) overlays.splice(i, 1);
  }
  selectedIds.clear();
  renderOverlayList();
  recompose();
});

void (async () => {
  await loadThemeList();
  themeSelect.value = THEME_CUSTOM;
  await loadThemeIntoEditor(THEME_CUSTOM);
  renderOverlayList();
  renderPoiList();
  renderRouteList();
  // Apply the default 2:1 pane split (map gets the larger area).
  setPaneSplit(null);
})();
