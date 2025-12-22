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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Save, Bell, Database, Shield, User, Sliders, Cpu, Activity, Calendar as CalendarIcon, Check, ChevronsUpDown, Upload } from 'lucide-react';
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Mock available quantiles
const QUANTILES = [
  { value: "0.01", label: "P1 (Extreme Low)" },
  { value: "0.05", label: "P5" },
  { value: "0.1", label: "P10 (Low)" },
  { value: "0.2", label: "P20" },
  { value: "0.25", label: "P25" },
  { value: "0.3", label: "P30" },
  { value: "0.4", label: "P40" },
  { value: "0.5", label: "P50 (Median)" },
  { value: "0.6", label: "P60" },
  { value: "0.7", label: "P70" },
  { value: "0.75", label: "P75" },
  { value: "0.8", label: "P80" },
  { value: "0.9", label: "P90 (High)" },
  { value: "0.95", label: "P95" },
  { value: "0.99", label: "P99 (Extreme High)" },
];

const ROLLING_STATS = [
  { value: "mean", label: "Mean" },
  { value: "std", label: "Std Dev" },
  { value: "min", label: "Min" },
  { value: "max", label: "Max" },
  { value: "median", label: "Median" },
  { value: "sum", label: "Sum" },
  { value: "skew", label: "Skew" },
  { value: "kurtosis", label: "Kurtosis" },
  { value: "var", label: "Variance" }
];

const ALL_MODELS = {
  // Statistical
  naive: { label: "Naive", category: "Statistical" },
  seasonal_naive: { label: "SeasonalNaive", category: "Statistical" },
  ets: { label: "ETS", category: "Statistical" },
  arima: { label: "ARIMA", category: "Statistical" },
  auto_arima: { label: "AutoARIMA", category: "Statistical" },
  theta: { label: "Theta", category: "Statistical" },
  croston: { label: "Croston", category: "Statistical" },
  
  // Deep Learning
  deepar: { label: "DeepAR", category: "Deep Learning" },
  tft: { label: "TemporalFusionTransformer", category: "Deep Learning" },
  transformer: { label: "Transformer", category: "Deep Learning" },
  simple_feed_forward: { label: "SimpleFeedForward", category: "Deep Learning" },
  
  // Tree-Based
  recursive_tabular: { label: "RecursiveTabular", category: "Tree-Based" },
  direct_tabular: { label: "DirectTabular", category: "Tree-Based" },
  
  // Foundation
  chronos: { label: "Chronos", category: "Foundation" },
  chronos_bolt: { label: "ChronosBolt", category: "Foundation" },
  
  // Ensemble
  weighted_ensemble: { label: "WeightedEnsemble", category: "Ensemble" },
};

