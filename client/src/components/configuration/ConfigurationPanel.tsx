import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Database, Activity, Calendar as CalendarIcon, Check, ChevronsUpDown, Upload } from 'lucide-react';
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

const DATE_PARTS = [
  { value: "year", label: "Year" },
  { value: "quarter", label: "Quarter" },
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
  { value: "dayofweek", label: "Day of Week" },
  { value: "dayofyear", label: "Day of Year" },
  { value: "is_weekend", label: "Is Weekend" },
  { value: "is_month_start", label: "Is Month Start" },
  { value: "is_month_end", label: "Is Month End" }
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

export default function ConfigurationPanel() {
  const [frequency, setFrequency] = useState("Monthly"); 
  
  const getFrequencyLabel = (prefix: string = "") => {
    const map: Record<string, string> = {
      "Monthly": "Months",
      "Weekly": "Weeks",
      "Daily": "Days",
      "Hourly": "Hours",
      "Quarterly": "Quarters",
      "Yearly": "Years"
    };
    return `${prefix} ${map[frequency] || "Periods"}`;
  };

  const handleFrequencyChange = (newFreq: string) => {
    setFrequency(newFreq);
    
    // Set appropriate defaults based on frequency
    if (newFreq === "Daily") {
      setSelectedLags(["1", "7", "14", "28", "365"]);
      setSelectedRollingWindows(["7", "14", "30", "90"]);
    } else if (newFreq === "Weekly") {
      setSelectedLags(["1", "4", "13", "52"]);
      setSelectedRollingWindows(["4", "13", "26", "52"]);
    } else if (newFreq === "Monthly") {
      setSelectedLags(["1", "3", "6", "12"]);
      setSelectedRollingWindows(["3", "6", "12", "24"]);
    } else if (newFreq === "Quarterly") {
      setSelectedLags(["1", "4"]);
      setSelectedRollingWindows(["4"]);
    } else if (newFreq === "Yearly") {
      setSelectedLags(["1", "2"]);
      setSelectedRollingWindows(["2", "5"]);
    } else if (newFreq === "Hourly") {
      setSelectedLags(["1", "24", "48", "168"]);
      setSelectedRollingWindows(["24", "168"]);
    }
  };


  const ROLLING_WINDOWS = Array.from({ length: 52 }, (_, i) => ({
    value: (i + 2).toString(),
    label: `${i + 2} ${getFrequencyLabel().trim()}`
  }));

  const LAG_WINDOWS = Array.from({ length: 52 }, (_, i) => ({
    value: (i + 2).toString(),
    label: `Lag ${i + 2} ${getFrequencyLabel().trim()}`
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

  // State for Output Definitions
  const [outputConfig, setOutputConfig] = useState({
    actualHistoricalColumn: "sales_quantity",
    historicalForecastLag: "1"
  });

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
    <div className="space-y-6 pb-12 w-full">
      <div className="flex justify-between items-start px-1">
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
          <TabsTrigger value="outputs" className="flex-1 min-w-[150px]">Outputs & Visualization</TabsTrigger>
          <TabsTrigger value="general" className="flex-1 min-w-[100px]">System</TabsTrigger>
        </TabsList>

        {/* --- OUTPUTS TAB --- */}
        <TabsContent value="outputs" className="space-y-6">
           <Card>
              <CardHeader>
                 <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    <CardTitle>Output & Visualization Configuration</CardTitle>
                 </div>
                 <CardDescription>Define how forecasting results should be interpreted and displayed across the application.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                       <Label>Actual Historical (Target)</Label>
                       <Select 
                          value={outputConfig.actualHistoricalColumn} 
                          onValueChange={(val) => setOutputConfig(prev => ({ ...prev, actualHistoricalColumn: val }))}
                       >
                          <SelectTrigger>
                             <SelectValue placeholder="Select target..." />
                          </SelectTrigger>
                          <SelectContent>
                             <SelectItem value="sales_quantity">sales_quantity</SelectItem>
                             <SelectItem value="revenue_amt">revenue_amt</SelectItem>
                             <SelectItem value="units_sold">units_sold</SelectItem>
                          </SelectContent>
                       </Select>
                       <p className="text-[13px] text-muted-foreground">The actuals column used for calculating errors and visualizing historical performance.</p>
                    </div>

                    <div className="space-y-4">
                       <Label>Historical Forecast of Interest</Label>
                       <Select 
                          value={outputConfig.historicalForecastLag} 
                          onValueChange={(val) => setOutputConfig(prev => ({ ...prev, historicalForecastLag: val }))}
                       >
                          <SelectTrigger>
                             <SelectValue placeholder="Select lag..." />
                          </SelectTrigger>
                          <SelectContent>
                             <SelectItem value="1">Lag 1 {getFrequencyLabel().trim()}</SelectItem>
                             {LAG_WINDOWS.slice(0, 12).map((lag) => (
                               <SelectItem key={lag.value} value={lag.value}>
                                  {lag.label}
                               </SelectItem>
                             ))}
                          </SelectContent>
                       </Select>
                       <p className="text-[13px] text-muted-foreground">The primary forecast lag to display when comparing Actuals vs Forecast in charts.</p>
                    </div>
                 </div>
                 
                 <div className="rounded-md bg-blue-50 p-4 border border-blue-100 text-blue-800 text-sm">
                    <div className="flex gap-2">
                       <Activity className="w-4 h-4 mt-0.5" />
                       <div>
                          <p className="font-semibold mb-1">Impact on Dashboard</p>
                          <p className="opacity-90">
                             These settings control the primary lines shown in the Evaluation and Forecast dashboards. 
                             For example, comparing <strong>{outputConfig.actualHistoricalColumn}</strong> against the <strong>Lag {outputConfig.historicalForecastLag}</strong> forecast allows you to visualize accuracy at your most critical planning horizon.
                          </p>
                       </div>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </TabsContent>

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
                       <div className="border rounded-lg p-4 space-y-4 h-fit">
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

                       <div className="border rounded-lg p-4 space-y-4 h-fit">
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

                       <div className="border rounded-lg p-4 space-y-4 h-fit">
                          <div className="flex items-center justify-between">
                             <Label className="font-semibold">Rolling Statistics</Label>
                             <Switch 
                              checked={featureToggles.rolling} 
                              onCheckedChange={() => toggleFeature('rolling')}
                             />
                          </div>
                          <p className="text-[10px] text-muted-foreground -mt-2">Compute moving averages and standard deviations.</p>
                          
                          {featureToggles.rolling && (
                            <div className="pt-2 space-y-3">
                              <div>
                                <Label className="text-xs mb-1.5 block">Statistics to Compute</Label>
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
                                        : "Select stats..."}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[300px] p-0">
                                    <Command>
                                      <CommandInput placeholder="Search statistics..." />
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

                              <div>
                                <Label className="text-xs mb-1.5 block">Window Sizes (Periods)</Label>
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
                                        <CommandGroup>
                                          {ROLLING_WINDOWS.map((window) => (
                                            <CommandItem
                                              key={window.value}
                                              value={window.value}
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
                                                  selectedRollingWindows.includes(window.value) ? "opacity-100" : "opacity-0"
                                                )}
                                              />
                                              {window.label}
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
                        <Select defaultValue={frequency} onValueChange={handleFrequencyChange}>
                           <SelectTrigger>
                              <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                              <SelectItem value="Daily">Daily</SelectItem>
                              <SelectItem value="Weekly">Weekly</SelectItem>
                              <SelectItem value="Monthly">Monthly</SelectItem>
                              <SelectItem value="Quarterly">Quarterly</SelectItem>
                              <SelectItem value="Yearly">Yearly</SelectItem>
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
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                       <h3 className="text-sm font-semibold">Training Window</h3>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <Label>Start Date</Label>
                             <Popover>
                                <PopoverTrigger asChild>
                                   <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !trainDate.from && "text-muted-foreground")}>
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {trainDate.from ? format(trainDate.from, "PPP") : <span>Pick a date</span>}
                                   </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                   <Calendar mode="single" selected={trainDate.from} onSelect={(date) => setTrainDate(prev => ({...prev, from: date}))} initialFocus />
                                </PopoverContent>
                             </Popover>
                          </div>
                          <div className="space-y-2">
                             <Label>End Date</Label>
                             <Popover>
                                <PopoverTrigger asChild>
                                   <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !trainDate.to && "text-muted-foreground")}>
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {trainDate.to ? format(trainDate.to, "PPP") : <span>Pick a date</span>}
                                   </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                   <Calendar mode="single" selected={trainDate.to} onSelect={(date) => setTrainDate(prev => ({...prev, to: date}))} initialFocus />
                                </PopoverContent>
                             </Popover>
                          </div>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <h3 className="text-sm font-semibold">Backtest Window (Holdout)</h3>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <Label>Start Date</Label>
                             <Popover>
                                <PopoverTrigger asChild>
                                   <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !backtestDate.from && "text-muted-foreground")}>
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {backtestDate.from ? format(backtestDate.from, "PPP") : <span>Pick a date</span>}
                                   </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                   <Calendar mode="single" selected={backtestDate.from} onSelect={(date) => setBacktestDate(prev => ({...prev, from: date}))} initialFocus />
                                </PopoverContent>
                             </Popover>
                          </div>
                          <div className="space-y-2">
                             <Label>End Date</Label>
                             <Popover>
                                <PopoverTrigger asChild>
                                   <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !backtestDate.to && "text-muted-foreground")}>
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {backtestDate.to ? format(backtestDate.to, "PPP") : <span>Pick a date</span>}
                                   </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                   <Calendar mode="single" selected={backtestDate.to} onSelect={(date) => setBacktestDate(prev => ({...prev, to: date}))} initialFocus />
                                </PopoverContent>
                             </Popover>
                          </div>
                       </div>
                    </div>
                 </div>

                 <Separator />

                 <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Lag Strategy for Backtesting</h3>
                    <RadioGroup defaultValue={lagStrategy} onValueChange={setLagStrategy} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="flex items-start space-x-2 border p-4 rounded-md hover:bg-muted/5">
                          <RadioGroupItem value="generate" id="gen" className="mt-1" />
                          <div className="space-y-1">
                             <Label htmlFor="gen" className="font-medium">Generate Lags</Label>
                             <p className="text-xs text-muted-foreground">
                                Use historical target values from training data to generate lags dynamically during backtesting.
                             </p>
                          </div>
                       </div>
                       <div className="flex items-start space-x-2 border p-4 rounded-md hover:bg-muted/5">
                          <RadioGroupItem value="provide" id="prov" className="mt-1" />
                          <div className="space-y-1">
                             <Label htmlFor="prov" className="font-medium">Use Pre-lagged Data</Label>
                             <p className="text-xs text-muted-foreground">
                                Use existing columns in the dataset as lags. Requires mapping columns manually.
                             </p>
                          </div>
                       </div>
                    </RadioGroup>

                    {lagStrategy === 'provide' && (
                       <div className="mt-4 p-4 bg-muted/20 rounded-md border">
                          <Label className="text-xs mb-2 block">Map Lag Columns</Label>
                          <div className="space-y-2">
                             <div className="flex items-center gap-2">
                                <span className="text-xs w-16">Lag 1:</span>
                                <Select>
                                   <SelectTrigger className="h-8"><SelectValue placeholder="Select column..." /></SelectTrigger>
                                   <SelectContent><SelectItem value="l1">lag_1_sales</SelectItem></SelectContent>
                                </Select>
                             </div>
                             <div className="flex items-center gap-2">
                                <span className="text-xs w-16">Lag 7:</span>
                                <Select>
                                   <SelectTrigger className="h-8"><SelectValue placeholder="Select column..." /></SelectTrigger>
                                   <SelectContent><SelectItem value="l7">lag_7_sales</SelectItem></SelectContent>
                                </Select>
                             </div>
                          </div>
                       </div>
                    )}
                 </div>
              </CardContent>
           </Card>
        </TabsContent>

        {/* --- TRAINING STRATEGY TAB --- */}
        <TabsContent value="training" className="space-y-6">
           <Card>
              <CardHeader>
                 <CardTitle>Training Strategy</CardTitle>
                 <CardDescription>Controls for how AutoGluon fits the models.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <Label>Presets</Label>
                       <Select defaultValue="medium">
                          <SelectTrigger>
                             <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                             <SelectItem value="fast">Fast (Lower Quality)</SelectItem>
                             <SelectItem value="medium">Medium (Balanced)</SelectItem>
                             <SelectItem value="high">High (Better Quality)</SelectItem>
                             <SelectItem value="best">Best (Highest Quality)</SelectItem>
                          </SelectContent>
                       </Select>
                       <p className="text-[10px] text-muted-foreground">AutoGluon quality presets.</p>
                    </div>
                    <div className="space-y-2">
                       <Label>Time Limit (seconds)</Label>
                       <Input type="number" defaultValue="600" />
                       <p className="text-[10px] text-muted-foreground">Max training time.</p>
                    </div>
                 </div>
                 <div className="flex items-center justify-between border p-3 rounded-md">
                    <div className="space-y-0.5">
                       <Label>Refit Full</Label>
                       <p className="text-[10px] text-muted-foreground">Refit models on all data (train + val) before inference.</p>
                    </div>
                    <Switch defaultChecked />
                 </div>
              </CardContent>
           </Card>
        </TabsContent>

        {/* --- MODELS & HYPERPARAMETERS TAB --- */}
        <TabsContent value="hyperparameters" className="space-y-6">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Sidebar: Model Selection */}
              <Card className="lg:col-span-1 h-fit">
                 <CardHeader className="pb-3">
                    <CardTitle className="text-base">Model Selection</CardTitle>
                    <CardDescription className="text-xs">Enable specific algorithms.</CardDescription>
                 </CardHeader>
                 <CardContent className="grid gap-4 max-h-[600px] overflow-y-auto pr-2">
                    {Object.entries(ALL_MODELS).reduce((acc, [key, info]) => {
                       // Group by category
                       const cat = info.category;
                       if (!acc[cat]) acc[cat] = [];
                       acc[cat].push({ key, ...info });
                       return acc;
                    }, {} as Record<string, any[]>).unknown_map_render_fix && null} 
                    
                    {/* Manual grouping rendering since reduce above is complex in JSX */}
                    {["Statistical", "Deep Learning", "Tree-Based", "Foundation", "Ensemble"].map(category => (
                       <div key={category} className="space-y-2">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{category}</h4>
                          {Object.entries(ALL_MODELS).filter(([_, m]) => m.category === category).map(([key, model]) => (
                             <div key={key} className="flex items-center space-x-2">
                                <Checkbox 
                                   id={`model-${key}`} 
                                   checked={selectedModels[key] || false}
                                   onCheckedChange={() => toggleModel(key)}
                                />
                                <Label htmlFor={`model-${key}`} className="text-sm font-normal cursor-pointer">{model.label}</Label>
                             </div>
                          ))}
                          <Separator className="my-2" />
                       </div>
                    ))}
                 </CardContent>
              </Card>

              {/* Main: Hyperparams Config */}
              <div className="lg:col-span-2 space-y-6">
                 {Object.entries(selectedModels).filter(([k, v]) => v).map(([key, _]) => (
                    <Card key={key}>
                       <CardHeader className="py-3">
                          <div className="flex justify-between items-center">
                             <CardTitle className="text-sm font-bold flex items-center gap-2">
                                {ALL_MODELS[key as keyof typeof ALL_MODELS]?.label} 
                                <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                                   {ALL_MODELS[key as keyof typeof ALL_MODELS]?.category}
                                </span>
                             </CardTitle>
                             {/* @ts-ignore */}
                             {modelParams[key] && (
                                <Button variant="ghost" size="sm" className="h-6 text-xs">Reset Default</Button>
                             )}
                          </div>
                       </CardHeader>
                       <CardContent className="py-3">
                          {/* @ts-ignore */}
                          {modelParams[key] ? (
                             <div className="grid grid-cols-2 gap-4">
                                {/* @ts-ignore */}
                                {Object.entries(modelParams[key]).map(([param, value]) => (
                                   <div key={param} className="space-y-1">
                                      <Label className="text-xs text-muted-foreground">{param}</Label>
                                      {typeof value === 'boolean' ? (
                                         <div className="flex items-center h-9">
                                            <Switch 
                                               checked={value} 
                                               onCheckedChange={(v) => updateModelParam(key, param, v)}
                                            />
                                         </div>
                                      ) : (
                                         <Input 
                                            className="h-8 text-sm" 
                                            value={value as any} 
                                            onChange={(e) => updateModelParam(key, param, e.target.value)}
                                         />
                                      )}
                                   </div>
                                ))}
                             </div>
                          ) : (
                             <p className="text-sm text-muted-foreground italic">No standard hyperparameters exposed for this model.</p>
                          )}
                       </CardContent>
                    </Card>
                 ))}
                 {Object.values(selectedModels).every(v => !v) && (
                    <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground border rounded-lg border-dashed">
                       <p>No models selected.</p>
                       <p className="text-sm">Select models from the sidebar to configure.</p>
                    </div>
                 )}
              </div>
           </div>
        </TabsContent>

        {/* --- GENERAL SYSTEM TAB --- */}
        <TabsContent value="general" className="space-y-6">
           <Card>
              <CardHeader>
                 <CardTitle>System & Environment</CardTitle>
                 <CardDescription>Compute resources and logging.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <Label>Number of CPUs</Label>
                       <Select defaultValue="auto">
                          <SelectTrigger>
                             <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                             <SelectItem value="auto">Auto (Detect)</SelectItem>
                             <SelectItem value="2">2 Cores</SelectItem>
                             <SelectItem value="4">4 Cores</SelectItem>
                             <SelectItem value="8">8 Cores</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label>Logging Level</Label>
                       <Select defaultValue="info">
                          <SelectTrigger>
                             <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                             <SelectItem value="error">Error Only</SelectItem>
                             <SelectItem value="info">Info (Standard)</SelectItem>
                             <SelectItem value="debug">Debug (Verbose)</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
