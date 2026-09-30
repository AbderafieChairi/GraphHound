/**
 * Color helpers for the graph canvas. Cytoscape renders to a `<canvas>` and
 * cannot parse `oklch()`, so theme CSS variables are read and converted to rgba.
 */

/** Convert an `oklch(...)` string to `rgba(...)`, or null if it doesn't match. */
export function oklchToRgba(input: string): string | null {
  const m = input.match(
    /^oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+%?)\s*)?\)$/i,
  );
  if (!m) return null;
  const num = (v: string, scale: number) =>
    v.endsWith("%") ? (parseFloat(v) / 100) * scale : parseFloat(v);
  const L = num(m[1]!, 1);
  const C = num(m[2]!, 0.4);
  const h = (parseFloat(m[3]!) * Math.PI) / 180;
  const alpha = m[4] ? num(m[4], 1) : 1;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  const [r, g, bl] = lin.map((v) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, c)) * 255);
  });
  return `rgba(${r}, ${g}, ${bl}, ${alpha})`;
}

/** Read a CSS custom property from :root, converting oklch to rgba for canvas use. */
export function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  return oklchToRgba(raw) ?? raw;
}
