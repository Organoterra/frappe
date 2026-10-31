import {
	computeElevation,
	paintElevation,
	HEATMAP_DEFAULTS,
	ELEV_GRADIENT,
	LUMENOS_GRADIENT,
} from "./login_shader/heatmap.js";

// Live controls for the login-page shader. Toggle with Cmd/Ctrl + . (developer
// mode only). Everything is also reachable from the console: window.loginShader.

const STORAGE_KEY = "login-shader";

const NAVY_CREAM = [
	{ position: 0, color: [0, 0.086, 0.204, 1] },
	{ position: 0.4, color: [0.114, 0.192, 0.337, 1] },
	{ position: 0.7, color: [0.42, 0.49, 0.63, 1] },
	{ position: 1, color: [0.98, 0.973, 0.961, 1] },
];

const PALETTES = {
	brand: ELEV_GRADIENT,
	lumenos: LUMENOS_GRADIENT,
	"navy-cream": NAVY_CREAM,
};

// terrainScale = cells x zoom. Keeping `cells` an integer is what makes the
// texture tile without a visible seam, so it is the control, not terrainScale.
const DEFAULTS = {
	cells: 6,
	zoom: HEATMAP_DEFAULTS.zoom,
	complexity: HEATMAP_DEFAULTS.terrainComplexity,
	warp: HEATMAP_DEFAULTS.warp,
	contrast: HEATMAP_DEFAULTS.contrast,
	seed: HEATMAP_DEFAULTS.seed,
	palette: "brand",
	tile: 1800,
	swell: 1.6,
	x: 45,
	y: 40,
	drift: 45,
	paused: false,
};

// [key, label, min, max, step]
const SLIDERS = [
	["cells", "Cells", 2, 12, 1],
	["zoom", "Zoom", 0.2, 1, 0.01],
	["complexity", "Complexity", 1, 6, 1],
	["warp", "Flow", 0, 1, 0.01],
	["contrast", "Contrast", 0.6, 2, 0.01],
	["seed", "Seed", 0, 99, 1],
	["tile", "Tile size (px)", 600, 3200, 10],
	["swell", "Layer swell", 0.5, 2.5, 0.05],
	["x", "Offset X (%)", 0, 100, 1],
	["y", "Offset Y (%)", 0, 100, 1],
	["drift", "Drift (s per loop)", 10, 120, 1],
];

const TEXTURE_KEYS = ["cells", "zoom", "complexity", "warp", "contrast", "seed", "palette"];

function load() {
	try {
		return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
	} catch (e) {
		return { ...DEFAULTS };
	}
}

function save(state) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch (e) {
		// storage blocked; the shader still works for this page view
	}
}

