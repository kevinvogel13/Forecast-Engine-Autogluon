import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { Label } from '@/components/ui/label';

const categoryData = [
  { name: 'Electronics', value: 400 },
  { name: 'Apparel', value: 300 },
  { name: 'Home & Garden', value: 300 },
  { name: 'Automotive', value: 200 },
];

const regionData = [
  { name: 'North America', value: 2400 },
  { name: 'Europe', value: 1398 },
  { name: 'APAC', value: 9800 },
  { name: 'LATAM', value: 3908 },
];

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

export function CategoryDistribution() {
  const [measure, setMeasure] = useState('Volume');
  const [dimension, setDimension] = useState('Category');

  const data = dimension === 'Category' ? categoryData : regionData;

  return (
    <Card className="col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
           <div>
              <CardTitle>Metric Distribution</CardTitle>
              <CardDescription>Breakdown of {measure} by {dimension}</CardDescription>
           </div>
        </div>
        
        <div className="flex gap-2 mt-4">
           <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Metric</Label>
              <Select value={measure} onValueChange={setMeasure}>
                 <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                    <SelectItem value="Volume">Volume</SelectItem>
                    <SelectItem value="Revenue">Revenue</SelectItem>
                    <SelectItem value="Margin">Margin</SelectItem>
                 </SelectContent>
              </Select>
           </div>
           <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Dimension</Label>
              <Select value={dimension} onValueChange={setDimension}>
                 <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                    <SelectItem value="Category">Category</SelectItem>
                    <SelectItem value="Region">Region</SelectItem>
                    <SelectItem value="Brand">Brand</SelectItem>
                 </SelectContent>
              </Select>
           </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={data}
                   cx="50%"
                   cy="50%"
                   innerRadius={60}
                   outerRadius={80}
                   paddingAngle={5}
                   dataKey="value"
                 >
                   {data.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                   ))}
                 </Pie>
                 <Tooltip 
                   contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }}
                 />
                 <Legend verticalAlign="bottom" height={36}/>
               </PieChart>
             </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}