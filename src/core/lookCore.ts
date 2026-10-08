// Sizes for the low-resolution render pass.

/**
 * The internal render size for a window of `width` × `height`: `lines` high
 * with the window's aspect, never larger than the window itself.
 */
export function lowResSize(width: number, height: number, lines: number): { width: number; height: number } {
  const h = Math.max(1, Math.min(Math.round(lines), Math.round(height)));
  const w = Math.max(1, Math.round((h * width) / Math.max(1, height)));
  return { width: w, height: h };
}