export default function Settings() {
  const [frequency, setFrequency] = useState("Monthly"); // In a real app this would come from global state
  
  const getFrequencyLabel = (prefix: string = "") => {
    const map: Record<string, string> = {
      "Monthly": "Months",
      "Weekly": "Weeks",
      "Daily": "Days",
      "Hourly": "Hours"
    };
    return `${prefix} ${map[frequency] || "Periods"}`;
  };

  const ROLLING_WINDOWS = Array.from({ length: 52 }, (_, i) => ({
    value: (i + 2).toString(),
    label: `${i + 2} ${getFrequencyLabel().trim()}`
  }));

  const LAG_WINDOWS = Array.from({ length: 52 }, (_, i) => ({
    value: (i + 2).toString(),
    label: `Lag ${i + 2}`
  }));

  // State for Model Specs
  const [selectedQuantiles, setSelectedQuantiles] = useState<string[]>(["0.1", "0.5", "0.9"]);
  const [quantileOpen, setQuantileOpen] = useState(false);

  // State for Feature Engineering
  const [featureToggles, setFeatureToggles] = useState({
    lagged: true,
    holidays: true,
    dateParts: true,
    rolling: true
  });
  
  const [selectedRollingStats, setSelectedRollingStats] = useState<string[]>(["mean", "std"]);
  const [rollingStatsOpen, setRollingStatsOpen] = useState(false);
  const [selectedRollingWindows, setSelectedRollingWindows] = useState<string[]>(["4", "12"]);
  const [rollingWindowsOpen, setRollingWindowsOpen] = useState(false);
  
  const [selectedLags, setSelectedLags] = useState<string[]>(["1", "7", "28"]);
  const [lagsOpen, setLagsOpen] = useState(false);

  const [selectedDateParts, setSelectedDateParts] = useState<string[]>(["year", "month", "dayofweek"]);
  const [datePartsOpen, setDatePartsOpen] = useState(false);

  // State for Backtesting
  const [trainDate, setTrainDate] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: new Date(2023, 0, 1),
    to: new Date(2023, 11, 31),
  });
  const [backtestDate, setBacktestDate] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: new Date(2024, 0, 1),
    to: new Date(2024, 2, 31),
  });
  
  const [lagStrategy, setLagStrategy] = useState("generate"); // generate vs provided
  const [backtestLags, setBacktestLags] = useState<string[]>(["1"]);
  const [backtestLagsOpen, setBacktestLagsOpen] = useState(false);

  // State for Hyperparameters
  const [selectedModels, setSelectedModels] = useState<Record<string, boolean>>({
    deepar: true,
    tft: true,
    chronos: false,
    arima: true,
    ets: true,
    theta: true,
    recursive_tabular: true,
    weighted_ensemble: true
  });

  const [modelParams, setModelParams] = useState<Record<string, any>>({
    deepar: { epochs: 50, learning_rate: 0.001, context_length: 64, num_layers: 2, hidden_size: 40, dropout: 0.1 },
    tft: { epochs: 100, learning_rate: 0.01, hidden_size: 32, attention_head_size: 4, dropout: 0.1 },
    arima: { p: 5, d: 2, q: 5, seasonal: true, approximation: false },
    // Add defaults for others to show they can be configured
    naive: {}, seasonal_naive: {}, ets: {}, auto_arima: {}, theta: {}, croston: {},
    transformer: {}, simple_feed_forward: {}, recursive_tabular: {}, direct_tabular: {},
    chronos: {}, chronos_bolt: {}, weighted_ensemble: {}
  });

  const toggleModel = (key: string) => {
    setSelectedModels(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateModelParam = (model: keyof typeof modelParams, param: string, value: any) => {
    setModelParams(prev => ({
      ...prev,
      [model]: { ...prev[model], [param]: value }
    }));
  };
  
  const toggleFeature = (key: keyof typeof featureToggles) => {
    setFeatureToggles(prev => ({ ...prev, [key]: !prev[key] }));
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

        <Tabs defaultValue="models" className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto mb-8 justify-start gap-1 p-1 bg-muted rounded-md">
            <TabsTrigger value="models" className="flex-1 min-w-[120px]">Model Specs</TabsTrigger>
            <TabsTrigger value="features" className="flex-1 min-w-[150px]">Feature Engineering</TabsTrigger>
            <TabsTrigger value="backtesting" className="flex-1 min-w-[120px]">Backtesting</TabsTrigger>
            <TabsTrigger value="training" className="flex-1 min-w-[100px]">Strategy</TabsTrigger>
            <TabsTrigger value="hyperparameters" className="flex-1 min-w-[180px]">Models & Hyperparameters</TabsTrigger>
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
                         <Label>Demand Forecasting Unit (DFU)</Label>
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
                         <div className="border rounded-lg p-4 space-y-4">
                            <div className="flex items-center justify-between">
                               <Label className="font-semibold">Lagged Features</Label>
                               <Switch 
                                checked={featureToggles.lagged} 
                                onCheckedChange={() => toggleFeature('lagged')}
                               />
                            </div>
                            <p className="text-[10px] text-muted-foreground -mt-2">Automatically generate lagged values of the target.</p>
                            
                            {featureToggles.lagged && (
                              <div className="pt-2">
                                <Label className="text-xs mb-1.5 block">Select Specific Lags (t-n)</Label>
                                <Popover open={lagsOpen} onOpenChange={setLagsOpen}>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      aria-expanded={lagsOpen}
                                      className="w-full justify-between h-9"
                                    >
                                      {selectedLags.length > 0
                                        ? `${selectedLags.length} lags selected`
                                        : "Select lags..."}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[300px] p-0">
                                    <Command>
                                      <CommandInput placeholder="Search lags..." />
                                      <CommandList className="max-h-[200px]">
                                        <CommandEmpty>No lag found.</CommandEmpty>
                                        <CommandGroup>
                                          <CommandItem
                                            value="1"
                                            onSelect={() => {
                                                setSelectedLags(prev => 
                                                  prev.includes("1") 
                                                  ? prev.filter(v => v !== "1")
                                                  : [...prev, "1"]
                                                );
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                selectedLags.includes("1") ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            Lag 1 (Standard)
                                          </CommandItem>
                                          {LAG_WINDOWS.map((lag) => (
                                            <CommandItem
                                              key={lag.value}
                                              value={lag.value}
                                              onSelect={(currentValue) => {
                                                setSelectedLags(prev => 
                                                   prev.includes(currentValue) 
                                                   ? prev.filter(v => v !== currentValue)
                                                   : [...prev, currentValue]
                                                );
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  selectedLags.includes(lag.value) ? "opacity-100" : "opacity-0"
                                                )}
                                              />
                                              {lag.label}
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            )}
                         </div>

                         <div className="border rounded-lg p-4 space-y-4">
                            <div className="flex items-center justify-between">
                               <Label className="font-semibold">Date Parts</Label>
                               <Switch 
                                checked={featureToggles.dateParts} 
                                onCheckedChange={() => toggleFeature('dateParts')}
                               />
                            </div>
                            <p className="text-[10px] text-muted-foreground -mt-2">Extract calendar components from timestamp.</p>
                            
                            {featureToggles.dateParts && (
                              <div className="pt-2">
                                <Label className="text-xs mb-1.5 block">Select Date Components</Label>
                                <Popover open={datePartsOpen} onOpenChange={setDatePartsOpen}>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      aria-expanded={datePartsOpen}
                                      className="w-full justify-between h-9"
                                    >
                                      {selectedDateParts.length > 0
                                        ? `${selectedDateParts.length} parts selected`
                                        : "Select parts..."}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[300px] p-0">
                                    <Command>
                                      <CommandInput placeholder="Search date parts..." />
                                      <CommandList>
                                        <CommandGroup>
                                          {DATE_PARTS.map((part) => (
                                            <CommandItem
                                              key={part.value}
                                              value={part.value}
                                              onSelect={(currentValue) => {
                                                setSelectedDateParts(prev => 
                                                   prev.includes(currentValue) 
                                                   ? prev.filter(v => v !== currentValue)
                                                   : [...prev, currentValue]
                                                );
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  selectedDateParts.includes(part.value) ? "opacity-100" : "opacity-0"
                                                )}
                                              />
                                              {part.label}
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            )}
                         </div>

                         <div className="border rounded-lg p-4 space-y-4">
                            <div className="flex items-center justify-between">
                               <Label className="font-semibold">Rolling Statistics</Label>
                               <Switch 
                                checked={featureToggles.rolling} 
                                onCheckedChange={() => toggleFeature('rolling')}
                               />
                            </div>
                            <p className="text-[10px] text-muted-foreground -mt-2">Compute rolling statistics over time windows.</p>
                            
                            {featureToggles.rolling && (
                              <div className="space-y-4 pt-2">
                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Statistics</Label>
                                  <Popover open={rollingStatsOpen} onOpenChange={setRollingStatsOpen}>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={rollingStatsOpen}
                                        className="w-full justify-between h-9"
                                      >
                                        {selectedRollingStats.length > 0
                                          ? `${selectedRollingStats.length} stats selected`
                                          : "Select statistics..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0">
                                      <Command>
                                        <CommandList>
                                          <CommandGroup>
                                            {ROLLING_STATS.map((stat) => (
                                              <CommandItem
                                                key={stat.value}
                                                value={stat.value}
                                                onSelect={(currentValue) => {
                                                  setSelectedRollingStats(prev => 
                                                     prev.includes(currentValue) 
                                                     ? prev.filter(v => v !== currentValue)
                                                     : [...prev, currentValue]
                                                  );
                                                }}
                                              >
                                                <Check
                                                  className={cn(
                                                    "mr-2 h-4 w-4",
                                                    selectedRollingStats.includes(stat.value) ? "opacity-100" : "opacity-0"
                                                  )}
                                                />
                                                {stat.label}
                                              </CommandItem>
                                            ))}
                                          </CommandGroup>
                                        </CommandList>
                                      </Command>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                                
                                <Separator className="my-2" />
                                
                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Window Sizes (Periods)</Label>
                                  <Popover open={rollingWindowsOpen} onOpenChange={setRollingWindowsOpen}>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={rollingWindowsOpen}
                                        className="w-full justify-between h-9"
                                      >
                                        {selectedRollingWindows.length > 0
                                          ? `${selectedRollingWindows.length} windows selected`
                                          : "Select windows..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0">
                                      <Command>
                                        <CommandInput placeholder="Search window sizes..." />
                                        <CommandList className="max-h-[200px]">
                                           <CommandEmpty>No window size found.</CommandEmpty>
                                          <CommandGroup>
                                            {ROLLING_WINDOWS.map((win) => (
                                              <CommandItem
                                                key={win.value}
                                                value={win.value}
                                                onSelect={(currentValue) => {
                                                  setSelectedRollingWindows(prev => 
                                                     prev.includes(currentValue) 
                                                     ? prev.filter(v => v !== currentValue)
                                                     : [...prev, currentValue]
                                                  );
                                                }}
                                              >
                                                <Check
                                                  className={cn(
                                                    "mr-2 h-4 w-4",
                                                    selectedRollingWindows.includes(win.value) ? "opacity-100" : "opacity-0"
                                                  )}
                                                />
                                                {win.label}
                                              </CommandItem>
                                            ))}
                                          </CommandGroup>
                                        </CommandList>
                                      </Command>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              </div>
                            )}
                         </div>

                         <div className="border rounded-lg p-4 space-y-4 h-fit">
                            <div className="flex items-center justify-between">
                               <Label className="font-semibold">Holiday Features</Label>
                               <Switch 
                                checked={featureToggles.holidays} 
                                onCheckedChange={() => toggleFeature('holidays')}
                               />
                            </div>
                            <p className="text-[10px] text-muted-foreground -mt-2">Add boolean flags for national holidays.</p>
                            
                            {featureToggles.holidays && (
                              <div className="pt-2">
                                <Label className="text-xs mb-1.5 block">Country Code</Label>
                                <Select defaultValue="us">
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="us">United States (US)</SelectItem>
                                    <SelectItem value="uk">United Kingdom (UK)</SelectItem>
                                    <SelectItem value="de">Germany (DE)</SelectItem>
                                    <SelectItem value="fr">France (FR)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
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
                      <CardTitle>Backtesting & Validation</CardTitle>
                   </div>
                   <CardDescription>Configure time windows for model training and evaluation.</CardDescription>
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

                   <div className="space-y-4">
                      <h3 className="text-sm font-medium">Lag Strategy</h3>
                      <div className="space-y-4">
                         <RadioGroup value={lagStrategy} onValueChange={setLagStrategy}>
                            <div className="flex items-center space-x-2">
                               <RadioGroupItem value="generate" id="lag-gen" />
                               <Label htmlFor="lag-gen">Generate lags automatically</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                               <RadioGroupItem value="pre-lagged" id="lag-pre" />
                               <Label htmlFor="lag-pre">Data is pre-lagged (Do not generate lags)</Label>
                            </div>
                         </RadioGroup>

                         {lagStrategy === "generate" && (
                             <div className="pl-6 pt-2 w-full md:w-1/2">
                                <Label className="text-xs mb-1.5 block">Select Lags for Backtesting</Label>
                                <Popover open={backtestLagsOpen} onOpenChange={setBacktestLagsOpen}>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      aria-expanded={backtestLagsOpen}
                                      className="w-full justify-between h-9"
                                    >
                                      {backtestLags.length > 0
                                        ? `${backtestLags.length} lags selected`
                                        : "Select lags..."}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[300px] p-0">
                                    <Command>
                                      <CommandInput placeholder="Search lags..." />
                                      <CommandList className="max-h-[200px]">
                                        <CommandEmpty>No lag found.</CommandEmpty>
                                        <CommandGroup>
                                          {LAG_WINDOWS.map((lag) => (
                                            <CommandItem
                                              key={lag.value}
                                              value={lag.value}
                                              onSelect={(currentValue) => {
                                                setBacktestLags(prev => 
                                                   prev.includes(currentValue) 
                                                   ? prev.filter(v => v !== currentValue)
                                                   : [...prev, currentValue]
                                                );
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  backtestLags.includes(lag.value) ? "opacity-100" : "opacity-0"
                                                )}
                                              />
                                              {lag.label}
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                   Define which lag periods are available at prediction time.
                                </p>
                             </div>
                         )}
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

          {/* --- MODELS & HYPERPARAMETERS TAB --- */}
          <TabsContent value="hyperparameters" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-primary" />
                  <CardTitle>Models & Hyperparameters</CardTitle>
                </div>
                <CardDescription>Select models to train and configure their hyperparameters.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {Object.entries(
                  Object.keys(ALL_MODELS).reduce((acc, key) => {
                    const category = ALL_MODELS[key as keyof typeof ALL_MODELS].category;
                    if (!acc[category]) acc[category] = [];
                    acc[category].push(key);
                    return acc;
                  }, {} as Record<string, string[]>)
                ).map(([category, models]) => (
                  <div key={category} className="space-y-4">
                    <h3 className="text-sm font-semibold text-foreground">{category} Models</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {models.map((key) => {
                         const modelInfo = ALL_MODELS[key as keyof typeof ALL_MODELS];
                         const isSelected = selectedModels[key];
                         return (
                          <div key={key} className={cn(
                            "border rounded-lg p-4 transition-all",
                            isSelected ? "border-primary bg-primary/5" : "bg-card"
                          )}>
                             <div className="flex items-center justify-between mb-2">
                                <Label htmlFor={`model-${key}`} className="font-medium cursor-pointer flex-1">
                                  {modelInfo.label}
                                </Label>
                                <Switch
                                  id={`model-${key}`}
                                  checked={isSelected}
                                  onCheckedChange={() => toggleModel(key)}
                                />
                             </div>
                             
                             {isSelected && (
                               <div className="pt-2 mt-2 border-t border-border/50 animate-in fade-in slide-in-from-top-1 duration-200">
                                 <p className="text-xs text-muted-foreground mb-3">Hyperparameters</p>
                                 <div className="grid grid-cols-1 gap-3">
                                   {Object.entries(modelParams[key] || {}).map(([param, val]) => (
                                      <div key={param} className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">{param}</Label>
                                        <Input 
                                          className="h-7 text-xs" 
                                          value={val as any} 
                                          onChange={(e) => updateModelParam(key, param, e.target.value)}
                                        />
                                      </div>
                                   ))}
                                   {Object.keys(modelParams[key] || {}).length === 0 && (
                                     <div className="text-xs text-muted-foreground italic p-2 bg-muted/20 rounded">
                                       Using default AutoGluon settings.
                                     </div>
                                   )}
                                 </div>
                               </div>
                             )}
                          </div>
                         );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
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