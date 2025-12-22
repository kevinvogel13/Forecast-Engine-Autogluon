import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const data = [
  { date: '2023-01', actual: 4000, forecast: 4100 },
  { date: '2023-02', actual: 3000, forecast: 3200 },
  { date: '2023-03', actual: 2000, forecast: 2400 },
  { date: '2023-04', actual: 2780, forecast: 2900 },
  { date: '2023-05', actual: 1890, forecast: 2100 },
  { date: '2023-06', actual: 2390, forecast: 2500 },
  { date: '2023-07', actual: 3490, forecast: 3300 },
  { date: '2023-08', actual: 4200, forecast: 4000 },
  { date: '2023-09', actual: 4500, forecast: 4300 },
  { date: '2023-10', actual: 3800, forecast: 3900 },
  { date: '2023-11', actual: 3000, forecast: 3100 },
  { date: '2023-12', actual: 5000, forecast: 4800 },
];

export function TimeSeriesView() {
  return (
    <Card className="col-span-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
           <CardTitle>Aggregate Volume Analysis</CardTitle>
           <CardDescription>Historical volume vs Forecast across all DFUs</CardDescription>
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by Region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            <SelectItem value="na">North America</SelectItem>
            <SelectItem value="eu">Europe</SelectItem>
            <SelectItem value="apac">APAC</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                </linearGradient>
              </defs>
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
              <Area 
                type="monotone" 
                dataKey="actual" 
                stroke="hsl(var(--primary))" 
                fillOpacity={1} 
                fill="url(#colorActual)" 
                name="Actual Sales"
              />
              <Area 
                type="monotone" 
                dataKey="forecast" 
                stroke="hsl(var(--chart-2))" 
                fillOpacity={1} 
                fill="url(#colorForecast)" 
                strokeDasharray="4 4"
                name="Forecast Baseline"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}