import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Volume Breakdown</CardTitle>
        <CardDescription>Distribution by key categorical variables</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="category">
          <TabsList className="w-full">
            <TabsTrigger value="category" className="flex-1">Category</TabsTrigger>
            <TabsTrigger value="region" className="flex-1">Region</TabsTrigger>
          </TabsList>
          
          <TabsContent value="category" className="h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={categoryData}
                   cx="50%"
                   cy="50%"
                   innerRadius={60}
                   outerRadius={80}
                   paddingAngle={5}
                   dataKey="value"
                 >
                   {categoryData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                   ))}
                 </Pie>
                 <Tooltip 
                   contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }}
                 />
                 <Legend verticalAlign="bottom" height={36}/>
               </PieChart>
             </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="region" className="h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={regionData} layout="vertical">
                 <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                 <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                 <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} width={100} />
                 <Tooltip cursor={{fill: 'hsl(var(--accent))'}} contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }} />
                 <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
               </BarChart>
             </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}