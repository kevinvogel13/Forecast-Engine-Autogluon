import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Label, ReferenceArea } from 'recharts';

// Mock data generation for DFU analysis
const generateMockDFUs = (count = 200) => {
  return Array.from({ length: count }, (_, i) => {
    // Generate realistic ADI and CV values
    // ADI: 1 to 5
    // CV: 0 to 2
    const adi = 1 + Math.random() * 4 * (Math.random() > 0.7 ? 1 : 0.2); // Skew towards lower ADI
    const cv = Math.random() * 2 * (Math.random() > 0.6 ? 1 : 0.3); // Skew towards lower CV
    
    // Simulate volume based on pattern (Smooth items tend to have higher volume)
    let volumeBase = 1000;
    if (adi < 1.32 && cv < 0.49) volumeBase = 5000; // Smooth
    else if (adi >= 1.32 && cv >= 0.49) volumeBase = 200; // Lumpy
    
    const volume = Math.floor(volumeBase * (0.5 + Math.random()));
    
    // Seasonality score (0 to 1)
    // Smooth items more likely to be seasonal
    const isLikelySeasonal = adi < 1.5 && cv < 1.0;
    const seasonality = isLikelySeasonal 
      ? 0.5 + Math.random() * 0.5 
      : Math.random() * 0.4;

    return {
      id: `DFU-${i + 1}`,
      adi,
      cv, // This is CV (not CV squared for this visualization, usually people plot CV vs ADI)
      volume,
      seasonality, // 0 (blue/not seasonal) -> 1 (red/seasonal)
    };
  });
};

const MOCK_DATA = generateMockDFUs(200);

