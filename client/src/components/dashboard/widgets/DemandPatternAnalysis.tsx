import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AlertCircle, Info } from 'lucide-react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Label as RechartsLabel, ReferenceArea } from 'recharts';

interface DemandPatternAnalysisProps {
  data?: {
    columns: string[];
    rows: any[];
    totalRows: number;
  };
}

function isNumeric(value: any): boolean {
  if (value === null || value === undefined || value === '') return false;
  return !isNaN(Number(value));
}

function isDateLike(value: any): boolean {
  if (value === null || value === undefined || value === '') return false;
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}/,
    /^\d{2}\/\d{2}\/\d{4}/,
    /^\d{2}-\d{2}-\d{4}/,
  ];
  const strVal = String(value);
  return datePatterns.some(p => p.test(strVal)) || !isNaN(Date.parse(strVal));
}

interface DFUData {
  id: string;
  adi: number;
  cv: number;
  volume: number;
  seasonality: number;
  type?: string;
}

export function DemandPatternAnalysis({ data }: DemandPatternAnalysisProps) {
  const [adiThreshold, setAdiThreshold] = useState([1.32]);
  const [cvThreshold, setCvThreshold] = useState([0.49]);
  const [activeQuadrant, setActiveQuadrant] = useState<string | null>(null);
  const [selectedIdColumn, setSelectedIdColumn] = useState<string>('');
  const [selectedValueColumn, setSelectedValueColumn] = useState<string>('');

  const analysis = useMemo(() => {
    if (!data || !data.rows.length || !data.columns.length) {
      return { hasValidData: false, columns: { id: [], numeric: [], date: null }, dfuData: [] };
    }

    const idColumns: string[] = [];
    const numericColumns: string[] = [];
    let dateColumn: string | null = null;

    data.columns.forEach(col => {
      let numericCount = 0;
      let dateCount = 0;
      const sampleSize = Math.min(data.rows.length, 50);
      
      for (let i = 0; i < sampleSize; i++) {
        const val = data.rows[i][col];
        if (isNumeric(val)) numericCount++;
        if (isDateLike(val)) dateCount++;
      }

      const threshold = sampleSize * 0.7;
      if (numericCount >= threshold) {
        numericColumns.push(col);
      } else if (dateCount >= threshold && !dateColumn) {
        dateColumn = col;
      } else {
        idColumns.push(col);
      }
    });

    return {
      hasValidData: numericColumns.length > 0 && (idColumns.length > 0 || dateColumn),
      columns: { id: idColumns, numeric: numericColumns, date: dateColumn }
    };
  }, [data]);

  const effectiveIdColumn = selectedIdColumn || analysis.columns.id[0] || '';
  const effectiveValueColumn = selectedValueColumn || analysis.columns.numeric[0] || '';

  const dfuData = useMemo(() => {
    if (!data || !effectiveIdColumn || !effectiveValueColumn) return [];

    const groupedData: Record<string, number[]> = {};
    
    data.rows.forEach(row => {
      const id = String(row[effectiveIdColumn] || 'Unknown');
      const value = Number(row[effectiveValueColumn]) || 0;
      
      if (!groupedData[id]) groupedData[id] = [];
      groupedData[id].push(value);
    });

    const result: DFUData[] = [];

    Object.entries(groupedData).forEach(([id, values]) => {
      // Allow single observations - they will have CV=0 (no variation measurable)
      if (values.length === 0) return;

      const nonZeroValues = values.filter(v => v > 0);
      
      // ADI = Average Demand Interval = total periods / demand periods
      const adi = values.length / (nonZeroValues.length || 1);
      
      const mean = nonZeroValues.length > 0 
        ? nonZeroValues.reduce((a, b) => a + b, 0) / nonZeroValues.length 
        : 0;
      
      // CV = Coefficient of Variation = std dev / mean
      // For single observation, CV = 0 (no variation can be measured)
      let cv = 0;
      if (mean > 0 && nonZeroValues.length > 1) {
        const variance = nonZeroValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / nonZeroValues.length;
        cv = Math.sqrt(variance) / mean;
      }
      
      const volume = values.reduce((a, b) => a + b, 0);
      
      const seasonality = Math.min(1, cv * 0.5);

      result.push({
        id,
        adi: Math.min(adi, 10),
        cv: Math.min(cv, 3),
        volume,
        seasonality
      });
    });

    return result;
  }, [data, effectiveIdColumn, effectiveValueColumn]);

  const stats = useMemo(() => {
    const adiLimit = adiThreshold[0];
    const cvLimit = cvThreshold[0];
    
    const quadrants = {
      smooth: { label: "Smooth", count: 0, volume: 0, color: "bg-green-100/50 text-green-800" },
      intermittent: { label: "Intermittent", count: 0, volume: 0, color: "bg-yellow-100/50 text-yellow-800" },
      erratic: { label: "Erratic", count: 0, volume: 0, color: "bg-orange-100/50 text-orange-800" },
      lumpy: { label: "Lumpy", count: 0, volume: 0, color: "bg-red-100/50 text-red-800" }
    };

    let totalVolume = 0;
    let totalCount = 0;
    let maxADI = 5;
    let maxCV = 2.5;

    const classifiedData = dfuData.map(point => {
      let type = '';
      
      if (point.adi > maxADI) maxADI = point.adi;
      if (point.cv > maxCV) maxCV = point.cv;

      if (point.cv < cvLimit) {
        if (point.adi < adiLimit) type = 'smooth';
        else type = 'intermittent';
      } else {
        if (point.adi < adiLimit) type = 'erratic';
        else type = 'lumpy';
      }

      quadrants[type as keyof typeof quadrants].count++;
      quadrants[type as keyof typeof quadrants].volume += point.volume;
      totalVolume += point.volume;
      totalCount++;

      return { ...point, type };
    });
    
    maxADI = maxADI * 1.05;
    maxCV = maxCV * 1.05;

    return { quadrants, totalVolume, totalCount, classifiedData, maxADI, maxCV };
  }, [dfuData, adiThreshold, cvThreshold]);

  const getPercentage = (val: number, total: number) => total > 0 ? ((val / total) * 100).toFixed(1) + '%' : '0%';
  const formatVolume = (val: number) => (val / 1000).toFixed(1) + 'k';

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded p-2 shadow-md text-xs z-50">
          <p className="font-semibold">{data.id}</p>
          <p>Type: <span className="capitalize">{data.type}</span></p>
          <p>CV: {data.cv.toFixed(2)}</p>
          <p>ADI: {data.adi.toFixed(2)}</p>
          <p>Volume: {data.volume.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  const QuadrantLabel = ({ viewBox, type, data: quadrantData }: any) => {
    if (!viewBox || !quadrantData) return null;
    const { x, y, width, height } = viewBox;
    if (!width || !height) return null;
    
    const isActive = activeQuadrant === type;

    return (
      <foreignObject x={x} y={y} width={width} height={height} style={{ pointerEvents: 'none', overflow: 'visible' }}>
        <div className="w-full h-full flex items-center justify-center p-2">
           <div 
             className={`
               backdrop-blur-md p-3 rounded-lg shadow-sm border border-slate-200/50 
               flex flex-col items-center justify-center min-w-[120px] transition-all duration-300
               ${quadrantData.color.replace('text-', 'border-').replace('bg-', 'bg-opacity-90 bg-')}
               ${isActive ? 'opacity-100 scale-110 z-50 shadow-lg ring-2 ring-offset-1 ring-slate-400' : 'opacity-60 scale-95'}
             `}
           >
             <h4 className="font-bold text-sm uppercase mb-1">{quadrantData.label}</h4>
             <div className="text-xs space-y-0.5 text-center w-full">
                <div className="font-medium flex justify-between gap-3 w-full">
                   <span>Count:</span>
                   <span>{quadrantData.count} <span className="opacity-70">({getPercentage(quadrantData.count, stats.totalCount)})</span></span>
                </div>
                <div className="font-medium flex justify-between gap-3 w-full">
                   <span>Vol:</span>
                   <span>{formatVolume(quadrantData.volume)} <span className="opacity-70">({getPercentage(quadrantData.volume, stats.totalVolume)})</span></span>
                </div>
             </div>
           </div>
        </div>
      </foreignObject>
    );
  };

  if (!data || !data.rows.length) {
    return (
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>Demand Pattern Analysis</CardTitle>
          <CardDescription>Classification of items based on variability (CV) and regularity (ADI)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No data available</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis.hasValidData || analysis.columns.numeric.length === 0 || analysis.columns.id.length === 0) {
    return (
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>Demand Pattern Analysis</CardTitle>
          <CardDescription>Classification of items based on variability (CV) and regularity (ADI)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center">
            <div className="text-center max-w-md">
              <Info className="w-12 h-12 mx-auto mb-4 text-blue-500" />
              <p className="font-medium text-lg mb-2">No demand pattern data available</p>
              <p className="text-muted-foreground text-sm mb-4">
                This analysis requires time series data with demand values.
              </p>
              <div className="bg-muted/50 rounded-lg p-4 text-left text-sm">
                <p className="font-medium mb-2">Required data format:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>An <strong>identifier column</strong> (SKU, Product ID, etc.)</li>
                  <li>A <strong>numeric demand/quantity column</strong></li>
                  <li>Multiple rows per identifier (time series)</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (dfuData.length === 0) {
    return (
      <Card className="col-span-4">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Demand Pattern Analysis</CardTitle>
              <CardDescription>Classification based on CV and ADI</CardDescription>
            </div>
            <div className="flex gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Group By</Label>
                <Select value={effectiveIdColumn} onValueChange={setSelectedIdColumn} data-testid="select-id-column">
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {analysis.columns.id.map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Demand Column</Label>
                <Select value={effectiveValueColumn} onValueChange={setSelectedValueColumn} data-testid="select-value-column">
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {analysis.columns.numeric.map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No groups found in the data</p>
              <p className="text-sm mt-1">Check that the selected columns contain valid data</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-4">
      <CardHeader>
        <div className="flex justify-between items-start flex-wrap gap-4">
           <div>
             <CardTitle>Demand Pattern Analysis</CardTitle>
             <CardDescription>
               Classification of {dfuData.length} items based on variability (CV) and regularity (ADI)
             </CardDescription>
           </div>
           <div className="flex gap-4 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Group By</Label>
                <Select value={effectiveIdColumn} onValueChange={setSelectedIdColumn} data-testid="select-id-column">
                  <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-id-trigger">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {analysis.columns.id.map(col => (
                      <SelectItem key={col} value={col} data-testid={`id-option-${col}`}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Demand Column</Label>
                <Select value={effectiveValueColumn} onValueChange={setSelectedValueColumn} data-testid="select-value-column">
                  <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-value-trigger">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {analysis.columns.numeric.map(col => (
                      <SelectItem key={col} value={col} data-testid={`value-option-${col}`}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 w-40">
                 <div className="flex justify-between text-xs">
                    <span className="font-medium">CV Threshold</span>
                    <span>{cvThreshold[0]}</span>
                 </div>
                 <Slider 
                    value={cvThreshold} 
                    onValueChange={setCvThreshold} 
                    min={0.1} 
                    max={1.5} 
                    step={0.01}
                    data-testid="slider-cv"
                 />
              </div>
              <div className="space-y-2 w-40">
                 <div className="flex justify-between text-xs">
                    <span className="font-medium">ADI Threshold</span>
                    <span>{adiThreshold[0]}</span>
                 </div>
                 <Slider 
                    value={adiThreshold} 
                    onValueChange={setAdiThreshold} 
                    min={1.0} 
                    max={3.0} 
                    step={0.01}
                    data-testid="slider-adi"
                 />
              </div>
           </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[500px] w-full relative border rounded-md bg-slate-50/30" data-testid="demand-pattern-chart">
            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  
                  <ReferenceArea 
                    x1={0} x2={cvThreshold[0]} 
                    y1={0} y2={adiThreshold[0]} 
                    fill="#dcfce7" fillOpacity={0.4}
                    onMouseEnter={() => setActiveQuadrant('smooth')}
                    onMouseLeave={() => setActiveQuadrant(null)}
                  />

                  <ReferenceArea 
                    x1={0} x2={cvThreshold[0]} 
                    y1={adiThreshold[0]} y2={stats.maxADI} 
                    fill="#fef9c3" fillOpacity={0.4}
                    onMouseEnter={() => setActiveQuadrant('intermittent')}
                    onMouseLeave={() => setActiveQuadrant(null)}
                  />

                  <ReferenceArea 
                    x1={cvThreshold[0]} x2={stats.maxCV} 
                    y1={0} y2={adiThreshold[0]} 
                    fill="#ffedd5" fillOpacity={0.4}
                    onMouseEnter={() => setActiveQuadrant('erratic')}
                    onMouseLeave={() => setActiveQuadrant(null)}
                  />

                  <ReferenceArea 
                    x1={cvThreshold[0]} x2={stats.maxCV} 
                    y1={adiThreshold[0]} y2={stats.maxADI} 
                    fill="#fee2e2" fillOpacity={0.4}
                    onMouseEnter={() => setActiveQuadrant('lumpy')}
                    onMouseLeave={() => setActiveQuadrant(null)}
                  />

                  <XAxis 
                      type="number" 
                      dataKey="cv" 
                      name="CV" 
                      label={{ value: 'Coefficient of Variation (CV)', position: 'bottom', offset: 0 }} 
                      domain={[0, stats.maxCV]}
                  />
                  <YAxis 
                      type="number" 
                      dataKey="adi" 
                      name="ADI" 
                      label={{ value: 'Average Demand Interval (ADI)', angle: -90, position: 'left' }} 
                      domain={[0, stats.maxADI]}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                  
                  <Scatter 
                      data={stats.classifiedData} 
                      fill="#8884d8"
                      shape={(props: any) => {
                        const { cx, cy, payload } = props;
                        const r = Math.round(255 * payload.seasonality);
                        const b = Math.round(255 * (1 - payload.seasonality));
                        const fill = `rgb(${r}, 0, ${b})`;
                        
                        return <circle cx={cx} cy={cy} r={5} fill={fill} opacity={0.8} stroke="#fff" strokeWidth={1} />;
                      }}
                  />
                  
                  <ReferenceLine x={cvThreshold[0]} stroke="#334155" strokeWidth={2} strokeDasharray="5 5" />
                  <ReferenceLine y={adiThreshold[0]} stroke="#334155" strokeWidth={2} strokeDasharray="5 5" />

                   <ReferenceArea x1={0} x2={cvThreshold[0]} y1={0} y2={adiThreshold[0]} fill="none">
                    <RechartsLabel content={(props: any) => <QuadrantLabel {...props} type="smooth" data={stats.quadrants.smooth} />} />
                   </ReferenceArea>

                   <ReferenceArea x1={0} x2={cvThreshold[0]} y1={adiThreshold[0]} y2={stats.maxADI} fill="none">
                     <RechartsLabel content={(props: any) => <QuadrantLabel {...props} type="intermittent" data={stats.quadrants.intermittent} />} />
                   </ReferenceArea>

                   <ReferenceArea x1={cvThreshold[0]} x2={stats.maxCV} y1={0} y2={adiThreshold[0]} fill="none">
                     <RechartsLabel content={(props: any) => <QuadrantLabel {...props} type="erratic" data={stats.quadrants.erratic} />} />
                   </ReferenceArea>

                   <ReferenceArea x1={cvThreshold[0]} x2={stats.maxCV} y1={adiThreshold[0]} y2={stats.maxADI} fill="none">
                     <RechartsLabel content={(props: any) => <QuadrantLabel {...props} type="lumpy" data={stats.quadrants.lumpy} />} />
                   </ReferenceArea>

                </ScatterChart>
            </ResponsiveContainer>

            <div className="absolute top-2 right-2 bg-white/90 p-2 rounded border text-[10px] shadow-sm z-10">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">Variability</span>
                </div>
                <div className="h-2 w-24 bg-gradient-to-r from-blue-600 to-red-600 rounded-full" />
                <div className="flex justify-between text-muted-foreground mt-1">
                  <span>Low</span>
                  <span>High</span>
                </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
