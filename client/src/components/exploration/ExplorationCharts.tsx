import { useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell, PieChart, Pie, AreaChart, Area
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
  };
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

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
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
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
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="range" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Bar dataKey="count" fill="#8b5cf6" />
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
      
      return { name, min, q1, median, q3, max, mean: mean.toFixed(1), count: n };
    });
  }, [data.rows, groupColumn, valueColumn]);

  if (!groupColumn || !valueColumn) {
    return <div className="text-sm text-muted-foreground p-4">Select group and value columns</div>;
  }

  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Group</TableHead>
            <TableHead>Min</TableHead>
            <TableHead>Q1</TableHead>
            <TableHead>Median</TableHead>
            <TableHead>Q3</TableHead>
            <TableHead>Max</TableHead>
            <TableHead>Mean</TableHead>
            <TableHead>N</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stats.map((s, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell>{s.min.toFixed(1)}</TableCell>
              <TableCell>{s.q1.toFixed(1)}</TableCell>
              <TableCell className="font-semibold">{s.median.toFixed(1)}</TableCell>
              <TableCell>{s.q3.toFixed(1)}</TableCell>
              <TableCell>{s.max.toFixed(1)}</TableCell>
              <TableCell>{s.mean}</TableCell>
              <TableCell>{s.count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
        <Tooltip />
        <Bar dataKey="value" fill="#22c55e">
          {chartData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" dataKey="x" name={xColumn} tick={{ fontSize: 10 }} />
        <YAxis type="number" dataKey="y" name={yColumn} tick={{ fontSize: 10 }} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
        <Scatter data={chartData} fill="#f59e0b" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function ADICVChart({ data, config }: ChartProps) {
  const { idColumn, dateColumn, demandColumn } = config;
  
  const analysisData = useMemo(() => {
    if (!idColumn || !dateColumn || !demandColumn || !data.rows.length) return [];
    
    const grouped: Record<string, { dates: string[]; demands: number[] }> = {};
    data.rows.forEach(row => {
      const id = String(row[idColumn]);
      if (!grouped[id]) grouped[id] = { dates: [], demands: [] };
      grouped[id].dates.push(row[dateColumn]);
      grouped[id].demands.push(parseFloat(row[demandColumn]) || 0);
    });
    
    return Object.entries(grouped).map(([id, { demands }]) => {
      const nonZeroDemands = demands.filter(d => d > 0);
      const zeroCount = demands.length - nonZeroDemands.length;
      
      const adi = demands.length > 0 ? demands.length / Math.max(1, nonZeroDemands.length) : 0;
      
      const mean = nonZeroDemands.length > 0 
        ? nonZeroDemands.reduce((a, b) => a + b, 0) / nonZeroDemands.length 
        : 0;
      const variance = nonZeroDemands.length > 1
        ? nonZeroDemands.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / nonZeroDemands.length
        : 0;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
      
      let classification = 'Smooth';
      if (adi >= 1.32 && cv >= 0.49) classification = 'Lumpy';
      else if (adi >= 1.32) classification = 'Intermittent';
      else if (cv >= 0.49) classification = 'Erratic';
      
      return { id, adi: Math.min(adi, 10), cv: Math.min(cv, 3), classification, mean: mean.toFixed(1), zeroCount };
    }).slice(0, 200);
  }, [data.rows, idColumn, dateColumn, demandColumn]);

  const classificationColors: Record<string, string> = {
    'Smooth': '#22c55e',
    'Erratic': '#f59e0b',
    'Intermittent': '#3b82f6',
    'Lumpy': '#ef4444'
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { Smooth: 0, Erratic: 0, Intermittent: 0, Lumpy: 0 };
    analysisData.forEach(d => c[d.classification]++);
    return c;
  }, [analysisData]);

  if (!idColumn || !dateColumn || !demandColumn) {
    return <div className="text-sm text-muted-foreground p-4">Select ID, Date, and Demand columns for ADI/CV analysis</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {Object.entries(counts).map(([cls, count]) => (
          <Badge key={cls} variant="outline" style={{ borderColor: classificationColors[cls], color: classificationColors[cls] }}>
            {cls}: {count} ({((count / analysisData.length) * 100).toFixed(0)}%)
          </Badge>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            type="number" 
            dataKey="adi" 
            name="ADI" 
            domain={[0, 'auto']}
            tick={{ fontSize: 10 }}
            label={{ value: 'ADI (Avg Demand Interval)', position: 'bottom', fontSize: 10 }}
          />
          <YAxis 
            type="number" 
            dataKey="cv" 
            name="CV" 
            domain={[0, 'auto']}
            tick={{ fontSize: 10 }}
            label={{ value: 'CV (Coeff of Variation)', angle: -90, position: 'left', fontSize: 10 }}
          />
          <Tooltip 
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-white p-2 border rounded shadow text-xs">
                  <p className="font-semibold">{d.id}</p>
                  <p>ADI: {d.adi.toFixed(2)}</p>
                  <p>CV: {d.cv.toFixed(2)}</p>
                  <p>Mean: {d.mean}</p>
                  <p className="font-medium" style={{ color: classificationColors[d.classification] }}>{d.classification}</p>
                </div>
              );
            }}
          />
          {['Smooth', 'Erratic', 'Intermittent', 'Lumpy'].map(cls => (
            <Scatter
              key={cls}
              name={cls}
              data={analysisData.filter(d => d.classification === cls)}
              fill={classificationColors[cls]}
            />
          ))}
          <Legend />
        </ScatterChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div className="p-2 bg-green-50 rounded">Smooth: Low ADI (&lt;1.32), Low CV (&lt;0.49)</div>
        <div className="p-2 bg-amber-50 rounded">Erratic: Low ADI (&lt;1.32), High CV (&ge;0.49)</div>
        <div className="p-2 bg-blue-50 rounded">Intermittent: High ADI (&ge;1.32), Low CV (&lt;0.49)</div>
        <div className="p-2 bg-red-50 rounded">Lumpy: High ADI (&ge;1.32), High CV (&ge;0.49)</div>
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
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={70} />
        <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
        <Tooltip />
        <Legend />
        <Bar yAxisId="left" dataKey="value" fill="#3b82f6" name="Value" />
        <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#ef4444" name="Cumulative %" dot={false} />
      </BarChart>
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
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
        <YAxis type="category" dataKey="column" tick={{ fontSize: 10 }} width={100} />
        <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
        <Bar dataKey="completeness" fill="#22c55e">
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry.completeness >= 95 ? '#22c55e' : entry.completeness >= 80 ? '#f59e0b' : '#ef4444'} />
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
              <TableCell className="text-xs font-semibold text-red-600">{o.value}</TableCell>
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
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Bar dataKey="avg" fill="#06b6d4" name="Average Value" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export const CHART_TYPES = [
  { value: 'timeseries', label: 'Time Series', description: 'Trend over time' },
  { value: 'histogram', label: 'Histogram', description: 'Distribution of values' },
  { value: 'boxplot', label: 'Box Plot Stats', description: 'Distribution by group' },
  { value: 'bar', label: 'Bar Chart', description: 'Values by category' },
  { value: 'scatter', label: 'Scatter Plot', description: 'X vs Y correlation' },
  { value: 'adicv', label: 'ADI/CV Analysis', description: 'Demand pattern classification' },
  { value: 'pareto', label: 'Pareto Chart', description: '80/20 analysis' },
  { value: 'table', label: 'Data Table', description: 'View raw data' },
  { value: 'summary', label: 'Summary Stats', description: 'Column statistics' },
  { value: 'seasonal', label: 'Seasonal Plot', description: 'Monthly patterns' },
  { value: 'completeness', label: 'Completeness', description: 'Data quality check' },
  { value: 'outliers', label: 'Outlier Table', description: 'Anomaly detection' }
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
