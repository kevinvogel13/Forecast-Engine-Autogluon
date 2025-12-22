import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';

const data = [
  { name: 'Jan', value: 4000, error: 240 },
  { name: 'Feb', value: 3000, error: 139 },
  { name: 'Mar', value: 2000, error: 980 },
  { name: 'Apr', value: 2780, error: 390 },
  { name: 'May', value: 1890, error: 480 },
  { name: 'Jun', value: 2390, error: 380 },
  { name: 'Jul', value: 3490, error: 430 },
];

const errorData = [
  { name: 'Missing', value: 45 },
  { name: 'Type Mismatch', value: 23 },
  { name: 'Outlier', value: 12 },
  { name: 'Duplicate', value: 8 },
];

export default function ValidationStats() {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">128,492</div>
            <p className="text-xs text-muted-foreground">+20.1% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Quality Score</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">98.2%</div>
            <p className="text-xs text-muted-foreground">Excellent quality</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Validation Errors</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">142</div>
            <p className="text-xs text-muted-foreground">Action required</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing Time</CardTitle>
            <Badge variant="outline">Fast</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1.2s</div>
            <p className="text-xs text-muted-foreground">Average per batch</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Data Volume & Errors</CardTitle>
            <CardDescription>
              Volume (Bars) vs Validation Failures (Line) over time
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
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
                  tickFormatter={(value) => `${value}`} 
                />
                <Tooltip 
                  cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    borderColor: 'hsl(var(--border))', 
                    borderRadius: 'var(--radius)',
                    color: 'hsl(var(--popover-foreground))'
                  }}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="error" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Error Distribution</CardTitle>
            <CardDescription>
              Breakdown of validation failures
            </CardDescription>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
               {errorData.map((item) => (
                 <div key={item.name} className="flex items-center">
                   <div className="w-full space-y-1">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>{item.name}</span>
                        <span className="text-muted-foreground">{item.value} issues</span>
                      </div>
                      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-destructive/80" 
                          style={{ width: `${(item.value / 45) * 100}%` }}
                        />
                      </div>
                   </div>
                 </div>
               ))}
             </div>
             
             <div className="mt-8 pt-4 border-t border-border">
               <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-900">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Missing Data Alert</p>
                    <p className="opacity-90 mt-1">
                      High volume of missing "SKU" fields in the January dataset. Recommended: Check source file encoding.
                    </p>
                  </div>
               </div>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}