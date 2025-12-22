import { useState } from 'react';
import Shell from '@/components/layout/Shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Save, Bell, Database, Shield, User, Sliders, Cpu, Activity, Calendar as CalendarIcon, Check, ChevronsUpDown, Upload } from 'lucide-react';
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Mock available quantiles
const QUANTILES = [
  { value: "0.1", label: "P10 (Low)" },
  { value: "0.25", label: "P25" },
  { value: "0.5", label: "P50 (Median)" },
  { value: "0.75", label: "P75" },
  { value: "0.9", label: "P90 (High)" },
  { value: "0.95", label: "P95" },
  { value: "0.99", label: "P99 (Extreme)" },
];

export default function Settings() {
  // State for Model Specs
  const [selectedQuantiles, setSelectedQuantiles] = useState<string[]>(["0.1", "0.5", "0.9"]);
  const [quantileOpen, setQuantileOpen] = useState(false);

  // State for Backtesting
  const [trainDate, setTrainDate] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: new Date(2023, 0, 1),
    to: new Date(2023, 11, 31),
  });
  const [backtestDate, setBacktestDate] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: new Date(2024, 0, 1),
    to: new Date(2024, 2, 31),
  });

  // State for Hyperparameters
  const [selectedModels, setSelectedModels] = useState({
    deepar: true,
    tft: true,
    chronos: false,
    arima: true,
    ets: true,
    theta: true,
    rectab: true
  });

  const [modelParams, setModelParams] = useState({
    deepar: { epochs: 50, learning_rate: 0.001, context_length: 64, num_layers: 2, hidden_size: 40, dropout: 0.1 },
    tft: { epochs: 100, learning_rate: 0.01, hidden_size: 32, attention_head_size: 4, dropout: 0.1 },
    arima: { p: 5, d: 2, q: 5, seasonal: true, approximation: false },
  });

  const toggleModel = (key: keyof typeof selectedModels) => {
    setSelectedModels(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateModelParam = (model: keyof typeof modelParams, param: string, value: any) => {
    setModelParams(prev => ({
      ...prev,
      [model]: { ...prev[model], [param]: value }
    }));
  };

  const getGeneratedConfig = () => {
    const config: any = {};
    Object.entries(selectedModels).forEach(([key, isSelected]) => {
      if (isSelected) {
        // @ts-ignore
        config[key] = modelParams[key] || {};
      }
    });
    return JSON.stringify(config, null, 2);
  };

  return (
    <Shell>
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        <div className="flex justify-between items-start">
           <div>
             <h2 className="text-2xl font-bold tracking-tight">Configuration</h2>
             <p className="text-muted-foreground">Advanced control over AutoGluon forecasting parameters and system behavior.</p>
           </div>
           <Button variant="outline" className="gap-2">
              <Upload className="w-4 h-4" /> Load Config
           </Button>
        </div>

        <Tabs defaultValue="features" className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto mb-8 justify-start gap-1 p-1 bg-muted rounded-md">
            <TabsTrigger value="features" className="flex-1 min-w-[150px]">Feature Engineering</TabsTrigger>
            <TabsTrigger value="models" className="flex-1 min-w-[120px]">Model Specs</TabsTrigger>
            <TabsTrigger value="backtesting" className="flex-1 min-w-[120px]">Backtesting</TabsTrigger>
            <TabsTrigger value="training" className="flex-1 min-w-[100px]">Strategy</TabsTrigger>
            <TabsTrigger value="hyperparameters" className="flex-1 min-w-[140px]">Hyperparameters</TabsTrigger>
            <TabsTrigger value="general" className="flex-1 min-w-[100px]">System</TabsTrigger>
          </TabsList>

          {/* --- FEATURE ENGINEERING TAB --- */}
          <TabsContent value="features" className="space-y-6">
             <Card>
                <CardHeader>
                   <div className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-primary" />
                      <CardTitle>Dataset Schema & Features</CardTitle>
                   </div>
                   <CardDescription>Define column roles and feature engineering steps.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-4">
                         <Label>Target Variable</Label>
                         <Select defaultValue="sales">
                            <SelectTrigger>
                               <SelectValue placeholder="Select target..." />
                            </SelectTrigger>
                            <SelectContent>
                               <SelectItem value="sales">sales_quantity</SelectItem>
                               <SelectItem value="revenue">revenue_amt</SelectItem>
                               <SelectItem value="units">units_sold</SelectItem>
                            </SelectContent>
                         </Select>
                         <p className="text-[10px] text-muted-foreground">The column you want to forecast.</p>
                      </div>
                      
                      <div className="space-y-4">
                         <Label>Time Column</Label>
                         <Select defaultValue="date">
                            <SelectTrigger>
                               <SelectValue placeholder="Select date..." />
                            </SelectTrigger>
                            <SelectContent>
                               <SelectItem value="date">transaction_date</SelectItem>
                               <SelectItem value="ts">timestamp</SelectItem>
                            </SelectContent>
                         </Select>
                         <p className="text-[10px] text-muted-foreground">Timestamp column for the time series.</p>
                      </div>

                      <div className="space-y-4">
                         <Label>Item ID (Group)</Label>
                         <Select defaultValue="sku">
                            <SelectTrigger>
                               <SelectValue placeholder="Select ID..." />
                            </SelectTrigger>
                            <SelectContent>
                               <SelectItem value="sku">product_sku</SelectItem>
                               <SelectItem value="store">store_id</SelectItem>
                               <SelectItem value="combo">sku_store_combo</SelectItem>
                            </SelectContent>
                         </Select>
                         <p className="text-[10px] text-muted-foreground">Unique identifier for each time series.</p>
                      </div>
                   </div>

                   <Separator />

                   <div className="space-y-4">
                      <h3 className="text-sm font-medium">Feature Types</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div className="space-y-2">
                            <Label>Static Categorical Features</Label>
                            <div className="min-h-[100px] p-3 border rounded-md bg-muted/10 text-xs">
                               <div className="flex flex-wrap gap-2">
                                  {['product_category', 'brand', 'color', 'store_region'].map(col => (
                                     <div key={col} className="bg-background border px-2 py-1 rounded flex items-center gap-1">
                                        {col} <span className="text-muted-foreground cursor-pointer hover:text-destructive">×</span>
                                     </div>
                                  ))}
                                  <div className="border border-dashed px-2 py-1 rounded text-muted-foreground cursor-pointer hover:bg-muted">+ Add</div>
                               </div>
                            </div>
                         </div>
                         <div className="space-y-2">
                            <Label>Dynamic Real-time Features</Label>
                            <div className="min-h-[100px] p-3 border rounded-md bg-muted/10 text-xs">
                               <div className="flex flex-wrap gap-2">
                                  {['price', 'promotion_active', 'temperature'].map(col => (
                                     <div key={col} className="bg-background border px-2 py-1 rounded flex items-center gap-1">
                                        {col} <span className="text-muted-foreground cursor-pointer hover:text-destructive">×</span>
                                     </div>
                                  ))}
                                  <div className="border border-dashed px-2 py-1 rounded text-muted-foreground cursor-pointer hover:bg-muted">+ Add</div>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>

                   <Separator />

                   <div className="space-y-4">
                      <h3 className="text-sm font-medium">Feature Engineering</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                               <Label>Lagged Features</Label>
                               <Switch defaultChecked />
                            </div>
                            <p className="text-[10px] text-muted-foreground">Automatically generate lagged values of the target (e.g. sales t-1, t-7).</p>
                         </div>
                         <div className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                               <Label>Holiday Features</Label>
                               <Switch defaultChecked />
                            </div>
                            <p className="text-[10px] text-muted-foreground">Add boolean flags for national holidays based on country code.</p>
                         </div>
                         <div className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                               <Label>Date Parts</Label>
                               <Switch defaultChecked />
                            </div>
                            <p className="text-[10px] text-muted-foreground">Extract components like Day of Week, Month, Quarter, etc.</p>
                         </div>
                         <div className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                               <Label>Rolling Statistics</Label>
                               <Switch defaultChecked />
                            </div>
                            <p className="text-[10px] text-muted-foreground">Compute rolling mean, std dev, and other stats over time windows.</p>
                         </div>
                      </div>
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

          {/* --- MODEL SPECS TAB --- */}
          <TabsContent value="models" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <Card className="md:col-span-2">
                 <CardHeader>
                   <div className="flex items-center gap-2">
                     <Database className="w-5 h-5 text-primary" />
                     <CardTitle>Global Predictor Settings</CardTitle>
                   </div>
                   <CardDescription>Core parameters for the <code>TimeSeriesPredictor</code> initialization.</CardDescription>
                 </CardHeader>
                 <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className="space-y-2">
                          <Label>Prediction Length (Horizon)</Label>
                          <Input type="number" defaultValue="12" />
                          <p className="text-[10px] text-muted-foreground">Number of time steps to forecast.</p>
                       </div>
                       <div className="space-y-2">
                          <Label>Frequency</Label>
                          <Select defaultValue="M">
                             <SelectTrigger>
                                <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                                <SelectItem value="D">Daily</SelectItem>
                                <SelectItem value="W">Weekly</SelectItem>
                                <SelectItem value="M">Monthly</SelectItem>
                                <SelectItem value="Q">Quarterly</SelectItem>
                                <SelectItem value="Y">Yearly</SelectItem>
                             </SelectContent>
                          </Select>
                          <p className="text-[10px] text-muted-foreground">Frequency of the time series data.</p>
                       </div>
                       <div className="space-y-2">
                          <Label>Evaluation Metric</Label>
                          <Select defaultValue="MASE">
                             <SelectTrigger>
                                <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                                <SelectItem value="MASE">MASE (Mean Absolute Scaled Error)</SelectItem>
                                <SelectItem value="MAPE">MAPE (Mean Absolute Percentage Error)</SelectItem>
                                <SelectItem value="RMSE">RMSE (Root Mean Squared Error)</SelectItem>
                                <SelectItem value="WQL">WQL (Weighted Quantile Loss)</SelectItem>
                             </SelectContent>
                          </Select>
                          <p className="text-[10px] text-muted-foreground">Primary metric for optimizing models.</p>
                       </div>
                       <div className="space-y-2 flex flex-col">
                          <Label className="mb-2">Quantile Levels</Label>
                          <Popover open={quantileOpen} onOpenChange={setQuantileOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={quantileOpen}
                                className="justify-between"
                              >
                                {selectedQuantiles.length > 0
                                  ? `${selectedQuantiles.length} selected`
                                  : "Select quantiles..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[200px] p-0">
                              <Command>
                                <CommandList>
                                   <CommandGroup>
                                     {QUANTILES.map((quantile) => (
                                       <CommandItem
                                         key={quantile.value}
                                         value={quantile.value}
                                         onSelect={(currentValue) => {
                                           setSelectedQuantiles(prev => 
                                              prev.includes(currentValue) 
                                              ? prev.filter(v => v !== currentValue)
                                              : [...prev, currentValue]
                                           );
                                         }}
                                       >
                                         <Check
                                           className={cn(
                                             "mr-2 h-4 w-4",
                                             selectedQuantiles.includes(quantile.value) ? "opacity-100" : "opacity-0"
                                           )}
                                         />
                                         {quantile.label}
                                       </CommandItem>
                                     ))}
                                   </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <p className="text-[10px] text-muted-foreground">Probabilistic forecast intervals.</p>
                       </div>
                    </div>
                 </CardContent>
               </Card>
            </div>
          </TabsContent>

          {/* --- BACKTESTING TAB --- */}
          <TabsContent value="backtesting" className="space-y-6">
            <Card>
               <CardHeader>
                  <div className="flex items-center gap-2">
                     <CalendarIcon className="w-5 h-5 text-primary" />
                     <CardTitle>Training & Validation Windows</CardTitle>
                  </div>
                  <CardDescription>
                     Sequester backtesting data from training to prevent leakage and ensure robust evaluation.
                  </CardDescription>
               </CardHeader>
               <CardContent className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                     {/* Training Window */}
                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                           <Label className="text-base font-semibold">Training Period</Label>
                           <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">Historical Data</span>
                        </div>
                        <div className="p-4 border rounded-lg bg-muted/10 space-y-4">
                           <div className="grid gap-2">
                              <Label>Start Date</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full justify-start text-left font-normal",
                                      !trainDate.from && "text-muted-foreground"
                                    )}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {trainDate.from ? format(trainDate.from, "PPP") : <span>Pick a date</span>}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={trainDate.from}
                                    onSelect={(date) => setTrainDate(prev => ({ ...prev, from: date }))}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                           </div>
                           <div className="grid gap-2">
                              <Label>End Date</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full justify-start text-left font-normal",
                                      !trainDate.to && "text-muted-foreground"
                                    )}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {trainDate.to ? format(trainDate.to, "PPP") : <span>Pick a date</span>}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={trainDate.to}
                                    onSelect={(date) => setTrainDate(prev => ({ ...prev, to: date }))}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                           </div>
                        </div>
                     </div>

                     {/* Backtesting Window */}
                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                           <Label className="text-base font-semibold">Backtesting Period</Label>
                           <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">Holdout Set</span>
                        </div>
                        <div className="p-4 border rounded-lg bg-amber-50/50 space-y-4 border-amber-200/50">
                           <div className="grid gap-2">
                              <Label>Start Date</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full justify-start text-left font-normal",
                                      !backtestDate.from && "text-muted-foreground"
                                    )}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {backtestDate.from ? format(backtestDate.from, "PPP") : <span>Pick a date</span>}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={backtestDate.from}
                                    onSelect={(date) => setBacktestDate(prev => ({ ...prev, from: date }))}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                           </div>
                           <div className="grid gap-2">
                              <Label>End Date</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full justify-start text-left font-normal",
                                      !backtestDate.to && "text-muted-foreground"
                                    )}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {backtestDate.to ? format(backtestDate.to, "PPP") : <span>Pick a date</span>}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={backtestDate.to}
                                    onSelect={(date) => setBacktestDate(prev => ({ ...prev, to: date }))}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                           </div>
                        </div>
                     </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-4">
                        <Label>Lag Configuration</Label>
                        <div className="p-4 border rounded-lg space-y-4">
                           <div className="grid gap-2">
                              <Label>Backtesting Lag of Importance</Label>
                              <Input type="number" defaultValue="0" />
                              <p className="text-[10px] text-muted-foreground">Offset in time steps to align forecast origin for comparison.</p>
                           </div>
                        </div>
                     </div>
                  </div>
               </CardContent>
            </Card>
          </TabsContent>

          {/* --- TRAINING STRATEGY TAB --- */}
          <TabsContent value="training" className="space-y-6">
             <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-primary" />
                  <CardTitle>Training Control</CardTitle>
                </div>
                <CardDescription>Configure validation folds and ensemble behavior.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-4">
                      <div className="space-y-2">
                         <Label>Number of Validation Windows</Label>
                         <Input type="number" defaultValue="1" />
                         <p className="text-[10px] text-muted-foreground">Number of internal validation folds during training.</p>
                      </div>
                      <div className="space-y-2">
                         <Label>Refit Every N Windows</Label>
                         <Input type="number" defaultValue="1" />
                      </div>
                   </div>
                   <div className="space-y-4">
                      <div className="flex items-center justify-between border p-3 rounded-lg">
                         <div className="space-y-0.5">
                            <Label>Refit Full</Label>
                            <p className="text-xs text-muted-foreground">Retrain best models on all data (train + val) at the end.</p>
                         </div>
                         <Switch />
                      </div>
                      <div className="flex items-center justify-between border p-3 rounded-lg">
                         <div className="space-y-0.5">
                            <Label>Enable Ensemble</Label>
                            <p className="text-xs text-muted-foreground">Build weighted ensemble of best performing models.</p>
                         </div>
                         <Switch defaultChecked />
                      </div>
                   </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                 <CardTitle>Hyperparameter Tuning (HPO)</CardTitle>
                 <CardDescription>Search strategy for finding optimal parameters.</CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                       <Label>Search Strategy</Label>
                       <Select defaultValue="auto">
                          <SelectTrigger>
                             <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                             <SelectItem value="auto">Auto</SelectItem>
                             <SelectItem value="random">Random Search</SelectItem>
                             <SelectItem value="bayes">Bayesian Optimization</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label>Number of Trials</Label>
                       <Input type="number" defaultValue="5" />
                    </div>
                    <div className="space-y-2">
                       <Label>Scheduler</Label>
                       <Select defaultValue="local">
                          <SelectTrigger>
                             <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                             <SelectItem value="local">Local</SelectItem>
                             <SelectItem value="fifo">FIFO</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                 </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- HYPERPARAMETERS TAB --- */}
          <TabsContent value="hyperparameters" className="space-y-6">
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 h-fit">
                   <CardHeader>
                      <CardTitle>Included Models</CardTitle>
                      <CardDescription>Select which model families to train.</CardDescription>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      <div className="space-y-4">
                         <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deep Learning</h4>
                            <div className="flex items-center space-x-2">
                               <Checkbox id="deepar" checked={selectedModels.deepar} onCheckedChange={() => toggleModel('deepar')} />
                               <Label htmlFor="deepar" className="font-normal cursor-pointer">DeepAR</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                               <Checkbox id="tft" checked={selectedModels.tft} onCheckedChange={() => toggleModel('tft')} />
                               <Label htmlFor="tft" className="font-normal cursor-pointer">TemporalFusionTransformer</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                               <Checkbox id="chronos" checked={selectedModels.chronos} onCheckedChange={() => toggleModel('chronos')} />
                               <Label htmlFor="chronos" className="font-normal cursor-pointer">Chronos (Foundation)</Label>
                            </div>
                         </div>
                         <Separator />
                         <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Statistical</h4>
                            <div className="flex items-center space-x-2">
                               <Checkbox id="arima" checked={selectedModels.arima} onCheckedChange={() => toggleModel('arima')} />
                               <Label htmlFor="arima" className="font-normal cursor-pointer">AutoARIMA</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                               <Checkbox id="ets" checked={selectedModels.ets} onCheckedChange={() => toggleModel('ets')} />
                               <Label htmlFor="ets" className="font-normal cursor-pointer">AutoETS</Label>
                            </div>
                         </div>
                         <Separator />
                         <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Machine Learning</h4>
                            <div className="flex items-center space-x-2">
                               <Checkbox id="rectab" checked={selectedModels.rectab} onCheckedChange={() => toggleModel('rectab')} />
                               <Label htmlFor="rectab" className="font-normal cursor-pointer">RecursiveTabular (LightGBM)</Label>
                            </div>
                         </div>
                      </div>
                   </CardContent>
                </Card>

                <div className="lg:col-span-2 space-y-6">
                   <Card>
                      <CardHeader>
                         <CardTitle>Model Hyperparameters</CardTitle>
                         <CardDescription>Configure specific parameters for selected algorithms.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                         {selectedModels.deepar && (
                            <Accordion type="single" collapsible className="w-full border rounded-lg px-4" defaultValue="deepar-config">
                               <AccordionItem value="deepar-config" className="border-b-0">
                                  <AccordionTrigger className="hover:no-underline">
                                     <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                                        DeepAR Configuration
                                     </div>
                                  </AccordionTrigger>
                                  <AccordionContent className="pt-4 pb-4">
                                     <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                           <Label className="text-xs">Epochs</Label>
                                           <Input type="number" value={modelParams.deepar.epochs} onChange={(e) => updateModelParam('deepar', 'epochs', parseInt(e.target.value))} />
                                           <p className="text-[10px] text-muted-foreground">Number of training iterations.</p>
                                        </div>
                                        <div className="space-y-2">
                                           <Label className="text-xs">Context Length</Label>
                                           <Input type="number" value={modelParams.deepar.context_length} onChange={(e) => updateModelParam('deepar', 'context_length', parseInt(e.target.value))} />
                                           <p className="text-[10px] text-muted-foreground">Number of time steps to look back.</p>
                                        </div>
                                        <div className="space-y-2">
                                           <Label className="text-xs">Hidden Size</Label>
                                           <Input type="number" value={modelParams.deepar.hidden_size} onChange={(e) => updateModelParam('deepar', 'hidden_size', parseInt(e.target.value))} />
                                        </div>
                                        <div className="space-y-2">
                                           <Label className="text-xs">Learning Rate</Label>
                                           <Input type="number" step="0.0001" value={modelParams.deepar.learning_rate} onChange={(e) => updateModelParam('deepar', 'learning_rate', parseFloat(e.target.value))} />
                                        </div>
                                     </div>
                                  </AccordionContent>
                               </AccordionItem>
                            </Accordion>
                         )}

                         {selectedModels.tft && (
                            <Accordion type="single" collapsible className="w-full border rounded-lg px-4">
                               <AccordionItem value="tft-config" className="border-b-0">
                                  <AccordionTrigger className="hover:no-underline">
                                     <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                                        Temporal Fusion Transformer (TFT)
                                     </div>
                                  </AccordionTrigger>
                                  <AccordionContent className="pt-4 pb-4">
                                     <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                           <Label className="text-xs">Epochs</Label>
                                           <Input type="number" value={modelParams.tft.epochs} onChange={(e) => updateModelParam('tft', 'epochs', parseInt(e.target.value))} />
                                        </div>
                                        <div className="space-y-2">
                                           <Label className="text-xs">Attention Heads</Label>
                                           <Input type="number" value={modelParams.tft.attention_head_size} onChange={(e) => updateModelParam('tft', 'attention_head_size', parseInt(e.target.value))} />
                                        </div>
                                     </div>
                                  </AccordionContent>
                               </AccordionItem>
                            </Accordion>
                         )}

                         {selectedModels.arima && (
                            <Accordion type="single" collapsible className="w-full border rounded-lg px-4">
                               <AccordionItem value="arima-config" className="border-b-0">
                                  <AccordionTrigger className="hover:no-underline">
                                     <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500" />
                                        AutoARIMA
                                     </div>
                                  </AccordionTrigger>
                                  <AccordionContent className="pt-4 pb-4">
                                     <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                           <Label className="text-xs">Max P</Label>
                                           <Input type="number" value={modelParams.arima.p} onChange={(e) => updateModelParam('arima', 'p', parseInt(e.target.value))} />
                                        </div>
                                        <div className="space-y-2">
                                           <Label className="text-xs">Max D</Label>
                                           <Input type="number" value={modelParams.arima.d} onChange={(e) => updateModelParam('arima', 'd', parseInt(e.target.value))} />
                                        </div>
                                        <div className="space-y-2">
                                           <Label className="text-xs">Max Q</Label>
                                           <Input type="number" value={modelParams.arima.q} onChange={(e) => updateModelParam('arima', 'q', parseInt(e.target.value))} />
                                        </div>
                                     </div>
                                  </AccordionContent>
                               </AccordionItem>
                            </Accordion>
                         )}
                      </CardContent>
                   </Card>

                   <Card>
                      <CardHeader>
                         <CardTitle>Generated JSON Config</CardTitle>
                         <CardDescription>Final configuration object to be passed to the training job.</CardDescription>
                      </CardHeader>
                      <CardContent>
                         <pre className="text-[10px] bg-muted p-4 rounded-md overflow-x-auto font-mono">
                            {getGeneratedConfig()}
                         </pre>
                      </CardContent>
                   </Card>
                </div>
             </div>
          </TabsContent>

          {/* --- GENERAL / EXISTING SETTINGS --- */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  <CardTitle>Profile Information</CardTitle>
                </div>
                <CardDescription>Update your personal details and display preferences.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" defaultValue="John Doe" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" defaultValue="john.doe@example.com" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select defaultValue="scientist">
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scientist">Data Scientist</SelectItem>
                      <SelectItem value="analyst">Business Analyst</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                 <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-primary" />
                  <CardTitle>Notifications</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Pipeline Failures</Label>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Validation Warnings</Label>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border flex justify-end gap-2 z-50">
           <Button variant="outline">Discard Changes</Button>
           <Button className="gap-2 shadow-lg">
              <Save className="w-4 h-4" /> Save Configuration
           </Button>
        </div>
      </div>
    </Shell>
  );
}