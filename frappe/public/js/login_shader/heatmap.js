// Ported from godel-earth-site/lib/heatmap.ts (types stripped).
/**
 * Figma custom fill: "Moving gradient" (shader2.zip).
 *
 * Web port of the shader's height field + gradient ramp. The live Figma effect
 * is a WebGPU sphere; here a tileable perlin / warp / fBm stack is sampled on
 * a 2D plane, painted once per palette, and CSS-pans for motion.
 *
 * Tileability is not optional: every surface uses `background-repeat` and the
 * drift keyframe shifts by exactly one tile. If opposite edges of the bake do
 * not meet, that seam scrolls across the Talk to Us field (and every other
 * shader surface) once per cycle. The fBm therefore doubles frequency on-axis
 * only — the shader's octave rotation mixes X/Y into Z and breaks the wrap.
 *
 * Brand surfaces (logo + Talk to Us) keep the warm topographic ramp; product
 * instances keep their own palettes (see SATOM_GRADIENT etc.).
 */

/**
 * Every knob on the shader. All are safe to change at runtime — the provider
 * re-renders the field whenever this object changes.
 */

/**
 * Brand ramp for the logo square and Talk to Us field — the original warm
 * topographic colors (orange → magenta → purple → blue), not the Moving
 * gradient shader's default stops.
 */
export const ELEV_GRADIENT = [
	{ position: 0, color: [1, 0.4, 0.1, 1] },
	{ position: 0.4, color: [0.9, 0.2, 0.5, 1] },
	{ position: 0.7, color: [0.5, 0.1, 0.8, 1] },
	{ position: 1, color: [0.1, 0.3, 1, 1] },
];

/**
 * Quote-section ramp: warm orange through red and back to yellow, so the
 * phrase reads hot end-to-end rather than cooling into blue.
 * Hex source: FF811A / E53351 / FF9A3B / FFF01A, all at 100% opacity.
 */
export const QUOTE_GRADIENT = [
	{ position: 0, color: [1, 0.50588, 0.10196, 1] },
	{ position: 0.4, color: [0.89804, 0.2, 0.31765, 1] },
	{ position: 0.7, color: [1, 0.60392, 0.23137, 1] },
	{ position: 1, color: [1, 0.94118, 0.10196, 1] },
];

/** SatOM — warm reds, oranges and yellows. */
export const SATOM_GRADIENT = [
	{ position: 0, color: [0.902, 0.133, 0.133, 1] },
	{ position: 0.4, color: [1, 0.416, 0, 1] },
	{ position: 0.7, color: [1, 0.62, 0.106, 1] },
	{ position: 1, color: [1, 0.878, 0.102, 1] },
];

/** SatCON — greens through teal into blue. */
export const SATCON_GRADIENT = [
	{ position: 0, color: [0.071, 0.718, 0.416, 1] },
	{ position: 0.4, color: [0.059, 0.749, 0.631, 1] },
	{ position: 0.7, color: [0.118, 0.608, 0.878, 1] },
	{ position: 1, color: [0.102, 0.275, 1, 1] },
];

/** LumenOS — purples into pinks. */
export const LUMENOS_GRADIENT = [
	{ position: 0, color: [0.482, 0.173, 0.91, 1] },
	{ position: 0.4, color: [0.651, 0.231, 0.941, 1] },
	{ position: 0.7, color: [0.839, 0.294, 0.839, 1] },
	{ position: 1, color: [1, 0.361, 0.784, 1] },
];

/** SureSight — reds into pinks. */
export const SURESIGHT_GRADIENT = [
	{ position: 0, color: [0.878, 0.106, 0.235, 1] },
	{ position: 0.4, color: [0.941, 0.2, 0.373, 1] },
	{ position: 0.7, color: [1, 0.302, 0.553, 1] },
	{ position: 1, color: [1, 0.498, 0.769, 1] },
];

/** Icon SVGs — the brand ramp opening on amber rather than orange. */
export const ICON_GRADIENT = [
	{ position: 0, color: [1, 0.68235, 0, 1] },
	{ position: 0.4, color: [0.9, 0.2, 0.5, 1] },
	{ position: 0.7, color: [0.5, 0.1, 0.8, 1] },
	{ position: 1, color: [0.1, 0.3, 1, 1] },
];

export const HEATMAP_DEFAULTS = {
	/*
	 * Chosen so terrainScale/zoom is an integer (6). The bake spans exactly that
	 * many lattice cells; a fractional period left a hard edge where CSS repeats.
	 */
	terrainScale: 2.1,
	terrainComplexity: 3,
	offsetX: 50,
	offsetY: 50,
	seed: 0,
	zoom: 0.35,
	contrast: 1.15,
	warp: 0.26,
	/* 512 cost one 80ms task on load; 256 costs none and is indistinguishable. */
	resolution: 256,
	gradient: ELEV_GRADIENT,
};

function fract(n) {
	return n - Math.floor(n);
}

/** Positive modulo — JS `%` keeps the sign of the dividend, which breaks wrap. */
function wrap(n, period) {
	return ((n % period) + period) % period;
}