function init() {
	const target = document.querySelector(".login-brand");
	if (!target) return;

	let state = load();
	let blobUrl = null;
	let rebuildTimer = null;
	let panel = null;
	const inputs = {};

	function paintTexture() {
		const size = HEATMAP_DEFAULTS.resolution;
		const params = {
			...HEATMAP_DEFAULTS,
			terrainScale: state.cells * state.zoom,
			terrainComplexity: state.complexity,
			zoom: state.zoom,
			warp: state.warp,
			contrast: state.contrast,
			seed: state.seed,
			resolution: size,
		};
		const field = computeElevation(size, size, params);
		const canvas = document.createElement("canvas");
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		paintElevation(ctx, field, size, size, PALETTES[state.palette] || ELEV_GRADIENT);
		canvas.toBlob((blob) => {
			if (!blob) return;
			const next = URL.createObjectURL(blob);
			target.style.setProperty("--hm-image", `url("${next}")`);
			if (blobUrl) URL.revokeObjectURL(blobUrl);
			blobUrl = next;
		}, "image/png");
	}

	function applyLayout() {
		target.style.setProperty("--hm-tile", `${state.tile}px`);
		target.style.setProperty("--hm-swell", String(state.swell));
		target.style.setProperty("--hm-x", `${state.x}%`);
		target.style.setProperty("--hm-y", `${state.y}%`);
		target.style.animationDuration = `${state.drift}s`;
		target.style.animationPlayState = state.paused ? "paused" : "running";
	}

	function scheduleTexture() {
		clearTimeout(rebuildTimer);
		rebuildTimer = setTimeout(paintTexture, 120);
	}

	function set(patch) {
		const retexture = TEXTURE_KEYS.some((k) => k in patch && patch[k] !== state[k]);
		state = { ...state, ...patch };
		save(state);
		applyLayout();
		if (retexture) scheduleTexture();
		syncInputs();
		return { ...state };
	}

	function reset() {
		return set({ ...DEFAULTS });
	}

	// Only visitors who changed something pay for generating the texture; everyone
	// else gets the baked PNG.
	applyLayout();
	if (TEXTURE_KEYS.some((k) => state[k] !== DEFAULTS[k])) paintTexture();

	window.loginShader = {
		get: () => ({ ...state }),
		set,
		reset,
		palettes: Object.keys(PALETTES),
		toggle: () => panel && togglePanel(),
	};

	if (!window.login_shader_controls) return;

	// ---- panel ----
	panel = document.createElement("div");
	panel.className = "login-shader-panel";
	panel.hidden = true;
	panel.setAttribute("role", "dialog");
	panel.setAttribute("aria-label", "Shader controls");

	const title = document.createElement("div");
	title.className = "lsp-title";
	title.textContent = "Shader";
	const hint = document.createElement("span");
	hint.textContent = "Esc to close";
	title.appendChild(hint);
	panel.appendChild(title);

	for (const [key, label, min, max, step] of SLIDERS) {
		const row = document.createElement("label");
		row.className = "lsp-row";
		const name = document.createElement("span");
		name.textContent = label;
		const value = document.createElement("output");
		const input = document.createElement("input");
		input.type = "range";
		input.min = min;
		input.max = max;
		input.step = step;
		input.addEventListener("input", () => set({ [key]: Number(input.value) }));
		row.append(name, value, input);
		panel.appendChild(row);
		inputs[key] = { input, value };
	}

	const paletteRow = document.createElement("label");
	paletteRow.className = "lsp-row lsp-select";
	const paletteName = document.createElement("span");
	paletteName.textContent = "Palette";
	const select = document.createElement("select");
	for (const key of Object.keys(PALETTES)) {
		const opt = document.createElement("option");
		opt.value = key;
		opt.textContent = key;
		select.appendChild(opt);
	}
	select.addEventListener("change", () => set({ palette: select.value }));
	paletteRow.append(paletteName, select);
	panel.appendChild(paletteRow);

	const actions = document.createElement("div");
	actions.className = "lsp-actions";
	const mk = (text, fn) => {
		const b = document.createElement("button");
		b.type = "button";
		b.textContent = text;
		b.addEventListener("click", fn);
		actions.appendChild(b);
		return b;
	};
	const pauseBtn = mk("Pause", () => set({ paused: !state.paused }));
	mk("Randomise", () => set({ seed: Math.floor(Math.random() * 100) }));
	mk("Reset", reset);
	const copyBtn = mk("Copy", () => {
		const text = JSON.stringify(state, null, 2);
		const done = () => {
			copyBtn.textContent = "Copied";
			setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
		};
		if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done);
		else done();
	});
	panel.appendChild(actions);

	function syncInputs() {
		if (!panel) return;
		for (const [key, { input, value }] of Object.entries(inputs)) {
			input.value = state[key];
			value.textContent = Number.isInteger(state[key])
				? state[key]
				: Number(state[key]).toFixed(2);
		}
		select.value = state.palette;
		pauseBtn.textContent = state.paused ? "Play" : "Pause";
	}

	function togglePanel(force) {
		panel.hidden = typeof force === "boolean" ? !force : !panel.hidden;
	}

	document.body.appendChild(panel);
	syncInputs();

	document.addEventListener("keydown", (e) => {
		if ((e.metaKey || e.ctrlKey) && e.key === ".") {
			e.preventDefault();
			togglePanel();
		} else if (e.key === "Escape" && !panel.hidden) {
			togglePanel(false);
		}
	});
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
