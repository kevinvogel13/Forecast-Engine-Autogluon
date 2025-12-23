import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from 'recharts';
import { AlertCircle } from 'lucide-react';

interface DataCompletenessChartProps {
  data?: {
    columns: string[];
    rows: any[];
    totalRows: number;
  };
}

export function DataCompletenessChart({ data }: DataCompletenessChartProps) {
  const completenessData = useMemo(() => {
    if (!data || !data.rows.length || !data.columns.length) {
      return [];
    }

    const totalRows = data.rows.length;
    
    return data.columns.map(col => {
      let nonNullCount = 0;
      
      data.rows.forEach(row => {
        const val = row[col];
        if (val !== null && val !== undefined && val !== '') {
          nonNullCount++;
        }
      });
      
      const completeness = Math.round((nonNullCount / totalRows) * 100);
      const missingCount = totalRows - nonNullCount;
      
      return {
        column: col,
        completeness,
        missingCount,
        filledCount: nonNullCount,
        totalRows
      };
    }).sort((a, b) => a.completeness - b.completeness);
  }, [data]);

  const stats = useMemo(() => {
    if (completenessData.length === 0) return null;
    
    const avgCompleteness = Math.round(
      completenessData.reduce((sum, d) => sum + d.completeness, 0) / completenessData.length
    );
    const fullyComplete = completenessData.filter(d => d.completeness === 100).length;
    const withMissing = completenessData.filter(d => d.completeness < 100).length;
    
    return { avgCompleteness, fullyComplete, withMissing };
  }, [completenessData]);

  if (!data || !data.rows.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Completeness</CardTitle>
          <CardDescription>Percentage of non-null values per column</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No data available</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Data Completeness</CardTitle>
            <CardDescription>
              Percentage of non-null values per column. Columns with missing data are highlighted.
            </CardDescription>
          </div>
          {stats && (
            <div className="flex gap-4 text-xs">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{stats.avgCompleteness}%</p>
                <p className="text-muted-foreground">Average</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{stats.fullyComplete}</p>
                <p className="text-muted-foreground">Complete</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">{stats.withMissing}</p>
                <p className="text-muted-foreground">With Missing</p>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full" data-testid="completeness-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={completenessData} 
              layout="vertical"
              margin={{ top: 5, right: 30, bottom: 5, left: 100 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                type="number"
                domain={[0, 100]}
                tickFormatter={(val) => `${val}%`}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                type="category"
                dataKey="column"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                width={90}
              />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '8px', 
                  border: '1px solid hsl(var(--border))', 
                  backgroundColor: 'hsl(var(--popover))',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' 
                }}
                formatter={(value: number, name: string, props: any) => {
                  const item = props.payload;
                  return [
                    <span key="val">
                      <strong>{value}%</strong> complete
                      <br />
                      <span className="text-muted-foreground">
                        {item.filledCount} filled / {item.missingCount} missing
                      </span>
                    </span>,
                    ''
                  ];
                }}
                labelFormatter={(label) => <strong>{label}</strong>}
              />
              <ReferenceLine x={100} stroke="hsl(var(--primary))" strokeDasharray="3 3" strokeWidth={2} />
              <Bar 
                dataKey="completeness" 
                name="Completeness" 
                radius={[0, 4, 4, 0]}
              >
                {completenessData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.completeness === 100 ? 'hsl(var(--chart-2))' : entry.completeness >= 90 ? 'hsl(var(--chart-4))' : 'hsl(var(--destructive))'}
                    opacity={0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