function mix(a, b, t) {
	return a + (b - a) * t;
}

function smoother(t) {
	return t * t * t * (t * (t * 6 - 15) + 10);
}

/*
 * Tileable 3D hash / perlin, ported from shader2. Cell X/Y wrap on the lattice
 * period so the baked texture still loops under CSS drift; Z is free.
 */
function hash33(x, y, z) {
	const qx = x * 127.1 + y * 311.7 + z * 74.7;
	const qy = x * 269.5 + y * 183.3 + z * 246.1;
	const qz = x * 113.5 + y * 271.9 + z * 124.6;
	return [
		fract(Math.sin(qx) * 43758.5453) * 2 - 1,
		fract(Math.sin(qy) * 43758.5453) * 2 - 1,
		fract(Math.sin(qz) * 43758.5453) * 2 - 1,
	];
}

function gradDot(cx, cy, cz, ox, oy, oz, lx, ly, lz, periodX, periodY) {
	const [gx, gy, gz] = hash33(wrap(cx + ox, periodX), wrap(cy + oy, periodY), cz + oz);
	return gx * (lx - ox) + gy * (ly - oy) + gz * (lz - oz);
}

function perlin3(px, py, pz, periodX, periodY) {
	const cx = Math.floor(px);
	const cy = Math.floor(py);
	const cz = Math.floor(pz);
	const lx = px - cx;
	const ly = py - cy;
	const lz = pz - cz;
	const wx = smoother(lx);
	const wy = smoother(ly);
	const wz = smoother(lz);

	const n000 = gradDot(cx, cy, cz, 0, 0, 0, lx, ly, lz, periodX, periodY);
	const n100 = gradDot(cx, cy, cz, 1, 0, 0, lx, ly, lz, periodX, periodY);
	const n010 = gradDot(cx, cy, cz, 0, 1, 0, lx, ly, lz, periodX, periodY);
	const n110 = gradDot(cx, cy, cz, 1, 1, 0, lx, ly, lz, periodX, periodY);
	const n001 = gradDot(cx, cy, cz, 0, 0, 1, lx, ly, lz, periodX, periodY);
	const n101 = gradDot(cx, cy, cz, 1, 0, 1, lx, ly, lz, periodX, periodY);
	const n011 = gradDot(cx, cy, cz, 0, 1, 1, lx, ly, lz, periodX, periodY);
	const n111 = gradDot(cx, cy, cz, 1, 1, 1, lx, ly, lz, periodX, periodY);

	const nx00 = mix(n000, n100, wx);
	const nx10 = mix(n010, n110, wx);
	const nx01 = mix(n001, n101, wx);
	const nx11 = mix(n011, n111, wx);
	const nxy0 = mix(nx00, nx10, wy);
	const nxy1 = mix(nx01, nx11, wy);
	return mix(nxy0, nxy1, wz) * 1.1547;
}

/**
 * Tileable fBm: each octave doubles frequency on the same axes and widens its
 * wrap period by the same factor, so the sum still repeats every
 * (periodX, periodY). A 3D rotation between octaves (as in shader2) would mix
 * X/Y into Z and the lattice would no longer close on itself.
 */
function fbm(x, y, z, octaves, periodX, periodY) {
	let qx = x;
	let qy = y;
	let qz = z;
	let total = 0;
	let amplitude = 1;
	let weight = 0;

	for (let i = 0; i < octaves; i++) {
		const scale = 2 ** i;
		total += perlin3(qx, qy, qz, periodX * scale, periodY * scale) * amplitude;
		weight += amplitude;
		/* Exact ×2 keeps octave i's period = base × 2^i. Constants are fine — a
       periodic function shifted by a constant is still periodic. */
		qx = qx * 2 + 3.7;
		qy = qy * 2 + 1.9;
		qz = qz * 2 + 6.3;
		amplitude *= 0.48;
	}

	return total / Math.max(weight, 1e-4);
}

function warpVector(x, y, z, periodX, periodY) {
	return [
		perlin3(x, y, z, periodX, periodY),
		perlin3(x + 5.2, y + 1.3, z + 2.8, periodX, periodY),
		perlin3(x + 1.7, y + 9.2, z + 4.4, periodX, periodY),
	];
}

/**
 * Lattice period across one texture. `computeElevation` samples exactly this
 * many cells edge-to-edge, so opposite edges meet and CSS drift can loop
 * without a seam. Must stay a whole number of cells (hence the round).
 */
function noisePeriods(params, aspect) {
	const { terrainScale, zoom } = params;
	return {
		periodX: Math.max(1, Math.round((terrainScale * aspect) / zoom)),
		periodY: Math.max(1, Math.round(terrainScale / zoom)),
	};
}

/**
 * Smoothstep blend between stops — matches shader2's gradientAt easing.
 */
