// Pure helpers for presenting forecast-accuracy metrics in the UI.
//
// Extracted from the dashboard component so the selection/extraction logic is
// unit-testable in a plain node environment (no jsdom/RTL needed), matching the
// project's existing pure-logic test approach (see server/filter-utils.ts).

export interface ForecastMetrics {
  mape?: number;
  rmse?: number;
  mae?: number;
  smape?: number;
  wape?: number;
  mase?: number;
  pinball_loss?: number;
  coverage_nominal?: number;
  [key: string]: number | undefined | unknown;
}

/**
 * Resolve the empirical interval-coverage metric.
 * The engine emits `coverage_nominal` (e.g. 80) plus a dynamic `coverage_80`
 * key holding the observed coverage. Returns null when not present.
 */
export function getCoverage(m: ForecastMetrics | null | undefined): { nominal: number; actual: number } | null {
  if (!m || typeof m.coverage_nominal !== 'number') return null;
  const actual = m[`coverage_${m.coverage_nominal}`];
  return typeof actual === 'number' ? { nominal: m.coverage_nominal, actual } : null;
}

export interface SecondaryMetric {
  label: string;
  value: string;
  hint: string;
}

/**
 * Build the list of "secondary" metric tiles to show, in display order,
 * skipping any the engine didn't report. Keeps the dashboard and the
 * FlowEditor output panel consistent.
 */
export function secondaryMetrics(m: ForecastMetrics | null | undefined): SecondaryMetric[] {
  if (!m) return [];
  const out: SecondaryMetric[] = [];
  if (typeof m.wape === 'number') out.push({ label: 'WAPE', value: `${m.wape.toFixed(1)}%`, hint: 'Weighted abs. % error' });
  if (typeof m.smape === 'number') out.push({ label: 'sMAPE', value: `${m.smape.toFixed(1)}%`, hint: 'Symmetric MAPE' });
  if (typeof m.mase === 'number') out.push({ label: 'MASE', value: m.mase.toFixed(2), hint: '<1 beats naive' });
  if (typeof m.pinball_loss === 'number') out.push({ label: 'Pinball loss', value: m.pinball_loss.toFixed(2), hint: 'Quantile calibration' });
  const cov = getCoverage(m);
  if (cov) out.push({ label: `Coverage (${cov.nominal}%)`, value: `${cov.actual.toFixed(0)}%`, hint: `Target ${cov.nominal}%` });
  return out;
}

export function hasSecondaryMetrics(m: ForecastMetrics | null | undefined): boolean {
  return secondaryMetrics(m).length > 0;
}
