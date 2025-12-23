import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, TrendingUp, AlertCircle, ArrowUpRight, Clock, Target, Layers, BarChart3 } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar, ScatterChart, Scatter, Cell, ComposedChart, Line } from 'recharts';

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

const mockCVADIData = [
  { name: 'SKU-001', cv: 0.3, adi: 1.2, category: 'Smooth', volume: 15000 },
  { name: 'SKU-002', cv: 0.8, adi: 1.5, category: 'Erratic', volume: 8000 },
  { name: 'SKU-003', cv: 0.4, adi: 3.2, category: 'Lumpy', volume: 3000 },
  { name: 'SKU-004', cv: 0.2, adi: 1.1, category: 'Smooth', volume: 22000 },
  { name: 'SKU-005', cv: 1.2, adi: 4.5, category: 'Intermittent', volume: 500 },
  { name: 'SKU-006', cv: 0.5, adi: 1.8, category: 'Erratic', volume: 6500 },
  { name: 'SKU-007', cv: 0.9, adi: 3.8, category: 'Lumpy', volume: 2200 },
  { name: 'SKU-008', cv: 0.25, adi: 1.0, category: 'Smooth', volume: 18000 },
];

const categoryColors: Record<string, string> = {
  'Smooth': '#22c55e',
  'Erratic': '#f59e0b',
  'Lumpy': '#ef4444',
  'Intermittent': '#8b5cf6',
};

const mockLagComparison = [
  { lag: 'Lag 1', actual: 4000, forecast: 4100, error: 2.5 },
  { lag: 'Lag 2', actual: 3000, forecast: 3150, error: 5.0 },
  { lag: 'Lag 3', actual: 2000, forecast: 2200, error: 10.0 },
  { lag: 'Lag 4', actual: 2780, forecast: 2950, error: 6.1 },
  { lag: 'Lag 5', actual: 1890, forecast: 2100, error: 11.1 },
  { lag: 'Lag 6', actual: 2390, forecast: 2550, error: 6.7 },
];