function elevGradientRamp(t, stops) {
	if (t <= stops[0].position) return [...stops[0].color];
	const last = stops[stops.length - 1];
	if (t >= last.position) return [...last.color];
	for (let i = 0; i < stops.length - 1; i++) {
		const a = stops[i];
		const b = stops[i + 1];
		if (t <= b.position) {
			let u = (t - a.position) / Math.max(b.position - a.position, 1e-5);
			u = u * u * (3 - 2 * u);
			return [
				mix(a.color[0], b.color[0], u),
				mix(a.color[1], b.color[1], u),
				mix(a.color[2], b.color[2], u),
				mix(a.color[3], b.color[3], u),
			];
		}
	}
	return [...last.color];
}

/** S-curve about 0.5, so raising contrast separates the ramp's ends. */
function applyContrast(value, contrast) {
	if (contrast === 1) return value;
	const centred = Math.min(1, Math.max(0, value)) - 0.5;
	return Math.min(1, Math.max(0, 0.5 + centred * contrast));
}

/** Shader2's spreadCoordinate — stretches midtones so colours separate. */
function spreadCoordinate(raw) {
	return Math.min(1, Math.max(0, (raw - 0.5) * 3 + 0.5));
}

/**
 * The terrain itself, independent of colour.
 *
 * Split out so a page showing the same field in several palettes pays for the
 * noise once and then only re-maps colours, instead of re-running fBm per
 * palette — the expensive half by a wide margin.
 */
export function computeElevation(width, height, params = HEATMAP_DEFAULTS) {
	const { terrainComplexity, offsetX, offsetY, seed, contrast, warp } = params;
	const field = new Float32Array(width * height);
	const aspect = width / Math.max(height, 1);
	const octaves = Math.max(1, Math.min(8, Math.round(terrainComplexity)));
	const seedOffX = seed * 17.3;
	const seedOffY = seed * 31.7;
	/* Fixed morph snapshot — enough travel that the warp reads, not a blank t=0. */
	const morphZ = 2.4 + seed * 0.37;
	const { periodX, periodY } = noisePeriods(params, aspect);
	/*
	 * Sample exactly one lattice period across the texture. Deriving nx from
	 * zoomed UVs left a fractional leftover whenever terrainScale/zoom was not
	 * already an integer — opposite edges then disagreed and `background-repeat`
	 * drew a seam. Offsets are in period units so a pan does not change the span.
	 */
	const offX = (offsetX / 100 - 0.5) * periodX;
	const offY = (offsetY / 100 - 0.5) * periodY;

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const nx = ((x + 0.5) / width) * periodX + seedOffX + offX;
			const ny = ((y + 0.5) / height) * periodY + seedOffY + offY;

			/* Domain warp, then fBm — both wrap on (periodX, periodY). Scaling the
         warp domain (e.g. ×0.55) without scaling the period by the same factor
         is what used to leave a seam after one CSS tile. */
			const px = nx + 1.7;
			const py = ny + 3.1;
			const pz = morphZ + 5.3;
			const [wx, wy, wz] = warpVector(px, py, pz, periodX, periodY);
			const raw = fbm(
				px + wx * warp,
				py + wy * warp,
				pz + wz * warp,
				octaves,
				periodX,
				periodY
			);
			field[y * width + x] = applyContrast(spreadCoordinate(raw * 0.5 + 0.5), contrast);
		}
	}

	return field;
}

/** Ramp samples baked per palette before painting. Also the LUT's length. */
const RAMP_STEPS = 256;

/**
 * Bake a gradient into a flat RGBA table, one entry per 1/256 of the ramp.
 *
 * `elevGradientRamp` walks the stop list and allocates a four-element array on
 * every call. Called per pixel that was ~262k stop-searches and ~262k throwaway
 * arrays per palette, times seven palettes — the bulk of the startup cost, and
 * all of it recomputing the same 256 distinct answers. Baking the ramp once
 * turns the paint loop into an indexed read.
 */
function buildRamp(gradient) {
	const ramp = new Uint8ClampedArray(RAMP_STEPS * 4);
	for (let i = 0; i < RAMP_STEPS; i++) {
		const [r, g, b, a] = elevGradientRamp(i / (RAMP_STEPS - 1), gradient);
		const o = i * 4;
		ramp[o] = r * 255;
		ramp[o + 1] = g * 255;
		ramp[o + 2] = b * 255;
		ramp[o + 3] = a * 255;
	}
	return ramp;
}

/** Colour a precomputed elevation field and paint it into the context. */
export function paintElevation(ctx, field, width, height, gradient) {
	const img = ctx.createImageData(width, height);
	const data = img.data;
	const ramp = buildRamp(gradient);
	const top = RAMP_STEPS - 1;

	for (let i = 0; i < field.length; i++) {
		/*
		 * `elevGradientRamp` clamped out-of-range elevations to the end stops, and
		 * the params are documented as runtime-tunable, so the same guard stays
		 * here rather than resting on fBm's current 0..0.97 output range.
		 */
		const t = field[i];
		const r = (t <= 0 ? 0 : t >= 1 ? top : (t * top + 0.5) | 0) << 2;
		const o = i * 4;
		data[o] = ramp[r];
		data[o + 1] = ramp[r + 1];
		data[o + 2] = ramp[r + 2];
		data[o + 3] = ramp[r + 3];
	}

	ctx.putImageData(img, 0, 0);
}
