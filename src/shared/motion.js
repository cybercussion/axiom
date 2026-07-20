/**
 * Motion-token access for JS timing.
 *
 * Any JS timer that waits out a CSS transition MUST read the live token via
 * motionMs() instead of hardcoding a millisecond literal — literals silently
 * desync when a token is retuned, and they ignore the reduced-motion collapse
 * (tokens drop to 1ms under prefers-reduced-motion / [data-motion="reduced"]).
 */
export const motionMs = (token, fallback = 300) => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  // Tokens are declared in ms, but tolerate seconds notation.
  return raw.endsWith('ms') ? n : raw.endsWith('s') ? n * 1000 : n;
};