export default function ForecastResultsDashboard() {
  const [selectedLag, setSelectedLag] = useState('3');

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="patterns" data-testid="tab-patterns">Pattern Analysis</TabsTrigger>
          <TabsTrigger value="lag" data-testid="tab-lag">Lag Comparison</TabsTrigger>
          <TabsTrigger value="export" data-testid="tab-export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Forecast Accuracy (MAPE)</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-mape">12.4%</div>
                <p className="text-xs text-muted-foreground">+2.1% from last run</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Predicted Volume</CardTitle>
                <ArrowUpRight className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-volume">1.2M</div>
                <p className="text-xs text-muted-foreground">Next 3 months</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bias</CardTitle>
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-bias">-1.2%</div>
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
                       <div key={m.model} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors" data-testid={`model-${m.model.toLowerCase()}`}>
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
        </TabsContent>

        <TabsContent value="patterns" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-green-50 border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-800">Smooth</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700" data-testid="count-smooth">3 SKUs</div>
                <p className="text-xs text-green-600">Low CV, Low ADI - Easy to forecast</p>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-800">Erratic</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-700" data-testid="count-erratic">2 SKUs</div>
                <p className="text-xs text-amber-600">High CV, Low ADI - Variable demand</p>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-800">Lumpy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-700" data-testid="count-lumpy">2 SKUs</div>
                <p className="text-xs text-red-600">High CV, High ADI - Sporadic large orders</p>
              </CardContent>
            </Card>
            <Card className="bg-violet-50 border-violet-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-violet-800">Intermittent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-violet-700" data-testid="count-intermittent">1 SKU</div>
                <p className="text-xs text-violet-600">Low CV, High ADI - Infrequent demand</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                CV vs ADI Demand Classification
              </CardTitle>
              <CardDescription>
                Classify products by Coefficient of Variation (CV) and Average Demand Interval (ADI) to select optimal forecasting methods.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="cv" name="CV" domain={[0, 1.5]} label={{ value: 'Coefficient of Variation (CV)', position: 'bottom', offset: 0 }} />
                    <YAxis type="number" dataKey="adi" name="ADI" domain={[0, 5]} label={{ value: 'Average Demand Interval (ADI)', angle: -90, position: 'left', offset: 10 }} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 border rounded-lg shadow-lg">
                            <p className="font-bold">{data.name}</p>
                            <p className="text-sm">CV: {data.cv.toFixed(2)}</p>
                            <p className="text-sm">ADI: {data.adi.toFixed(2)}</p>
                            <p className="text-sm">Category: <span style={{ color: categoryColors[data.category] }}>{data.category}</span></p>
                            <p className="text-sm">Volume: {data.volume.toLocaleString()}</p>
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Scatter name="SKUs" data={mockCVADIData} fill="#8884d8">
                      {mockCVADIData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={categoryColors[entry.category]} />
                      ))}
                    </Scatter>
                    {/* Reference lines for quadrant boundaries */}
                    <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#999" strokeDasharray="5 5" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-4">
                {Object.entries(categoryColors).map(([category, color]) => (
                  <div key={category} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-sm">{category}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lag" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Actual vs Forecast by Lag</h3>
              <p className="text-sm text-muted-foreground">Compare prediction accuracy at different forecast horizons</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Select Lag:</span>
              <Select value={selectedLag} onValueChange={setSelectedLag}>
                <SelectTrigger className="w-32" data-testid="select-lag">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Lag 1</SelectItem>
                  <SelectItem value="2">Lag 2</SelectItem>
                  <SelectItem value="3">Lag 3</SelectItem>
                  <SelectItem value="4">Lag 4</SelectItem>
                  <SelectItem value="5">Lag 5</SelectItem>
                  <SelectItem value="6">Lag 6</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Accuracy by Lag</CardTitle>
                <CardDescription>Error percentage increases with forecast horizon</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={mockLagComparison} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="lag" />
                      <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                      <YAxis yAxisId="right" orientation="right" stroke="#ff7300" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="actual" fill="#82ca9d" name="Actual" />
                      <Bar yAxisId="left" dataKey="forecast" fill="#8884d8" name="Forecast" />
                      <Line yAxisId="right" type="monotone" dataKey="error" stroke="#ff7300" strokeWidth={2} name="Error %" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lag {selectedLag} Detail</CardTitle>
                <CardDescription>Detailed metrics for selected forecast horizon</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-700 font-medium">Actual Value</p>
                    <p className="text-2xl font-bold text-green-800" data-testid="lag-actual">
                      {mockLagComparison[parseInt(selectedLag) - 1]?.actual.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-sm text-purple-700 font-medium">Forecast Value</p>
                    <p className="text-2xl font-bold text-purple-800" data-testid="lag-forecast">
                      {mockLagComparison[parseInt(selectedLag) - 1]?.forecast.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-amber-700 font-medium">Error Percentage</p>
                      <p className="text-2xl font-bold text-amber-800" data-testid="lag-error">
                        {mockLagComparison[parseInt(selectedLag) - 1]?.error}%
                      </p>
                    </div>
                    <BarChart3 className="w-8 h-8 text-amber-500" />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  <p>Lag {selectedLag} represents forecasting {selectedLag} period(s) ahead.</p>
                  <p>Higher lags typically have higher error due to increased uncertainty.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="export" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Export Results</CardTitle>
              <CardDescription>Download forecast results in various formats</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Download className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Forecast Data (CSV)</p>
                      <p className="text-sm text-muted-foreground">All predictions with confidence intervals</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Layers className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Pattern Classification (CSV)</p>
                      <p className="text-sm text-muted-foreground">CV/ADI analysis by SKU</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <BarChart3 className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium">Model Metrics (CSV)</p>
                      <p className="text-sm text-muted-foreground">MAPE, RMSE, MASE by model</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <Download className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium">Full Report (PDF)</p>
                      <p className="text-sm text-muted-foreground">Complete analysis with visualizations</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
