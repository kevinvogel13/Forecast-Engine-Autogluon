import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';

const COLORS = [
  'hsl(var(--chart-1))', 
  'hsl(var(--chart-2))', 
  'hsl(var(--chart-3))', 
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  '#8884d8',
  '#82ca9d',
  '#ffc658'
];

interface CategoryDistributionProps {
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

export function CategoryDistribution({ data }: CategoryDistributionProps) {
  const [selectedColumn, setSelectedColumn] = useState<string>('');

  const analysis = useMemo(() => {
    if (!data || !data.rows.length || !data.columns.length) {
      return { categoricalColumns: [], numericColumns: [] };
    }

    const categoricalColumns: string[] = [];
    const numericColumns: string[] = [];

    data.columns.forEach(col => {
      let numericCount = 0;
      const sampleSize = Math.min(data.rows.length, 50);
      
      for (let i = 0; i < sampleSize; i++) {
        const val = data.rows[i][col];
        if (isNumeric(val)) numericCount++;
      }

      const threshold = sampleSize * 0.7;
      if (numericCount >= threshold) {
        numericColumns.push(col);
      } else {
        categoricalColumns.push(col);
      }
    });

    return { categoricalColumns, numericColumns };
  }, [data]);

  const { categoricalColumns, numericColumns } = analysis;

  const effectiveColumn = selectedColumn || categoricalColumns[0] || '';

  const distributionData = useMemo(() => {
    if (!data || !effectiveColumn) return [];

    const counts: Record<string, number> = {};
    
    data.rows.forEach(row => {
      const val = row[effectiveColumn];
      const key = val === null || val === undefined || val === '' ? '(empty)' : String(val);
      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));
  }, [data, effectiveColumn]);

  if (!data || !data.rows.length) {
    return (
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Category Distribution</CardTitle>
          <CardDescription>Breakdown of values by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No data available</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (categoricalColumns.length === 0) {
    return (
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Category Distribution</CardTitle>
          <CardDescription>Breakdown of values by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No categorical columns detected</p>
              <p className="text-sm mt-1">All columns appear to be numeric</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
           <div>
              <CardTitle>Category Distribution</CardTitle>
              <CardDescription>Top 10 values in {effectiveColumn}</CardDescription>
           </div>
        </div>
        
        <div className="flex gap-2 mt-4">
           <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Column</Label>
              <Select value={effectiveColumn} onValueChange={setSelectedColumn} data-testid="select-category-column">
                 <SelectTrigger className="h-8 text-xs" data-testid="select-category-trigger">
                    <SelectValue placeholder="Select column" />
                 </SelectTrigger>
                 <SelectContent>
                    {categoricalColumns.map(col => (
                      <SelectItem key={col} value={col} data-testid={`category-option-${col}`}>{col}</SelectItem>
                    ))}
                 </SelectContent>
              </Select>
           </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]" data-testid="category-chart">
          {distributionData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <p>No data to display</p>
            </div>
          ) : (
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={distributionData}
                   cx="50%"
                   cy="50%"
                   innerRadius={60}
                   outerRadius={80}
                   paddingAngle={5}
                   dataKey="value"
                   nameKey="name"
                 >
                   {distributionData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                   ))}
                 </Pie>
                 <Tooltip 
                   contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }}
                   formatter={(value: number) => [value, 'Count']}
                 />
                 <Legend verticalAlign="bottom" height={36}/>
               </PieChart>
             </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
