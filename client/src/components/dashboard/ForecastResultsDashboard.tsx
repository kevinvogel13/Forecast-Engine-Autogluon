import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, TrendingUp, AlertCircle, ArrowUpRight, Clock, Target, Layers, BarChart3, Trophy } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar, ScatterChart, Scatter, Cell, ComposedChart, Line, ReferenceLine } from 'recharts';

export interface ForecastResults {
  forecast?: any[];
  backtest?: any[];
  leaderboard?: any[];
  per_series_metrics?: any[];
  mape?: number;
  rmse?: number;
  mae?: number;
  forecast_rows?: number;
  target?: string;
  horizon?: number;
  preset?: string;
  training_time?: number;
}

const MOCK_FORECAST = [
  { date: '2024-01', actual: 4000, forecast: 4100, lower: 3800, upper: 4400 },
  { date: '2024-02', actual: 3000, forecast: 3200, lower: 2900, upper: 3500 },
  { date: '2024-03', actual: 2000, forecast: 2400, lower: 2100, upper: 2700 },
  { date: '2024-04', actual: 2780, forecast: 2900, lower: 2600, upper: 3200 },
  { date: '2024-05', actual: 1890, forecast: 2000, lower: 1700, upper: 2300 },
  { date: '2024-06', actual: 2390, forecast: 2500, lower: 2200, upper: 2800 },
  { date: '2024-07', actual: 3490, forecast: 3400, lower: 3100, upper: 3700 },
  { date: '2024-08', forecast: 3800, lower: 3400, upper: 4200 },
  { date: '2024-09', forecast: 4200, lower: 3800, upper: 4600 },
  { date: '2024-10', forecast: 4500, lower: 4000, upper: 5000 },
];

const categoryColors: Record<string, string> = {
  'Smooth': '#22c55e', 'Erratic': '#f59e0b', 'Lumpy': '#ef4444', 'Intermittent': '#8b5cf6',
};

interface Props {
  results?: ForecastResults | null;
}

