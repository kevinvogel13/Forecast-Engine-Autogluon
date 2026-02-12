import { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell, PieChart, Pie, AreaChart, Area, ComposedChart, ReferenceLine
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const PALETTE = {
  primary: '#0d9488',
  primaryLight: '#99f6e4',
  primaryMuted: '#ccfbf1',
  secondary: '#6366f1',
  secondaryLight: '#c7d2fe',
  accent: '#f59e0b',
  accentLight: '#fef3c7',
  danger: '#ef4444',
  dangerLight: '#fee2e2',
  neutral: '#64748b',
  gridStroke: '#e2e8f0',
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
};
const SERIES_COLORS = ['#0d9488', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const QUADRANT_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  Smooth: { bg: '#dcfce7', text: '#166534', bar: '#86efac' },
  Intermittent: { bg: '#fef9c3', text: '#854d0e', bar: '#d4d4d4' },
  Lumpy: { bg: '#fce7f3', text: '#9d174d', bar: '#d4d4d4' },
  Erratic: { bg: '#dbeafe', text: '#1e40af', bar: '#93c5fd' },
};

interface ChartProps {
  data: {
    columns: string[];
    rows: any[];
    totalRows: number;
  };
  config: {
    xColumn?: string;
    yColumn?: string;
    groupColumn?: string;
    valueColumn?: string;
    dateColumn?: string;
    demandColumn?: string;
    idColumn?: string;
    forecastColumn?: string;
    actualColumn?: string;
    adiThreshold?: number;
    cvThreshold?: number;
  };
}

export function TimeSeriesChart({ data, config }: ChartProps) {
  const { dateColumn, valueColumn } = config;

  const chartData = useMemo(() => {
    if (!dateColumn || !valueColumn || !data.rows.length) return [];

    const grouped = data.rows.reduce((acc: any, row) => {
      const date = row[dateColumn];
      if (!acc[date]) acc[date] = { date, values: [] };
      acc[date].values.push(parseFloat(row[valueColumn]) || 0);
      return acc;
    }, {});

    return Object.values(grouped)
      .map((g: any) => ({
        date: g.date,
        value: g.values.reduce((a: number, b: number) => a + b, 0)
      }))
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 100);
  }, [data.rows, dateColumn, valueColumn]);

  if (!dateColumn || !valueColumn) {
    return <div className="text-sm text-muted-foreground p-4">Select date and value columns</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.gridStroke} />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Area type="monotone" dataKey="value" stroke={PALETTE.primary} fill={PALETTE.primary} fillOpacity={0.2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HistogramChart({ data, config }: ChartProps) {
  const { valueColumn } = config;

  const chartData = useMemo(() => {
    if (!valueColumn || !data.rows.length) return [];

    const values = data.rows.map(r => parseFloat(r[valueColumn])).filter(v => !isNaN(v));
    if (values.length === 0) return [];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const binCount = Math.min(20, Math.ceil(Math.sqrt(values.length)));
    const binSize = range / binCount;

    const bins: { range: string; count: number }[] = [];
    for (let i = 0; i < binCount; i++) {
      const binMin = min + i * binSize;
      const binMax = min + (i + 1) * binSize;
      const count = values.filter(v => v >= binMin && (i === binCount - 1 ? v <= binMax : v < binMax)).length;
      bins.push({
        range: `${binMin.toFixed(0)}-${binMax.toFixed(0)}`,
        count
      });
    }
    return bins;
  }, [data.rows, valueColumn]);

  if (!valueColumn) {
    return <div className="text-sm text-muted-foreground p-4">Select a value column</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.gridStroke} />
        <XAxis dataKey="range" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Bar dataKey="count" fill={PALETTE.secondary} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BoxPlotChart({ data, config }: ChartProps) {
  const { groupColumn, valueColumn } = config;

  const stats = useMemo(() => {
    if (!groupColumn || !valueColumn || !data.rows.length) return [];

    const grouped: Record<string, number[]> = {};
    data.rows.forEach(row => {
      const group = String(row[groupColumn]);
      const value = parseFloat(row[valueColumn]);
      if (!isNaN(value)) {
        if (!grouped[group]) grouped[group] = [];
        grouped[group].push(value);
      }
    });

    return Object.entries(grouped).slice(0, 15).map(([name, values]) => {
      const sorted = values.sort((a, b) => a - b);
      const n = sorted.length;
      const q1 = sorted[Math.floor(n * 0.25)] || 0;
      const median = sorted[Math.floor(n * 0.5)] || 0;
      const q3 = sorted[Math.floor(n * 0.75)] || 0;
      const min = sorted[0] || 0;
      const max = sorted[n - 1] || 0;
      const mean = values.reduce((a, b) => a + b, 0) / n;

      return { name, min, q1, median, q3, max, mean, count: n };
    });
  }, [data.rows, groupColumn, valueColumn]);

  if (!groupColumn || !valueColumn) {
    return <div className="text-sm text-muted-foreground p-4">Select group and value columns</div>;
  }

  if (stats.length === 0) {
    return <div className="text-sm text-muted-foreground p-4">No data available</div>;
  }

  const globalMin = Math.min(...stats.map(s => s.min));
  const globalMax = Math.max(...stats.map(s => s.max));
  const range = globalMax - globalMin || 1;

  const rowHeight = 40;
  const padding = { left: 100, right: 40, top: 10, bottom: 30 };
  const chartWidth = 340;
  const plotWidth = chartWidth - padding.left - padding.right;
  const totalHeight = stats.length * rowHeight + padding.top + padding.bottom;

  const scale = (val: number) => padding.left + ((val - globalMin) / range) * plotWidth;

  return (
    <div className="space-y-2">
      <svg width="100%" viewBox={`0 0 ${chartWidth} ${totalHeight}`} className="text-xs">
        <line x1={padding.left} y1={totalHeight - padding.bottom} x2={chartWidth - padding.right} y2={totalHeight - padding.bottom} stroke={PALETTE.gridStroke} strokeWidth="1" />

        {Array.from({ length: 5 }, (_, i) => {
          const val = globalMin + (range * i) / 4;
          const x = scale(val);
          return (
            <g key={i}>
              <line x1={x} y1={totalHeight - padding.bottom} x2={x} y2={totalHeight - padding.bottom + 4} stroke="#94a3b8" strokeWidth="1" />
              <text x={x} y={totalHeight - padding.bottom + 16} textAnchor="middle" fill={PALETTE.textSecondary} fontSize="9">{val.toFixed(0)}</text>
              <line x1={x} y1={padding.top} x2={x} y2={totalHeight - padding.bottom} stroke="#f1f5f9" strokeWidth="1" />
            </g>
          );
        })}

        {stats.map((s, i) => {
          const y = padding.top + i * rowHeight + rowHeight / 2;
          const boxHeight = 18;

          return (
            <g key={i}>
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fill={PALETTE.textPrimary} fontSize="10" fontWeight="500">
                {s.name.length > 12 ? s.name.slice(0, 12) + '\u2026' : s.name}
              </text>

              <line x1={scale(s.min)} y1={y} x2={scale(s.max)} y2={y} stroke={PALETTE.neutral} strokeWidth="1" />
              <line x1={scale(s.min)} y1={y - 6} x2={scale(s.min)} y2={y + 6} stroke={PALETTE.neutral} strokeWidth="1" />
              <line x1={scale(s.max)} y1={y - 6} x2={scale(s.max)} y2={y + 6} stroke={PALETTE.neutral} strokeWidth="1" />

              <rect
                x={scale(s.q1)}
                y={y - boxHeight / 2}
                width={Math.max(scale(s.q3) - scale(s.q1), 2)}
                height={boxHeight}
                fill={PALETTE.primary}
                fillOpacity={0.3}
                stroke={PALETTE.primary}
                strokeWidth="1.5"
                rx="2"
              />

              <line x1={scale(s.median)} y1={y - boxHeight / 2} x2={scale(s.median)} y2={y + boxHeight / 2} stroke={PALETTE.danger} strokeWidth="2" />
              <circle cx={scale(s.mean)} cy={y} r="2.5" fill={PALETTE.accent} stroke={PALETTE.accent} />
            </g>
          );
        })}
      </svg>

      <div className="flex items-center gap-4 text-[10px] text-muted-foreground px-2">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ background: `${PALETTE.primary}4D`, border: `1px solid ${PALETTE.primary}` }} />
          <span>IQR (Q1-Q3)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5" style={{ background: PALETTE.danger }} />
          <span>Median</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ background: PALETTE.accent }} />
          <span>Mean</span>
        </div>
      </div>
    </div>
  );
}

