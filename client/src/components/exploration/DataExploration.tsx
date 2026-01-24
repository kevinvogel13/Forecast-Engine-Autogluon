import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, TrendingUp } from 'lucide-react';

export type ChartType = 
  | 'timeseries' 
  | 'bar' 
  | 'histogram' 
  | 'scatter' 
  | 'table' 
  | 'summary' 
  | 'adi_cov';

export interface ExplorationConfig {
  chartType: ChartType;
  xColumn?: string;
  yColumn?: string;
  groupColumn?: string;
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  takeaway?: string;
}

interface DataExplorationProps {
  data: {
    columns: string[];
    rows: any[];
    totalRows: number;
  } | null;
  config: ExplorationConfig;
  onConfigChange: (config: ExplorationConfig) => void;
  loading?: boolean;
  compact?: boolean;
}

const CHART_TYPES = [
  { value: 'timeseries', label: 'Time Series Chart' },
  { value: 'bar', label: 'Bar Chart' },
  { value: 'histogram', label: 'Histogram' },
  { value: 'scatter', label: 'Scatter Plot' },
  { value: 'table', label: 'Data Table' },
  { value: 'summary', label: 'Summary Statistics' },
  { value: 'adi_cov', label: 'ADI/COV Analysis' },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function DataExploration({ 
  data, 
  config, 
  onConfigChange, 
  loading = false,
  compact = false 
}: DataExplorationProps) {
  const numericColumns = useMemo(() => {
    if (!data || data.rows.length === 0) return [];
    return data.columns.filter(col => {
      const sampleValues = data.rows.slice(0, 100).map(r => r[col]).filter(v => v !== null && v !== '');
      const numericCount = sampleValues.filter(v => !isNaN(Number(v))).length;
      return numericCount > sampleValues.length * 0.8;
    });
  }, [data]);

  const categoricalColumns = useMemo(() => {
    if (!data || data.rows.length === 0) return [];
    return data.columns.filter(col => !numericColumns.includes(col));
  }, [data, numericColumns]);

  const dateColumns = useMemo(() => {
    if (!data || data.rows.length === 0) return [];
    return data.columns.filter(col => {
      const sampleValues = data.rows.slice(0, 10).map(r => r[col]).filter(v => v);
      return sampleValues.some(v => {
        const str = String(v);
        return str.match(/^\d{4}-\d{2}-\d{2}/) || str.match(/^\d{2}\/\d{2}\/\d{4}/);
      });
    });
  }, [data]);

  const renderChart = () => {
    if (!data || data.rows.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <AlertCircle className="w-5 h-5 mr-2" />
          No data available
        </div>
      );
    }

    switch (config.chartType) {
      case 'timeseries':
        return <TimeSeriesChart data={data} config={config} />;
      case 'bar':
        return <BarChartComponent data={data} config={config} />;
      case 'histogram':
        return <HistogramChart data={data} config={config} />;
      case 'scatter':
        return <ScatterChartComponent data={data} config={config} />;
      case 'table':
        return <DataTableComponent data={data} />;
      case 'summary':
        return <SummaryStatsComponent data={data} />;
      case 'adi_cov':
        return <AdiCovAnalysis data={data} config={config} />;
      default:
        return <div className="text-muted-foreground text-center py-8">Select a chart type</div>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading data...
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Chart Type</Label>
          <Select 
            value={config.chartType} 
            onValueChange={(val) => onConfigChange({ ...config, chartType: val as ChartType })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHART_TYPES.map(ct => (
                <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {['timeseries', 'bar', 'scatter'].includes(config.chartType) && (
          <div className="space-y-1.5">
            <Label className="text-xs">X Axis</Label>
            <Select 
              value={config.xColumn || ''} 
              onValueChange={(val) => onConfigChange({ ...config, xColumn: val })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select column" />
              </SelectTrigger>
              <SelectContent>
                {data?.columns.map(col => (
                  <SelectItem key={col} value={col}>{col}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {['timeseries', 'bar', 'scatter', 'histogram'].includes(config.chartType) && (
          <div className="space-y-1.5">
            <Label className="text-xs">Y Axis / Value</Label>
            <Select 
              value={config.yColumn || ''} 
              onValueChange={(val) => onConfigChange({ ...config, yColumn: val })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select column" />
              </SelectTrigger>
              <SelectContent>
                {numericColumns.map(col => (
                  <SelectItem key={col} value={col}>{col}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {['bar'].includes(config.chartType) && (
          <div className="space-y-1.5">
            <Label className="text-xs">Aggregation</Label>
            <Select 
              value={config.aggregation || 'sum'} 
              onValueChange={(val) => onConfigChange({ ...config, aggregation: val as any })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sum">Sum</SelectItem>
                <SelectItem value="avg">Average</SelectItem>
                <SelectItem value="count">Count</SelectItem>
                <SelectItem value="min">Min</SelectItem>
                <SelectItem value="max">Max</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {config.chartType === 'adi_cov' && (
          <div className="space-y-1.5">
            <Label className="text-xs">Group Column (e.g., DFU)</Label>
            <Select 
              value={config.groupColumn || ''} 
              onValueChange={(val) => onConfigChange({ ...config, groupColumn: val })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select column" />
              </SelectTrigger>
              <SelectContent>
                {data?.columns.map(col => (
                  <SelectItem key={col} value={col}>{col}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {config.chartType === 'adi_cov' && (
          <div className="space-y-1.5">
            <Label className="text-xs">Demand Column</Label>
            <Select 
              value={config.yColumn || ''} 
              onValueChange={(val) => onConfigChange({ ...config, yColumn: val })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select column" />
              </SelectTrigger>
              <SelectContent>
                {numericColumns.map(col => (
                  <SelectItem key={col} value={col}>{col}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="border rounded-lg p-3 bg-white min-h-[200px]">
        {renderChart()}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Takeaway / Insight</Label>
        <Textarea
          placeholder="Add your observations or insights about this visualization..."
          value={config.takeaway || ''}
          onChange={(e) => onConfigChange({ ...config, takeaway: e.target.value })}
          className="text-sm min-h-[60px] resize-none"
        />
      </div>
    </div>
  );
}

function TimeSeriesChart({ data, config }: { data: any; config: ExplorationConfig }) {
  if (!config.xColumn || !config.yColumn) {
    return <div className="text-center text-muted-foreground py-8">Select X and Y columns</div>;
  }

  const chartData = data.rows.slice(0, 500).map((row: any) => ({
    x: row[config.xColumn!],
    y: Number(row[config.yColumn!]) || 0
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="x" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Line type="monotone" dataKey="y" stroke="#3b82f6" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function BarChartComponent({ data, config }: { data: any; config: ExplorationConfig }) {
  if (!config.xColumn || !config.yColumn) {
    return <div className="text-center text-muted-foreground py-8">Select X and Y columns</div>;
  }

  const grouped = data.rows.reduce((acc: any, row: any) => {
    const key = row[config.xColumn!];
    if (!acc[key]) acc[key] = { values: [], count: 0 };
    acc[key].values.push(Number(row[config.yColumn!]) || 0);
    acc[key].count++;
    return acc;
  }, {});

  const chartData = Object.entries(grouped).slice(0, 20).map(([key, val]: [string, any]) => {
    let y: number;
    switch (config.aggregation) {
      case 'avg': y = val.values.reduce((a: number, b: number) => a + b, 0) / val.count; break;
      case 'count': y = val.count; break;
      case 'min': y = Math.min(...val.values); break;
      case 'max': y = Math.max(...val.values); break;
      default: y = val.values.reduce((a: number, b: number) => a + b, 0);
    }
    return { x: key, y };
  });

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="x" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Bar dataKey="y" fill="#3b82f6">
          {chartData.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function HistogramChart({ data, config }: { data: any; config: ExplorationConfig }) {
  if (!config.yColumn) {
    return <div className="text-center text-muted-foreground py-8">Select a value column</div>;
  }

  const values = data.rows.map((r: any) => Number(r[config.yColumn!])).filter((v: number) => !isNaN(v));
  if (values.length === 0) return <div className="text-center text-muted-foreground py-8">No numeric data</div>;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const binCount = 10;
  const binWidth = (max - min) / binCount || 1;

  const bins = Array(binCount).fill(0).map((_, i) => ({
    range: `${(min + i * binWidth).toFixed(1)}`,
    count: 0
  }));

  values.forEach((v: number) => {
    const binIndex = Math.min(Math.floor((v - min) / binWidth), binCount - 1);
    if (binIndex >= 0) bins[binIndex].count++;
  });

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={bins}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="range" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Bar dataKey="count" fill="#10b981" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ScatterChartComponent({ data, config }: { data: any; config: ExplorationConfig }) {
  if (!config.xColumn || !config.yColumn) {
    return <div className="text-center text-muted-foreground py-8">Select X and Y columns</div>;
  }

  const chartData = data.rows.slice(0, 500).map((row: any) => ({
    x: Number(row[config.xColumn!]) || 0,
    y: Number(row[config.yColumn!]) || 0
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ScatterChart>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="x" tick={{ fontSize: 10 }} name={config.xColumn} />
        <YAxis dataKey="y" tick={{ fontSize: 10 }} name={config.yColumn} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
        <Scatter data={chartData} fill="#8b5cf6" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function DataTableComponent({ data }: { data: any }) {
  const displayRows = data.rows.slice(0, 50);
  const displayCols = data.columns.slice(0, 8);

  return (
    <div className="max-h-[300px] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {displayCols.map((col: string) => (
              <TableHead key={col} className="text-xs font-medium">{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayRows.map((row: any, i: number) => (
            <TableRow key={i}>
              {displayCols.map((col: string) => (
                <TableCell key={col} className="text-xs py-1.5">{String(row[col] ?? '')}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {data.rows.length > 50 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Showing 50 of {data.totalRows.toLocaleString()} rows
        </p>
      )}
    </div>
  );
}

function SummaryStatsComponent({ data }: { data: any }) {
  const stats = data.columns.slice(0, 10).map((col: string) => {
    const values = data.rows.map((r: any) => r[col]).filter((v: any) => v !== null && v !== '');
    const numericValues = values.filter((v: any) => !isNaN(Number(v))).map(Number);
    const isNumeric = numericValues.length > values.length * 0.5;

    if (isNumeric && numericValues.length > 0) {
      const sum = numericValues.reduce((a: number, b: number) => a + b, 0);
      const mean = sum / numericValues.length;
      const sorted = [...numericValues].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      return {
        column: col,
        type: 'numeric',
        count: values.length,
        missing: data.rows.length - values.length,
        mean: mean.toFixed(2),
        median: median.toFixed(2),
        min: Math.min(...numericValues).toFixed(2),
        max: Math.max(...numericValues).toFixed(2)
      };
    } else {
      const unique = new Set(values);
      return {
        column: col,
        type: 'categorical',
        count: values.length,
        missing: data.rows.length - values.length,
        unique: unique.size
      };
    }
  });

  return (
    <div className="max-h-[300px] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Column</TableHead>
            <TableHead className="text-xs">Type</TableHead>
            <TableHead className="text-xs">Count</TableHead>
            <TableHead className="text-xs">Missing</TableHead>
            <TableHead className="text-xs">Mean/Unique</TableHead>
            <TableHead className="text-xs">Min/Max</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stats.map((s: any) => (
            <TableRow key={s.column}>
              <TableCell className="text-xs font-medium">{s.column}</TableCell>
              <TableCell className="text-xs">{s.type}</TableCell>
              <TableCell className="text-xs">{s.count}</TableCell>
              <TableCell className="text-xs">{s.missing}</TableCell>
              <TableCell className="text-xs">
                {s.type === 'numeric' ? s.mean : s.unique}
              </TableCell>
              <TableCell className="text-xs">
                {s.type === 'numeric' ? `${s.min} - ${s.max}` : '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AdiCovAnalysis({ data, config }: { data: any; config: ExplorationConfig }) {
  if (!config.groupColumn || !config.yColumn) {
    return <div className="text-center text-muted-foreground py-8">Select Group Column and Demand Column</div>;
  }

  const grouped: Record<string, number[]> = {};
  data.rows.forEach((row: any) => {
    const key = row[config.groupColumn!];
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(Number(row[config.yColumn!]) || 0);
  });

  const classifications = Object.entries(grouped).slice(0, 500).map(([key, values]) => {
    const nonZero = values.filter(v => v > 0);
    const adi = values.length / (nonZero.length || 1);
    const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (values.length || 1);
    const std = Math.sqrt(variance);
    const cov = mean > 0 ? std / mean : 0;

    let pattern: string;
    if (adi < 1.32 && cov < 0.49) pattern = 'Smooth';
    else if (adi < 1.32 && cov >= 0.49) pattern = 'Erratic';
    else if (adi >= 1.32 && cov < 0.49) pattern = 'Intermittent';
    else pattern = 'Lumpy';

    return { group: key, adi, cov, pattern };
  });

  const patternCounts = classifications.reduce((acc: Record<string, number>, c) => {
    acc[c.pattern] = (acc[c.pattern] || 0) + 1;
    return acc;
  }, {});

  const patternData = Object.entries(patternCounts).map(([pattern, count]) => ({ pattern, count }));
  const patternColors: Record<string, string> = {
    'Smooth': '#10b981',
    'Erratic': '#f59e0b', 
    'Intermittent': '#3b82f6',
    'Lumpy': '#ef4444'
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {['Smooth', 'Erratic', 'Intermittent', 'Lumpy'].map(pattern => (
          <div key={pattern} className="text-center p-2 rounded-lg bg-slate-50">
            <p className="text-lg font-bold" style={{ color: patternColors[pattern] }}>
              {patternCounts[pattern] || 0}
            </p>
            <p className="text-[10px] text-muted-foreground">{pattern}</p>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={patternData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="pattern" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="count">
            {patternData.map((entry, index) => (
              <Cell key={index} fill={patternColors[entry.pattern]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="text-xs text-muted-foreground">
        Analyzed {Object.keys(grouped).length} groups. ADI (Average Demand Interval) and COV (Coefficient of Variation) 
        classify demand patterns based on intermittency and variability.
      </p>
    </div>
  );
}

export { CHART_TYPES };