export default function ForecastResultsDashboard({ results }: Props) {
  const [selectedLag, setSelectedLag] = useState('1');
  const hasRealData = !!(results && (results.forecast || results.backtest || results.mape !== undefined));

  const forecastChartData = useMemo(() => {
    if (!hasRealData) return MOCK_FORECAST;
    const rows = results?.backtest || [];
    const fRows = (results?.forecast || []).slice(0, 24);
    const BT_NON_TIME = new Set(['actual','forecast','fold','horizon_step']);
    const rawTimeKeys = Object.keys(rows[0] || {}).filter(k => !BT_NON_TIME.has(k));
    // Prefer 'timestamp' (AutoGluon holdout) then the first non-id numeric-looking key, fallback to first
    const timeKey = rawTimeKeys.includes('timestamp')
      ? 'timestamp'
      : (rawTimeKeys.find(k => !k.match(/^[A-Z]/) && !k.includes('_id')) || rawTimeKeys[0] || 'date');
    const combined: any[] = rows.map((r: any) => ({
      date: typeof r[timeKey] === 'string' ? r[timeKey].slice(0, 10) : String(r[timeKey] ?? ''),
      actual: typeof r.actual === 'number' ? r.actual : undefined,
      forecast: typeof r.forecast === 'number' ? r.forecast : undefined,
    }));
    fRows.forEach((r: any) => {
      // AutoGluon rows: item_id, timestamp, mean/quantile cols. Statistical rows: time_col, forecast, ...
      // Prefer 'timestamp' explicitly, then fall back to the first non-id, non-forecast, non-numeric key.
      const NON_TIME = new Set(['forecast','forecast_lower','forecast_upper','horizon_step','item_id','mean']);
      const fTimeKeys = Object.keys(r).filter(k =>
        !NON_TIME.has(k) && !k.match(/^[A-Z]/) && !k.match(/^\d/)
      );
      const ftKey = ('timestamp' in r) ? 'timestamp' : (fTimeKeys[0] || 'date');
      combined.push({
        date: typeof r[ftKey] === 'string' ? r[ftKey].slice(0, 10) : String(r[ftKey] ?? ''),
        forecast: r.forecast ?? r['mean'] ?? r['0.5'] ?? undefined,
        lower: r.forecast_lower ?? r['0.1'] ?? undefined,
        upper: r.forecast_upper ?? r['0.9'] ?? undefined,
      });
    });
    return combined.slice(-60);
  }, [results, hasRealData]);

  const lagData = useMemo(() => {
    if (!results?.backtest?.length) return [];
    const byStep: Record<number, { actuals: number[]; forecasts: number[] }> = {};
    results.backtest.forEach((r: any) => {
      const step = r.horizon_step ?? 1;
      if (!byStep[step]) byStep[step] = { actuals: [], forecasts: [] };
      if (typeof r.actual === 'number' && typeof r.forecast === 'number') {
        byStep[step].actuals.push(r.actual);
        byStep[step].forecasts.push(r.forecast);
      }
    });
    return Object.entries(byStep).slice(0, 12).map(([lag, { actuals, forecasts }]) => {
      const avgActual = actuals.reduce((a, b) => a + b, 0) / (actuals.length || 1);
      const avgForecast = forecasts.reduce((a, b) => a + b, 0) / (forecasts.length || 1);
      const mapeArr: number[] = [];
      actuals.forEach((a, i) => {
        if (a !== 0 && typeof forecasts[i] === 'number') {
          mapeArr.push(Math.abs((a - forecasts[i]) / a) * 100);
        }
      });
      const error = mapeArr.length ? mapeArr.reduce((a, b) => a + b, 0) / mapeArr.length : 0;
      return { lag: `Lag ${lag}`, actual: Math.round(avgActual), forecast: Math.round(avgForecast), error: Math.round(error * 10) / 10 };
    });
  }, [results]);

  const leaderboard = useMemo(() => {
    if (results?.leaderboard?.length) return results.leaderboard;
    return [
      { model_name: 'DeepAR', score: -0.85 },
      { model_name: 'AutoARIMA', score: -1.10 },
      { model_name: 'ETS', score: -1.25 },
    ];
  }, [results]);

  const totalForecast = useMemo(() => {
    if (!results?.forecast?.length) return null;
    const vals = results.forecast.map((r: any) => r.forecast ?? r['mean'] ?? r['0.5'] ?? 0).filter((v: any) => typeof v === 'number');
    return vals.reduce((a: number, b: number) => a + b, 0);
  }, [results]);

  const bias = useMemo(() => {
    if (!results?.backtest?.length) return null;
    const rows = results.backtest.filter((r: any) => typeof r.actual === 'number' && typeof r.forecast === 'number');
    if (!rows.length) return null;
    const avg = rows.reduce((s: number, r: any) => s + (r.forecast - r.actual), 0) / rows.length;
    const mean = rows.reduce((s: number, r: any) => s + r.actual, 0) / rows.length;
    return mean ? Math.round((avg / mean) * 1000) / 10 : null;
  }, [results]);

  const downloadCSV = (data: any[], filename: string) => {
    if (!data?.length) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {hasRealData && (
        <div className="flex items-center gap-2 px-1">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">Live Results</Badge>
          {results?.preset && <Badge variant="outline" className="text-xs text-slate-600">{results.preset}</Badge>}
          {results?.target && <span className="text-xs text-muted-foreground">Target: <span className="font-mono font-medium">{results.target}</span></span>}
        </div>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="patterns" data-testid="tab-patterns">Pattern Analysis</TabsTrigger>
          <TabsTrigger value="lag" data-testid="tab-lag">Lag Comparison</TabsTrigger>
          <TabsTrigger value="export" data-testid="tab-export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Forecast Accuracy (MAPE)</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-mape">
                  {results?.mape !== undefined ? `${results.mape.toFixed(1)}%` : '—'}
                </div>
                <p className="text-xs text-muted-foreground">{hasRealData ? 'From backtest folds' : 'No run yet'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Predicted Volume</CardTitle>
                <ArrowUpRight className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-volume">
                  {totalForecast !== null ? (totalForecast > 1000000 ? `${(totalForecast/1000000).toFixed(1)}M` : totalForecast > 1000 ? `${(totalForecast/1000).toFixed(1)}K` : totalForecast.toFixed(0)) : '—'}
                </div>
                <p className="text-xs text-muted-foreground">{results?.horizon ? `Next ${results.horizon} periods` : 'Forecast horizon'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bias</CardTitle>
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-bias">
                  {bias !== null ? `${bias > 0 ? '+' : ''}${bias}%` : '—'}
                </div>
                <p className="text-xs text-muted-foreground">{bias !== null ? (bias > 0 ? 'Over-forecast' : bias < 0 ? 'Under-forecast' : 'Unbiased') : 'Run pipeline first'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">RMSE</CardTitle>
                <Clock className="h-4 w-4 text-slate-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {results?.rmse !== undefined ? results.rmse.toFixed(1) : '—'}
                </div>
                <p className="text-xs text-muted-foreground">Root mean squared error</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Forecast vs Actuals</CardTitle>
                <CardDescription>Historical backtest performance and future predictions.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={forecastChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="upper" stroke="transparent" fill="#8884d8" fillOpacity={0.1} name="Upper CI" />
                      <Area type="monotone" dataKey="lower" stroke="transparent" fill="transparent" />
                      <Area type="monotone" dataKey="forecast" stroke="#8884d8" strokeWidth={2} fillOpacity={1} fill="url(#colorForecast)" name="Forecast" />
                      <Area type="monotone" dataKey="actual" stroke="#82ca9d" strokeWidth={2} fillOpacity={1} fill="url(#colorActual)" name="Actuals" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Trophy className="w-4 h-4 text-yellow-500" /> Model Leaderboard</CardTitle>
                <CardDescription>Top performing algorithms.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {leaderboard.slice(0, 6).map((m: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2.5 border rounded-lg hover:bg-muted/50 transition-colors" data-testid={`model-${i}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'}`}>{i + 1}</div>
                        <div>
                          <p className="font-medium text-sm truncate max-w-[120px]">{m.model_name || m.model || 'Model'}</p>
                          <p className="text-[10px] text-muted-foreground">Score: {typeof (m.score_val ?? m.score) === 'number' ? (m.score_val ?? m.score).toFixed(3) : '—'}</p>
                        </div>
                      </div>
                      {i === 0 && <Badge className="text-[9px] bg-yellow-100 text-yellow-700 border-yellow-200">Best</Badge>}
                    </div>
                  ))}
                  {!leaderboard.length && <p className="text-sm text-muted-foreground text-center py-4">Run pipeline to see models</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          {results?.per_series_metrics?.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Per-Series Accuracy</CardTitle>
                <CardDescription>Series sorted by MAPE descending — orange rows exceed 20% error.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-slate-50 border-b">
                      {Object.keys(results.per_series_metrics[0]).map(k => <th key={k} className="px-3 py-2 text-left font-semibold text-slate-600">{k.toUpperCase()}</th>)}
                    </tr></thead>
                    <tbody>
                      {results.per_series_metrics.slice(0, 30).map((row: any, i: number) => (
                        <tr key={i} className={`border-b hover:bg-muted/30 ${(row.mape ?? 0) > 20 ? 'bg-orange-50' : ''}`}>
                          {Object.entries(row).map(([k, v]) => (
                            <td key={k} className={`px-3 py-1.5 font-mono ${k === 'mape' && (v as number) > 20 ? 'text-orange-600 font-semibold' : ''}`}>
                              {typeof v === 'number' ? v.toFixed(2) : String(v)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="patterns" className="space-y-6 mt-6">
          <p className="text-sm text-muted-foreground">
            {hasRealData ? 'Add an Exploration node with Demand Classification chart type to your pipeline to see CV/ADI analysis.' : 'Run the pipeline and add an Exploration node to view pattern analysis.'}
          </p>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Target className="w-5 h-5" /> CV vs ADI Demand Classification</CardTitle>
              <CardDescription>Connect an Exploration node with "Demand Classification" chart type to see this automatically populated.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                <div className="text-center space-y-2">
                  <Target className="w-8 h-8 mx-auto text-muted-foreground/50" />
                  <p>Add a Demand Classification chart in an Exploration node</p>
                  <p className="text-xs">Connect it upstream of a Report node to include in results</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lag" className="space-y-6 mt-6">
          {lagData.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Accuracy by Forecast Horizon</h3>
                  <p className="text-sm text-muted-foreground">Error typically increases with longer horizons</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Detail:</span>
                  <Select value={selectedLag} onValueChange={setSelectedLag}>
                    <SelectTrigger className="w-28" data-testid="select-lag">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {lagData.map((d, i) => <SelectItem key={i} value={String(i + 1)}>{d.lag}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle>Error % by Lag</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={lagData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="lag" tick={{ fontSize: 10 }} />
                          <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 10 }} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Legend />
                          <Bar yAxisId="left" dataKey="actual" fill="#82ca9d" name="Actual" />
                          <Bar yAxisId="left" dataKey="forecast" fill="#8884d8" name="Forecast" />
                          <Line yAxisId="right" type="monotone" dataKey="error" stroke="#ff7300" strokeWidth={2} name="MAPE %" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>{lagData[parseInt(selectedLag) - 1]?.lag ?? 'Lag'} Detail</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {(() => {
                      const d = lagData[parseInt(selectedLag) - 1];
                      if (!d) return null;
                      return (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                            <p className="text-xs text-green-700 font-medium">Avg Actual</p>
                            <p className="text-xl font-bold text-green-800" data-testid="lag-actual">{d.actual.toLocaleString()}</p>
                          </div>
                          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                            <p className="text-xs text-purple-700 font-medium">Avg Forecast</p>
                            <p className="text-xl font-bold text-purple-800" data-testid="lag-forecast">{d.forecast.toLocaleString()}</p>
                          </div>
                          <div className="col-span-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                            <p className="text-xs text-amber-700 font-medium">MAPE Error</p>
                            <p className="text-xl font-bold text-amber-800" data-testid="lag-error">{d.error}%</p>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Enable backtesting in Model Config and run the pipeline to see lag analysis.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="export" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Export Results</CardTitle>
              <CardDescription>Download forecast results in various formats</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors text-left disabled:opacity-40"
                  disabled={!results?.forecast?.length}
                  onClick={() => downloadCSV(results!.forecast!, 'forecast.csv')}
                  data-testid="button-export-forecast-csv"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg"><Download className="w-5 h-5 text-green-600" /></div>
                    <div>
                      <p className="font-medium">Forecast Data (CSV)</p>
                      <p className="text-sm text-muted-foreground">{results?.forecast?.length ?? 0} forecast rows with confidence intervals</p>
                    </div>
                  </div>
                </button>
                <button
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors text-left disabled:opacity-40"
                  disabled={!results?.backtest?.length}
                  onClick={() => downloadCSV(results!.backtest!, 'backtest.csv')}
                  data-testid="button-export-backtest-csv"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg"><BarChart3 className="w-5 h-5 text-blue-600" /></div>
                    <div>
                      <p className="font-medium">Backtest Data (CSV)</p>
                      <p className="text-sm text-muted-foreground">{results?.backtest?.length ?? 0} historical validation rows</p>
                    </div>
                  </div>
                </button>
                <button
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors text-left disabled:opacity-40"
                  disabled={!results?.per_series_metrics?.length}
                  onClick={() => downloadCSV(results!.per_series_metrics!, 'per_series_metrics.csv')}
                  data-testid="button-export-series-csv"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-100 rounded-lg"><Layers className="w-5 h-5 text-violet-600" /></div>
                    <div>
                      <p className="font-medium">Per-Series Metrics (CSV)</p>
                      <p className="text-sm text-muted-foreground">{results?.per_series_metrics?.length ?? 0} series accuracy breakdown</p>
                    </div>
                  </div>
                </button>
                <button
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors text-left disabled:opacity-40"
                  disabled={!results?.leaderboard?.length}
                  onClick={() => downloadCSV(results!.leaderboard!, 'model_leaderboard.csv')}
                  data-testid="button-export-leaderboard-csv"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-100 rounded-lg"><Trophy className="w-5 h-5 text-yellow-600" /></div>
                    <div>
                      <p className="font-medium">Model Leaderboard (CSV)</p>
                      <p className="text-sm text-muted-foreground">{results?.leaderboard?.length ?? 0} model rankings</p>
                    </div>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