export function BarChartComponent({ data, config }: ChartProps) {
  const { groupColumn, valueColumn } = config;

  const chartData = useMemo(() => {
    if (!groupColumn || !valueColumn || !data.rows.length) return [];

    const grouped: Record<string, number> = {};
    data.rows.forEach(row => {
      const group = String(row[groupColumn]);
      const value = parseFloat(row[valueColumn]) || 0;
      grouped[group] = (grouped[group] || 0) + value;
    });

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);
  }, [data.rows, groupColumn, valueColumn]);

  if (!groupColumn || !valueColumn) {
    return <div className="text-sm text-muted-foreground p-4">Select group and value columns</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.gridStroke} />
        <XAxis type="number" tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
        <Tooltip />
        <Bar dataKey="value" fill={SERIES_COLORS[0]}>
          {chartData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ScatterPlotChart({ data, config }: ChartProps) {
  const { xColumn, yColumn } = config;

  const chartData = useMemo(() => {
    if (!xColumn || !yColumn || !data.rows.length) return [];

    return data.rows
      .map(row => ({
        x: parseFloat(row[xColumn]),
        y: parseFloat(row[yColumn])
      }))
      .filter(d => !isNaN(d.x) && !isNaN(d.y))
      .slice(0, 500);
  }, [data.rows, xColumn, yColumn]);

  if (!xColumn || !yColumn) {
    return <div className="text-sm text-muted-foreground p-4">Select X and Y columns</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart>
        <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.gridStroke} />
        <XAxis type="number" dataKey="x" name={xColumn} tick={{ fontSize: 10 }} />
        <YAxis type="number" dataKey="y" name={yColumn} tick={{ fontSize: 10 }} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
        <Scatter data={chartData} fill={PALETTE.primary} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function ADICVChart({ data, config }: ChartProps) {
  const { idColumn, dateColumn, demandColumn, forecastColumn } = config;

  const [adiThreshold, setAdiThreshold] = useState(config.adiThreshold ?? 1.32);
  const [cvThreshold, setCvThreshold] = useState(config.cvThreshold ?? 0.49);

  const analysisData = useMemo(() => {
    if (!idColumn || !dateColumn || !demandColumn || !data.rows.length) return [];

    const grouped: Record<string, { dates: string[]; demands: number[]; forecasts: number[] }> = {};
    data.rows.forEach(row => {
      const id = String(row[idColumn]);
      if (!grouped[id]) grouped[id] = { dates: [], demands: [], forecasts: [] };
      grouped[id].dates.push(String(row[dateColumn] || ''));
      grouped[id].demands.push(parseFloat(row[demandColumn]) || 0);
      if (forecastColumn && forecastColumn !== '__none__' && row[forecastColumn] !== undefined) {
        grouped[id].forecasts.push(parseFloat(row[forecastColumn]) || 0);
      }
    });

    return Object.entries(grouped).map(([id, { dates, demands, forecasts }]) => {
      const indices = dates.map((_, i) => i).sort((a, b) => dates[a].localeCompare(dates[b]));
      const sortedDemands = indices.map(i => demands[i]);
      const sortedForecasts = indices.map(i => forecasts[i] ?? 0);

      const nonZeroDemands = sortedDemands.filter(d => d > 0);
      const totalPeriods = sortedDemands.length;
      const nonZeroCount = nonZeroDemands.length;

      const adi = nonZeroCount > 0 ? totalPeriods / nonZeroCount : totalPeriods;

      const mean = nonZeroCount > 0
        ? nonZeroDemands.reduce((a, b) => a + b, 0) / nonZeroCount
        : 0;
      const variance = nonZeroCount > 1
        ? nonZeroDemands.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / nonZeroCount
        : 0;
      const cv2 = mean > 0 ? variance / (mean * mean) : 0;

      const volume = sortedDemands.reduce((a, b) => a + b, 0);

      let mape: number | null = null;
      if (forecastColumn && forecastColumn !== '__none__' && sortedForecasts.length === sortedDemands.length) {
        const mapeValues: number[] = [];
        for (let i = 0; i < sortedDemands.length; i++) {
          const actual = sortedDemands[i];
          const forecast = sortedForecasts[i];
          if (actual !== 0) {
            mapeValues.push(Math.abs(actual - forecast) / Math.abs(actual));
          }
        }
        if (mapeValues.length > 0) {
          mape = (mapeValues.reduce((a, b) => a + b, 0) / mapeValues.length) * 100;
        }
      }

      return { id, adi, cv2, volume, mape, demands: sortedDemands };
    });
  }, [data.rows, idColumn, dateColumn, demandColumn, forecastColumn]);

  const classifiedData = useMemo(() => {
    return analysisData.map(item => {
      let classification = 'Smooth';
      if (item.adi >= adiThreshold && item.cv2 >= cvThreshold) classification = 'Lumpy';
      else if (item.adi >= adiThreshold) classification = 'Intermittent';
      else if (item.cv2 >= cvThreshold) classification = 'Erratic';
      return { ...item, classification };
    });
  }, [analysisData, adiThreshold, cvThreshold]);

  const quadrantAggregates = useMemo(() => {
    const totalItems = classifiedData.length;
    const totalVolume = classifiedData.reduce((a, b) => a + b.volume, 0);

    const quads: Record<string, { count: number; volume: number; mapes: number[]; representative: number[] }> = {
      Smooth: { count: 0, volume: 0, mapes: [], representative: [] },
      Intermittent: { count: 0, volume: 0, mapes: [], representative: [] },
      Erratic: { count: 0, volume: 0, mapes: [], representative: [] },
      Lumpy: { count: 0, volume: 0, mapes: [], representative: [] },
    };

    classifiedData.forEach(item => {
      const q = quads[item.classification];
      q.count++;
      q.volume += item.volume;
      if (item.mape !== null) q.mapes.push(item.mape);
      if (q.representative.length === 0) q.representative = item.demands.slice(0, 12);
    });

    const result: Record<string, { pctDFUs: number; pctVolume: number; avgMape: number | null; representative: number[] }> = {};
    for (const [key, val] of Object.entries(quads)) {
      result[key] = {
        pctDFUs: totalItems > 0 ? (val.count / totalItems) * 100 : 0,
        pctVolume: totalVolume > 0 ? (val.volume / totalVolume) * 100 : 0,
        avgMape: val.mapes.length > 0 ? val.mapes.reduce((a, b) => a + b, 0) / val.mapes.length : null,
        representative: val.representative,
      };
    }
    return result;
  }, [classifiedData]);

  const scatterDisplayData = useMemo(() => {
    if (classifiedData.length <= 500) return classifiedData;
    const step = Math.ceil(classifiedData.length / 500);
    return classifiedData.filter((_, i) => i % step === 0);
  }, [classifiedData]);

  if (!idColumn || !dateColumn || !demandColumn) {
    return <div className="text-sm text-muted-foreground p-4">Select ID, Date, and Demand columns for ADI/CV² analysis</div>;
  }

  const scatterColors: Record<string, string> = {
    Smooth: QUADRANT_COLORS.Smooth.text,
    Intermittent: QUADRANT_COLORS.Intermittent.text,
    Erratic: QUADRANT_COLORS.Erratic.text,
    Lumpy: QUADRANT_COLORS.Lumpy.text,
  };

  const quadrantOrder: [string, string][] = [
    ['Intermittent', 'Lumpy'],
    ['Smooth', 'Erratic'],
  ];

  const maxBarVal = (arr: number[]) => {
    const m = Math.max(...arr, 1);
    return m;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg border">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-700">ADI Threshold</label>
            <span className="text-xs font-mono font-semibold" style={{ color: PALETTE.primary }}>{adiThreshold.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="1.0"
            max="5.0"
            step="0.01"
            value={adiThreshold}
            onChange={(e) => setAdiThreshold(parseFloat(e.target.value))}
            className="w-full h-1.5 accent-teal-600"
            data-testid="slider-adi-threshold"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>1.0</span>
            <span>5.0</span>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-700">CV² Threshold</label>
            <span className="text-xs font-mono font-semibold" style={{ color: PALETTE.primary }}>{cvThreshold.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="2.0"
            step="0.01"
            value={cvThreshold}
            onChange={(e) => setCvThreshold(parseFloat(e.target.value))}
            className="w-full h-1.5 accent-teal-600"
            data-testid="slider-cv-threshold"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>0.1</span>
            <span>2.0</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {quadrantOrder.map((row, ri) =>
          row.map((quadrant) => {
            const qc = QUADRANT_COLORS[quadrant];
            const agg = quadrantAggregates[quadrant];
            const bars = agg?.representative || [];
            const mv = maxBarVal(bars);
            return (
              <div
                key={quadrant}
                className="relative rounded-lg p-4 overflow-hidden border"
                style={{ backgroundColor: qc.bg, borderColor: `${qc.text}33` }}
                data-testid={`quadrant-card-${quadrant.toLowerCase()}`}
              >
                <div className="absolute inset-x-0 bottom-0 h-16 flex items-end justify-around px-2 pb-1 opacity-30">
                  {bars.map((v, bi) => (
                    <div
                      key={bi}
                      style={{
                        width: `${Math.max(100 / Math.max(bars.length, 1) - 2, 3)}%`,
                        height: `${mv > 0 ? (v / mv) * 100 : 0}%`,
                        backgroundColor: qc.bar,
                        minHeight: '1px',
                      }}
                      className="rounded-t-sm"
                    />
                  ))}
                </div>

                <div className="relative z-10">
                  <h4 className="text-sm font-bold mb-2" style={{ color: qc.text }}>{quadrant}</h4>
                  <p className="text-lg font-bold" style={{ color: qc.text }}>{agg ? agg.pctDFUs.toFixed(1) : '0.0'}% of DFUs</p>
                  <p className="text-sm font-semibold" style={{ color: qc.text }}>{agg ? agg.pctVolume.toFixed(1) : '0.0'}% of volume</p>
                  {agg && agg.avgMape !== null && (
                    <p className="text-xs font-medium mt-1" style={{ color: agg.avgMape <= 30 ? '#16a34a' : '#dc2626' }}>
                      Avg MAPE: {agg.avgMape.toFixed(1)}%
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.gridStroke} />
          <XAxis
            type="number"
            dataKey="adi"
            name="ADI"
            domain={[0, 'auto']}
            tick={{ fontSize: 10 }}
            label={{ value: 'ADI (Avg Demand Interval)', position: 'bottom', offset: 15, fontSize: 10 }}
          />
          <YAxis
            type="number"
            dataKey="cv2"
            name="CV²"
            domain={[0, 'auto']}
            tick={{ fontSize: 10 }}
            label={{ value: 'CV² (Squared Coeff of Variation)', angle: -90, position: 'insideLeft', offset: 0, fontSize: 10 }}
          />
          <ReferenceLine x={adiThreshold} stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={1.5} label={{ value: `ADI=${adiThreshold.toFixed(2)}`, position: 'top', fontSize: 9, fill: PALETTE.textSecondary }} />
          <ReferenceLine y={cvThreshold} stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={1.5} label={{ value: `CV²=${cvThreshold.toFixed(2)}`, position: 'right', fontSize: 9, fill: PALETTE.textSecondary }} />
          <Tooltip
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-white p-2 border rounded shadow text-xs">
                  <p className="font-semibold">{d.id}</p>
                  <p>ADI: {d.adi.toFixed(2)}</p>
                  <p>CV²: {d.cv2.toFixed(2)}</p>
                  <p>Volume: {d.volume.toLocaleString()}</p>
                  <p className="font-medium" style={{ color: scatterColors[d.classification] }}>{d.classification}</p>
                </div>
              );
            }}
          />
          <Scatter name="Items" data={scatterDisplayData} shape="circle">
            {scatterDisplayData.map((entry, index) => (
              <Cell key={index} fill={scatterColors[entry.classification]} fillOpacity={0.7} />
            ))}
          </Scatter>
          <Legend
            content={() => (
              <div className="flex gap-3 justify-center mt-2 text-[10px]">
                {Object.entries(scatterColors).map(([cls, color]) => {
                  const count = classifiedData.filter(d => d.classification === cls).length;
                  return (
                    <div key={cls} className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span>{cls} ({count})</span>
                    </div>
                  );
                })}
              </div>
            )}
          />
        </ScatterChart>
      </ResponsiveContainer>

      <div className="flex items-center justify-center gap-2">
        <Badge variant="outline" className="text-xs" style={{ borderColor: PALETTE.primary, color: PALETTE.primary }}>
          Total DFUs Analyzed: {classifiedData.length}
        </Badge>
      </div>
    </div>
  );
}

export function ParetoChart({ data, config }: ChartProps) {
  const { groupColumn, valueColumn } = config;

  const chartData = useMemo(() => {
    if (!groupColumn || !valueColumn || !data.rows.length) return [];

    const grouped: Record<string, number> = {};
    data.rows.forEach(row => {
      const group = String(row[groupColumn]);
      const value = parseFloat(row[valueColumn]) || 0;
      grouped[group] = (grouped[group] || 0) + value;
    });

    const sorted = Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);

    const total = sorted.reduce((a, b) => a + b.value, 0);
    let cumulative = 0;

    return sorted.map(item => {
      cumulative += item.value;
      return {
        ...item,
        cumulative: total > 0 ? (cumulative / total) * 100 : 0
      };
    });
  }, [data.rows, groupColumn, valueColumn]);

  if (!groupColumn || !valueColumn) {
    return <div className="text-sm text-muted-foreground p-4">Select group and value columns</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.gridStroke} />
        <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={70} />
        <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
        <Tooltip />
        <Legend />
        <Bar yAxisId="left" dataKey="value" fill={PALETTE.primary} name="Value" />
        <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke={PALETTE.danger} name="Cumulative %" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function DataTableChart({ data, config }: ChartProps) {
  const displayRows = data.rows.slice(0, 100);
  const displayCols = data.columns.slice(0, 10);

  return (
    <div className="max-h-[400px] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {displayCols.map(col => (
              <TableHead key={col} className="text-xs">{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayRows.map((row, i) => (
            <TableRow key={i}>
              {displayCols.map(col => (
                <TableCell key={col} className="text-xs">{String(row[col] ?? '')}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {data.rows.length > 100 && (
        <p className="text-xs text-muted-foreground p-2">Showing first 100 of {data.totalRows.toLocaleString()} rows</p>
      )}
    </div>
  );
}

export function SummaryStatsChart({ data, config }: ChartProps) {
  const stats = useMemo(() => {
    return data.columns.map(col => {
      const values = data.rows.map(r => r[col]);
      const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
      const isNumeric = numericValues.length > values.length * 0.5;

      let result: any = {
        column: col,
        type: isNumeric ? 'Numeric' : 'Categorical',
        filled: values.filter(v => v !== null && v !== undefined && v !== '').length,
        missing: values.filter(v => v === null || v === undefined || v === '').length
      };

      if (isNumeric && numericValues.length > 0) {
        const sum = numericValues.reduce((a, b) => a + b, 0);
        result.mean = (sum / numericValues.length).toFixed(2);
        result.min = Math.min(...numericValues).toFixed(2);
        result.max = Math.max(...numericValues).toFixed(2);
        const variance = numericValues.reduce((acc, val) => acc + Math.pow(val - sum/numericValues.length, 2), 0) / numericValues.length;
        result.std = Math.sqrt(variance).toFixed(2);
      } else {
        const unique = new Set(values.filter(v => v !== null && v !== undefined && v !== ''));
        result.unique = unique.size;
        result.topValue = Array.from(unique)[0] || '-';
      }

      return result;
    });
  }, [data.columns, data.rows]);

  return (
    <div className="max-h-[400px] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Column</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Filled</TableHead>
            <TableHead>Missing</TableHead>
            <TableHead>Mean/Unique</TableHead>
            <TableHead>Min/Top</TableHead>
            <TableHead>Max</TableHead>
            <TableHead>Std</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stats.map((s, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium text-xs">{s.column}</TableCell>
              <TableCell><Badge variant="outline" className="text-[10px]">{s.type}</Badge></TableCell>
              <TableCell className="text-xs">{s.filled}</TableCell>
              <TableCell className="text-xs">{s.missing}</TableCell>
              <TableCell className="text-xs">{s.mean || s.unique}</TableCell>
              <TableCell className="text-xs">{s.min || String(s.topValue).slice(0, 20)}</TableCell>
              <TableCell className="text-xs">{s.max || '-'}</TableCell>
              <TableCell className="text-xs">{s.std || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function CompletenessChart({ data, config }: ChartProps) {
  const chartData = useMemo(() => {
    return data.columns.map(col => {
      const values = data.rows.map(r => r[col]);
      const filled = values.filter(v => v !== null && v !== undefined && v !== '' && v !== 'null').length;
      const completeness = data.rows.length > 0 ? (filled / data.rows.length) * 100 : 0;
      return { column: col, completeness: parseFloat(completeness.toFixed(1)) };
    });
  }, [data.columns, data.rows]);

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.columns.length * 25)}>
      <BarChart data={chartData} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.gridStroke} />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
        <YAxis type="category" dataKey="column" tick={{ fontSize: 10 }} width={100} />
        <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
        <Bar dataKey="completeness" fill="#22c55e">
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry.completeness >= 95 ? '#22c55e' : entry.completeness >= 80 ? PALETTE.accent : PALETTE.danger} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function OutlierTableChart({ data, config }: ChartProps) {
  const outliers = useMemo(() => {
    const results: any[] = [];

    data.columns.forEach(col => {
      const values = data.rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
      if (values.length < 10) return;

      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
      const std = Math.sqrt(variance);

      if (std === 0) return;

      data.rows.forEach((row, idx) => {
        const val = parseFloat(row[col]);
        if (isNaN(val)) return;

        const zScore = (val - mean) / std;
        if (Math.abs(zScore) > 3) {
          results.push({
            row: idx + 1,
            column: col,
            value: val.toFixed(2),
            mean: mean.toFixed(2),
            zScore: zScore.toFixed(2)
          });
        }
      });
    });

    return results.slice(0, 50);
  }, [data.columns, data.rows]);

  if (outliers.length === 0) {
    return <div className="text-sm text-muted-foreground p-4">No statistical outliers detected (|z-score| &gt; 3)</div>;
  }

  return (
    <div className="max-h-[300px] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Row</TableHead>
            <TableHead>Column</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Mean</TableHead>
            <TableHead>Z-Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {outliers.map((o, i) => (
            <TableRow key={i}>
              <TableCell className="text-xs">{o.row}</TableCell>
              <TableCell className="text-xs font-medium">{o.column}</TableCell>
              <TableCell className="text-xs font-semibold" style={{ color: PALETTE.danger }}>{o.value}</TableCell>
              <TableCell className="text-xs">{o.mean}</TableCell>
              <TableCell className="text-xs">{o.zScore}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function SeasonalPlotChart({ data, config }: ChartProps) {
  const { dateColumn, valueColumn } = config;

  const chartData = useMemo(() => {
    if (!dateColumn || !valueColumn || !data.rows.length) return [];

    const byMonth: Record<string, number[]> = {};

    data.rows.forEach(row => {
      const date = new Date(row[dateColumn]);
      if (isNaN(date.getTime())) return;
      const month = date.toLocaleString('default', { month: 'short' });
      const value = parseFloat(row[valueColumn]) || 0;
      if (!byMonth[month]) byMonth[month] = [];
      byMonth[month].push(value);
    });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map(month => ({
      month,
      avg: byMonth[month] ? byMonth[month].reduce((a, b) => a + b, 0) / byMonth[month].length : 0,
      count: byMonth[month]?.length || 0
    })).filter(d => d.count > 0);
  }, [data.rows, dateColumn, valueColumn]);

  if (!dateColumn || !valueColumn) {
    return <div className="text-sm text-muted-foreground p-4">Select date and value columns</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.gridStroke} />
        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Bar dataKey="avg" fill={PALETTE.secondary} name="Average Value" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export const CHART_TYPES = [
  { value: 'timeseries', label: 'Time Series', description: 'Trend analysis over time' },
  { value: 'histogram', label: 'Histogram', description: 'Value distribution' },
  { value: 'boxplot', label: 'Boxplot', description: 'Spread & outliers by group' },
  { value: 'bar', label: 'Bar Chart', description: 'Categorical comparison' },
  { value: 'scatter', label: 'Scatter Plot', description: 'Correlation analysis' },
  { value: 'adicv', label: 'Demand Classification', description: 'ADI × CV² demand pattern map' },
  { value: 'pareto', label: 'Pareto Analysis', description: '80/20 concentration' },
  { value: 'table', label: 'Data Table', description: 'Raw data view' },
  { value: 'summary', label: 'Summary Statistics', description: 'Descriptive stats per column' },
  { value: 'seasonal', label: 'Seasonality', description: 'Monthly demand patterns' },
  { value: 'completeness', label: 'Data Quality', description: 'Missing value analysis' },
  { value: 'outliers', label: 'Outlier Detection', description: 'Z-score anomaly scan' }
];

export function renderChart(chartType: string, data: ChartProps['data'], config: ChartProps['config']) {
  switch (chartType) {
    case 'timeseries': return <TimeSeriesChart data={data} config={config} />;
    case 'histogram': return <HistogramChart data={data} config={config} />;
    case 'boxplot': return <BoxPlotChart data={data} config={config} />;
    case 'bar': return <BarChartComponent data={data} config={config} />;
    case 'scatter': return <ScatterPlotChart data={data} config={config} />;
    case 'adicv': return <ADICVChart data={data} config={config} />;
    case 'pareto': return <ParetoChart data={data} config={config} />;
    case 'table': return <DataTableChart data={data} config={config} />;
    case 'summary': return <SummaryStatsChart data={data} config={config} />;
    case 'seasonal': return <SeasonalPlotChart data={data} config={config} />;
    case 'completeness': return <CompletenessChart data={data} config={config} />;
    case 'outliers': return <OutlierTableChart data={data} config={config} />;
    default: return <div className="text-muted-foreground p-4">Select a chart type</div>;
  }
}
