/** Relative luminance 0..1 of a computed CSS color, or null if it is transparent/unparseable. */
export const luminance = (color: string) => { const [r, g, b, a] = (color.match(/[\d.]+/g) ?? []).map(Number); if (r === undefined || g === undefined || b === undefined || a === 0) return null; return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
