import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from '@/components/ui/label';

// Mock data generator for multi-line series
const generateData = () => {
  const categories = ['Electronics', 'Apparel', 'Home', 'Auto'];
  const regions = ['North America', 'Europe', 'APAC', 'LATAM'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return months.map(month => {
    const point: any = { date: `2023-${month}` };
    categories.forEach(cat => {
       regions.forEach(reg => {
          point[`${cat}-${reg}`] = Math.floor(Math.random() * 5000) + 1000;
          point[`${cat}`] = Math.floor(Math.random() * 15000) + 5000;
          point[`${reg}`] = Math.floor(Math.random() * 15000) + 5000;
       });
    });
    point['Total'] = Math.floor(Math.random() * 50000) + 20000;
    return point;
  });
};

const data = generateData();

const COLORS = [
  'hsl(var(--chart-1))', 
  'hsl(var(--chart-2))', 
  'hsl(var(--chart-3))', 
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
  'hsl(var(--destructive))'
];

export function TimeSeriesView() {
  const [measure, setMeasure] = useState('Actual Sales');
  const [groupBy, setGroupBy] = useState('None');
  const [selectedSeries, setSelectedSeries] = useState<string[]>(['Total']);

  // Dynamic series generation based on selection
  const getSeries = () => {
    if (groupBy === 'Category') {
       return ['Electronics', 'Apparel', 'Home', 'Auto'];
    }
    if (groupBy === 'Region') {
       return ['North America', 'Europe', 'APAC', 'LATAM'];
    }
    return ['Total'];
  };

  const currentSeries = getSeries();

  return (
    <Card className="col-span-4">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
             <CardTitle>Aggregate Analysis</CardTitle>
             <CardDescription>Multi-dimensional view of key metrics</CardDescription>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-1.5">
               <Label className="text-xs text-muted-foreground">Measure</Label>
               <Select value={measure} onValueChange={setMeasure}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Actual Sales">Actual Sales</SelectItem>
                  <SelectItem value="Forecast">Forecast</SelectItem>
                  <SelectItem value="Budget">Budget</SelectItem>
                  <SelectItem value="YoY Growth">YoY Growth</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
               <Label className="text-xs text-muted-foreground">Breakdown By</Label>
               <Select value={groupBy} onValueChange={(val) => { setGroupBy(val); setSelectedSeries(val === 'None' ? ['Total'] : []); }}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="None">None (Total)</SelectItem>
                  <SelectItem value="Category">Category</SelectItem>
                  <SelectItem value="Region">Region</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {groupBy !== 'None' && (
              <div className="flex flex-col gap-1.5">
                 <Label className="text-xs text-muted-foreground">Select Series</Label>
                 <ToggleGroup type="multiple" variant="outline" size="sm" value={selectedSeries} onValueChange={setSelectedSeries} className="justify-start">
                    {currentSeries.map(item => (
                       <ToggleGroupItem key={item} value={item} className="h-8 px-2 text-xs data-[state=on]:bg-primary/10 data-[state=on]:text-primary border-dashed">
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
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
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
              
              {/* If "None" is selected, show Total */}
              {groupBy === 'None' && (
                 <Line 
                   type="monotone" 
                   dataKey="Total" 
                   stroke="hsl(var(--primary))" 
                   strokeWidth={2}
                   dot={{ r: 4 }}
                   activeDot={{ r: 6 }}
                   name={`${measure} (Total)`}
                 />
              )}

              {/* If broken down, show selected lines */}
              {groupBy !== 'None' && currentSeries.map((serie, index) => (
                 selectedSeries.includes(serie) && (
                    <Line 
                      key={serie}
                      type="monotone" 
                      dataKey={serie} 
                      stroke={COLORS[index % COLORS.length]} 
                      strokeWidth={2}
                      dot={false}
                      name={serie}
                    />
                 )
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}