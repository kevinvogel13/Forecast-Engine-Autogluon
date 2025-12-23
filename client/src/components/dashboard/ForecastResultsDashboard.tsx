import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, TrendingUp, AlertCircle, ArrowUpRight, ArrowDownRight, Clock } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar } from 'recharts';

const mockForecastData = [
  { date: '2024-01', actual: 4000, forecast: 4100, lower: 3800, upper: 4400 },
  { date: '2024-02', actual: 3000, forecast: 3200, lower: 2900, upper: 3500 },
  { date: '2024-03', actual: 2000, forecast: 2400, lower: 2100, upper: 2700 },
  { date: '2024-04', actual: 2780, forecast: 2900, lower: 2600, upper: 3200 },
  { date: '2024-05', actual: 1890, forecast: 2000, lower: 1700, upper: 2300 },
  { date: '2024-06', actual: 2390, forecast: 2500, lower: 2200, upper: 2800 },
  { date: '2024-07', actual: 3490, forecast: 3400, lower: 3100, upper: 3700 },
  { date: '2024-08', forecast: 3800, lower: 3400, upper: 4200 },
  { date: '2024-09', forecast: 4200, lower: 3800, upper: 4600 },
  { date: '2024-10', forecast: 4500, lower: 4000, upper: 5000 },
  { date: '2024-11', forecast: 5100, lower: 4600, upper: 5600 },
  { date: '2024-12', forecast: 6200, lower: 5600, upper: 6800 },
];

const mockErrorMetrics = [
  { model: 'DeepAR', mape: '12%', mase: '0.85', rmse: '450.2' },
  { model: 'AutoARIMA', mape: '15%', mase: '1.10', rmse: '520.8' },
  { model: 'Prophet', mape: '18%', mase: '1.25', rmse: '600.5' },
];

export default function ForecastResultsDashboard() {
  const [metric, setMetric] = useState('sales');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Forecast Accuracy (MAPE)</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12.4%</div>
            <p className="text-xs text-muted-foreground">+2.1% from last run</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Predicted Volume</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1.2M</div>
            <p className="text-xs text-muted-foreground">Next 3 months</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bias</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-1.2%</div>
            <p className="text-xs text-muted-foreground">Slight under-forecast</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Training Time</CardTitle>
            <Clock className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">14m 20s</div>
            <p className="text-xs text-muted-foreground">AutoGluon Medium Quality</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Forecast vs Actuals</CardTitle>
            <CardDescription>Visual comparison of historical performance and future predictions.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockForecastData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="upper" stackId="2" stroke="transparent" fill="#8884d8" fillOpacity={0.1} name="Confidence Interval" />
                  <Area type="monotone" dataKey="lower" stackId="2" stroke="transparent" fill="transparent" /> 
                  <Area type="monotone" dataKey="forecast" stroke="#8884d8" strokeWidth={2} fillOpacity={1} fill="url(#colorForecast)" name="Forecast" />
                  <Area type="monotone" dataKey="actual" stroke="#82ca9d" strokeWidth={2} fillOpacity={1} fill="url(#colorActual)" name="Actuals" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model Leaderboard</CardTitle>
            <CardDescription>Top performing algorithms.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
                {mockErrorMetrics.map((m, i) => (
                   <div key={m.model} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                         <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'}`}>
                            {i + 1}
                         </div>
                         <div>
                            <p className="font-medium text-sm">{m.model}</p>
                            <p className="text-xs text-muted-foreground">RMSE: {m.rmse}</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="font-bold text-sm">{m.mape}</p>
                         <p className="text-xs text-muted-foreground">MAPE</p>
                      </div>
                   </div>
                ))}
             </div>
             <Button className="w-full mt-4" variant="outline">View All Models</Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
         <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Download CSV
         </Button>
         <Button>
            <Download className="mr-2 h-4 w-4" /> Export Report (PDF)
         </Button>
      </div>
    </div>
  );
}