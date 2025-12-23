import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useMemo } from 'react';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';

const COLORS = [
  'hsl(var(--chart-1))', 
  'hsl(var(--chart-2))', 
  'hsl(var(--chart-3))', 
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
  'hsl(var(--destructive))'
];

interface TimeSeriesViewProps {
  data?: {
    columns: string[];
    rows: any[];
    totalRows: number;
  };
}

function isNumeric(value: any): boolean {
  if (value === null || value === undefined || value === '') return false;
  return !isNaN(Number(value));
}

function isDateLike(value: any): boolean {
  if (value === null || value === undefined || value === '') return false;
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}/,
    /^\d{2}\/\d{2}\/\d{4}/,
    /^\d{2}-\d{2}-\d{4}/,
    /^\d{4}\/\d{2}\/\d{2}/,
  ];
  const strVal = String(value);
  return datePatterns.some(p => p.test(strVal)) || !isNaN(Date.parse(strVal));
}

export function TimeSeriesView({ data }: TimeSeriesViewProps) {
  const [measure, setMeasure] = useState<string>('');
  const [groupBy, setGroupBy] = useState<string>('None');
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);

  const analysis = useMemo(() => {
    if (!data || !data.rows.length || !data.columns.length) {
      return { numericColumns: [], categoricalColumns: [], dateColumn: null };
    }

    const numericColumns: string[] = [];
    const categoricalColumns: string[] = [];
    let dateColumn: string | null = null;

    data.columns.forEach(col => {
      let numericCount = 0;
      let dateCount = 0;
      const sampleSize = Math.min(data.rows.length, 50);
      
      for (let i = 0; i < sampleSize; i++) {
        const val = data.rows[i][col];
        if (isNumeric(val)) numericCount++;
        if (isDateLike(val)) dateCount++;
      }

      const threshold = sampleSize * 0.7;
      if (numericCount >= threshold) {
        numericColumns.push(col);
      } else if (dateCount >= threshold && !dateColumn) {
        dateColumn = col;
      } else if (numericCount < threshold) {
        categoricalColumns.push(col);
      }
    });

    return { numericColumns, categoricalColumns, dateColumn };
  }, [data]);

  const { numericColumns, categoricalColumns, dateColumn } = analysis;

  const effectiveMeasure = measure || numericColumns[0] || '';

  const groupValues = useMemo(() => {
    if (!data || groupBy === 'None') return [];
    const unique = new Set<string>();
    data.rows.forEach(row => {
      const val = row[groupBy];
      if (val !== null && val !== undefined && val !== '') {
        unique.add(String(val));
      }
    });
    return Array.from(unique).slice(0, 10);
  }, [data, groupBy]);

  const chartData = useMemo(() => {
    if (!data || !effectiveMeasure) return [];

    if (groupBy === 'None') {
      return data.rows.map((row, idx) => ({
        xValue: dateColumn ? row[dateColumn] : `Row ${idx + 1}`,
        value: Number(row[effectiveMeasure]) || 0
      }));
    }

    const grouped: Record<string, Record<string, number>> = {};
    data.rows.forEach((row, idx) => {
      const xKey = dateColumn ? row[dateColumn] : `Row ${idx + 1}`;
      const groupVal = String(row[groupBy] || 'Unknown');
      
      if (!grouped[xKey]) grouped[xKey] = {};
      if (!grouped[xKey][groupVal]) grouped[xKey][groupVal] = 0;
      grouped[xKey][groupVal] += Number(row[effectiveMeasure]) || 0;
    });

    return Object.entries(grouped).map(([xValue, groups]) => ({
      xValue,
      ...groups
    }));
  }, [data, effectiveMeasure, groupBy, dateColumn]);

  const activeSeries = selectedSeries.length > 0 ? selectedSeries : groupValues.slice(0, 3);

  if (!data || !data.rows.length) {
    return (
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>Aggregate Analysis</CardTitle>
          <CardDescription>Multi-dimensional view of key metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No data available for time series analysis</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (numericColumns.length === 0) {
    return (
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>Aggregate Analysis</CardTitle>
          <CardDescription>Multi-dimensional view of key metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No numeric columns detected in the data</p>
              <p className="text-sm mt-1">Time series analysis requires at least one numeric column</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-4">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
             <CardTitle>Aggregate Analysis</CardTitle>
             <CardDescription>
               Multi-dimensional view of key metrics
               {dateColumn && <span className="ml-1">(using {dateColumn} as time axis)</span>}
             </CardDescription>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-1.5">
               <Label className="text-xs text-muted-foreground">Measure</Label>
               <Select value={effectiveMeasure} onValueChange={setMeasure} data-testid="select-measure">
                <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="select-measure-trigger">
                  <SelectValue placeholder="Select measure" />
                </SelectTrigger>
                <SelectContent>
                  {numericColumns.map(col => (
                    <SelectItem key={col} value={col} data-testid={`measure-option-${col}`}>{col}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
               <Label className="text-xs text-muted-foreground">Breakdown By</Label>
               <Select 
                 value={groupBy} 
                 onValueChange={(val) => { 
                   setGroupBy(val); 
                   setSelectedSeries([]); 
                 }}
                 data-testid="select-groupby"
               >
                <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="select-groupby-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="None">None (Total)</SelectItem>
                  {categoricalColumns.map(col => (
                    <SelectItem key={col} value={col} data-testid={`groupby-option-${col}`}>{col}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {groupBy !== 'None' && groupValues.length > 0 && (
              <div className="flex flex-col gap-1.5">
                 <Label className="text-xs text-muted-foreground">Select Series</Label>
                 <ToggleGroup 
                   type="multiple" 
                   variant="outline" 
                   size="sm" 
                   value={activeSeries} 
                   onValueChange={setSelectedSeries} 
                   className="justify-start flex-wrap"
                   data-testid="toggle-series"
                 >
                    {groupValues.map(item => (
                       <ToggleGroupItem 
                         key={item} 
                         value={item} 
                         className="h-8 px-2 text-xs data-[state=on]:bg-primary/10 data-[state=on]:text-primary border-dashed"
                         data-testid={`series-toggle-${item}`}
                       >
                          {item}
                       </ToggleGroupItem>
                    ))}
                 </ToggleGroup>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]" data-testid="timeseries-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="xValue" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--popover))', 
                  borderColor: 'hsl(var(--border))', 
                  color: 'hsl(var(--popover-foreground))'
                }}
              />
              <Legend />
              
              {groupBy === 'None' && (
                 <Line 
                   type="monotone" 
                   dataKey="value" 
                   stroke="hsl(var(--primary))" 
                   strokeWidth={2}
                   dot={{ r: 4 }}
                   activeDot={{ r: 6 }}
                   name={effectiveMeasure}
                 />
              )}

              {groupBy !== 'None' && activeSeries.map((serie, index) => (
                 <Line 
                   key={serie}
                   type="monotone" 
                   dataKey={serie} 
                   stroke={COLORS[index % COLORS.length]} 
                   strokeWidth={2}
                   dot={false}
                   name={serie}
                 />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