export function DemandPatternAnalysis() {
  const [adiThreshold, setAdiThreshold] = useState([1.32]);
  const [cvThreshold, setCvThreshold] = useState([0.49]);

  const [activeQuadrant, setActiveQuadrant] = useState<string | null>(null);

  const stats = useMemo(() => {
    const adiLimit = adiThreshold[0];
    const cvLimit = cvThreshold[0];
    
    // Updated Colors
    const quadrants = {
      smooth: { label: "Smooth", count: 0, volume: 0, color: "bg-green-100/50 text-green-800" },       // Low CV, Low ADI
      intermittent: { label: "Intermittent", count: 0, volume: 0, color: "bg-yellow-100/50 text-yellow-800" }, // Low CV, High ADI
      erratic: { label: "Erratic", count: 0, volume: 0, color: "bg-orange-100/50 text-orange-800" },      // High CV, Low ADI
      lumpy: { label: "Lumpy", count: 0, volume: 0, color: "bg-red-100/50 text-red-800" }            // High CV, High ADI
    };

    let totalVolume = 0;
    let totalCount = 0;
    
    // Calculate Max values for domain scaling
    // Use fixed reasonable bounds as baseline (e.g., ADI=5, CV=2) but expand if data demands it
    let maxADI = 5; 
    let maxCV = 2.5;  

    const classifiedData = MOCK_DATA.map(point => {
      let type = '';
      
      // Track Max
      if (point.adi > maxADI) maxADI = point.adi;
      if (point.cv > maxCV) maxCV = point.cv;

      if (point.cv < cvLimit) {
        if (point.adi < adiLimit) type = 'smooth';
        else type = 'intermittent';
      } else {
        if (point.adi < adiLimit) type = 'erratic';
        else type = 'lumpy';
      }

      // @ts-ignore
      quadrants[type].count++;
      // @ts-ignore
      quadrants[type].volume += point.volume;
      totalVolume += point.volume;
      totalCount++;

      return { ...point, type };
    });
    
    // Add some padding to domains
    maxADI = maxADI * 1.05;
    maxCV = maxCV * 1.05;

    return { quadrants, totalVolume, totalCount, classifiedData, maxADI, maxCV };
  }, [adiThreshold, cvThreshold]);



  const getPercentage = (val: number, total: number) => ((val / total) * 100).toFixed(1) + '%';
  const formatVolume = (val: number) => (val / 1000).toFixed(1) + 'k';

  // Custom tooltip for the scatter plot
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
          <p>Seasonality: {(data.seasonality * 100).toFixed(0)}%</p>
        </div>
      );
    }
    return null;
  };

  const QuadrantLabel = ({ viewBox, type, data }: any) => {
    // Recharts passes viewBox in props for Label content component inside ReferenceArea
    if (!viewBox || !data) return null;
    const { x, y, width, height } = viewBox;
    if (!width || !height) return null;
    
    const isActive = activeQuadrant === type;

    // Position exactly in center of the ReferenceArea
    return (
      <foreignObject x={x} y={y} width={width} height={height} style={{ pointerEvents: 'none', overflow: 'visible' }}>
        <div className="w-full h-full flex items-center justify-center p-2">
           <div 
             className={`
               backdrop-blur-md p-3 rounded-lg shadow-sm border border-slate-200/50 
               flex flex-col items-center justify-center min-w-[120px] transition-all duration-300
               ${data.color.replace('text-', 'border-').replace('bg-', 'bg-opacity-90 bg-')}
               ${isActive ? 'opacity-100 scale-110 z-50 shadow-lg ring-2 ring-offset-1 ring-slate-400' : 'opacity-60 scale-95'}
             `}
           >
             <h4 className="font-bold text-sm uppercase mb-1">{data.label}</h4>
             <div className="text-xs space-y-0.5 text-center w-full">
                <div className="font-medium flex justify-between gap-3 w-full">
                   <span>Count:</span>
                   <span>{data.count} <span className="opacity-70">({getPercentage(data.count, stats.totalCount)})</span></span>
                </div>
                <div className="font-medium flex justify-between gap-3 w-full">
                   <span>Vol:</span>
                   <span>{formatVolume(data.volume)} <span className="opacity-70">({getPercentage(data.volume, stats.totalVolume)})</span></span>
                </div>
             </div>
           </div>
        </div>
      </foreignObject>
    );
  };


  return (
    <Card className="col-span-4">
      <CardHeader>
        <div className="flex justify-between items-start">
           <div>
             <CardTitle>Demand Pattern Analysis</CardTitle>
             <CardDescription>
               Classification of DFUs based on variability (CV) and regularity (ADI).
             </CardDescription>
           </div>
           <div className="flex gap-8 text-xs">
              <div className="space-y-2 w-48">
                 <div className="flex justify-between">
                    <span className="font-medium">CV Threshold (X)</span>
                    <span>{cvThreshold[0]}</span>
                 </div>
                 <Slider 
                    value={cvThreshold} 
                    onValueChange={setCvThreshold} 
                    min={0.1} 
                    max={1.5} 
                    step={0.01} 
                 />
              </div>
              <div className="space-y-2 w-48">
                 <div className="flex justify-between">
                    <span className="font-medium">ADI Threshold (Y)</span>
                    <span>{adiThreshold[0]}</span>
                 </div>
                 <Slider 
                    value={adiThreshold} 
                    onValueChange={setAdiThreshold} 
                    min={1.0} 
                    max={3.0} 
                    step={0.01} 
                 />
              </div>
           </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[500px] w-full relative border rounded-md bg-slate-50/30">
            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  
                  {/* Background Areas for Event Capture and Coloring */}
                  {/* These are rendered FIRST so they are behind the scatter points */}
                  
                  {/* Smooth (Bottom Left) */}
                  <ReferenceArea 
                    x1={0} x2={cvThreshold[0]} 
                    y1={0} y2={adiThreshold[0]} 
                    fill="#dcfce7" fillOpacity={0.4} // Green
                    onMouseEnter={() => setActiveQuadrant('smooth')}
                    onMouseLeave={() => setActiveQuadrant(null)}
                  />

                  {/* Intermittent (Top Left) */}
                  <ReferenceArea 
                    x1={0} x2={cvThreshold[0]} 
                    y1={adiThreshold[0]} y2={stats.maxADI} 
                    fill="#fef9c3" fillOpacity={0.4} // Yellow
                    onMouseEnter={() => setActiveQuadrant('intermittent')}
                    onMouseLeave={() => setActiveQuadrant(null)}
                  />

                  {/* Erratic (Bottom Right) */}
                  <ReferenceArea 
                    x1={cvThreshold[0]} x2={stats.maxCV} 
                    y1={0} y2={adiThreshold[0]} 
                    fill="#ffedd5" fillOpacity={0.4} // Orange
                    onMouseEnter={() => setActiveQuadrant('erratic')}
                    onMouseLeave={() => setActiveQuadrant(null)}
                  />

                  {/* Lumpy (Top Right) */}
                  <ReferenceArea 
                    x1={cvThreshold[0]} x2={stats.maxCV} 
                    y1={adiThreshold[0]} y2={stats.maxADI} 
                    fill="#fee2e2" fillOpacity={0.4} // Red
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
                        // Color gradient from Blue (0) to Red (1) based on seasonality
                        const r = Math.round(255 * payload.seasonality);
                        const b = Math.round(255 * (1 - payload.seasonality));
                        const fill = `rgb(${r}, 0, ${b})`;
                        
                        return <circle cx={cx} cy={cy} r={5} fill={fill} opacity={0.8} stroke="#fff" strokeWidth={1} />;
                      }}
                  />
                  
                  {/* Foreground Labels (No Fill, Just Text) - Rendered LAST to be on top */}
                  {/* Threshold Lines */}
                  <ReferenceLine x={cvThreshold[0]} stroke="#334155" strokeWidth={2} strokeDasharray="5 5" />
                  <ReferenceLine y={adiThreshold[0]} stroke="#334155" strokeWidth={2} strokeDasharray="5 5" />

                   {/* Smooth Label */}
                   <ReferenceArea x1={0} x2={cvThreshold[0]} y1={0} y2={adiThreshold[0]} fill="none">
                    <Label content={(props: any) => <QuadrantLabel {...props} type="smooth" data={stats.quadrants.smooth} />} />
                   </ReferenceArea>

                   {/* Intermittent Label */}
                   <ReferenceArea x1={0} x2={cvThreshold[0]} y1={adiThreshold[0]} y2={stats.maxADI} fill="none">
                     <Label content={(props: any) => <QuadrantLabel {...props} type="intermittent" data={stats.quadrants.intermittent} />} />
                   </ReferenceArea>

                   {/* Erratic Label */}
                   <ReferenceArea x1={cvThreshold[0]} x2={stats.maxCV} y1={0} y2={adiThreshold[0]} fill="none">
                     <Label content={(props: any) => <QuadrantLabel {...props} type="erratic" data={stats.quadrants.erratic} />} />
                   </ReferenceArea>

                   {/* Lumpy Label */}
                   <ReferenceArea x1={cvThreshold[0]} x2={stats.maxCV} y1={adiThreshold[0]} y2={stats.maxADI} fill="none">
                     <Label content={(props: any) => <QuadrantLabel {...props} type="lumpy" data={stats.quadrants.lumpy} />} />
                   </ReferenceArea>

                </ScatterChart>
            </ResponsiveContainer>

            
            {/* Legend for Seasonality */}
            <div className="absolute top-2 right-2 bg-white/90 p-2 rounded border text-[10px] shadow-sm z-10">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">Seasonality</span>
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
