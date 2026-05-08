/**
 * Status classification for a Site Health signal.
 * Drives the badge color and glyph rendered by `SiteHealthSignalRow`.
 *
 * - `ok`:   signal is healthy
 * - `warn`: signal is borderline / needs attention
 * - `fail`: signal is bad
 * - `info`: signal value is unknown / not yet measured
 */
export type SignalStatus = 'ok' | 'warn' | 'fail' | 'info';

/** Boolean check: `true → ok`, `false → warn`, `null/undefined → info`. */
export function statusBool(b: boolean | null | undefined): SignalStatus {
  if (b === true) return 'ok';
  if (b === false) return 'warn';
  return 'info';
}

/**
 * Google Business Profile star rating (0.0 - 5.0).
 * `>=4.5 → ok`, `>=4.0 → warn`, else `fail`. `null/undefined → info`.
 */
export function ratingStatus(n: number | null | undefined): SignalStatus {
  if (n == null) return 'info';
  if (n >= 4.5) return 'ok';
  if (n >= 4.0) return 'warn';
  return 'fail';
}

/**
 * Homepage `<title>` length in characters.
 * `30..60 → ok`, anything else `warn`. `null/undefined → info`.
 */
export function titleStatus(n: number | null | undefined): SignalStatus {
  if (n == null) return 'info';
  if (n >= 30 && n <= 60) return 'ok';
  return 'warn';
}

/**
 * Meta-description length in characters.
 * `70..160 → ok`, anything else `warn`. `null/undefined → info`.
 */
export function descStatus(n: number | null | undefined): SignalStatus {
  if (n == null) return 'info';
  if (n >= 70 && n <= 160) return 'ok';
  return 'warn';
}

/**
 * PageSpeed Insights mobile performance score (0-100).
 * `>=90 → ok`, `>=50 → warn`, else `fail`. `null/undefined → info`.
 */
export function scoreStatus(n: number | null | undefined): SignalStatus {
  if (n == null) return 'info';
  if (n >= 90) return 'ok';
  if (n >= 50) return 'warn';
  return 'fail';
}

/**
 * Largest Contentful Paint (LCP) in milliseconds (Core Web Vitals).
 * `<=2500 → ok`, `<=4000 → warn`, else `fail`. `null/undefined → info`.
 */
export function lcpStatus(ms: number | null | undefined): SignalStatus {
  if (ms == null) return 'info';
  if (ms <= 2500) return 'ok';
  if (ms <= 4000) return 'warn';
  return 'fail';
}

/**
 * Cumulative Layout Shift (CLS), unitless (Core Web Vitals).
 * `<=0.1 → ok`, `<=0.25 → warn`, else `fail`. `null/undefined → info`.
 */
export function clsStatus(cls: number | null | undefined): SignalStatus {
  if (cls == null) return 'info';
  if (cls <= 0.1) return 'ok';
  if (cls <= 0.25) return 'warn';
  return 'fail';
}
