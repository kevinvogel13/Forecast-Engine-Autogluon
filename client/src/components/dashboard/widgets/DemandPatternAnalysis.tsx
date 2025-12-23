import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Label } from 'recharts';

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

  const stats = useMemo(() => {
    const adiLimit = adiThreshold[0];
    const cvLimit = cvThreshold[0];
    
    const quadrants = {
      smooth: { label: "Smooth", count: 0, volume: 0, color: "bg-blue-100 text-blue-800" },       // Low ADI, Low CV
      intermittent: { label: "Intermittent", count: 0, volume: 0, color: "bg-yellow-100 text-yellow-800" }, // High ADI, Low CV
      erratic: { label: "Erratic", count: 0, volume: 0, color: "bg-orange-100 text-orange-800" },      // Low ADI, High CV
      lumpy: { label: "Lumpy", count: 0, volume: 0, color: "bg-red-100 text-red-800" }            // High ADI, High CV
    };

    let totalVolume = 0;
    let totalCount = 0;

    const classifiedData = MOCK_DATA.map(point => {
      let type = '';
      if (point.adi < adiLimit) {
        if (point.cv < cvLimit) type = 'smooth';
        else type = 'erratic';
      } else {
        if (point.cv < cvLimit) type = 'intermittent';
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

    return { quadrants, totalVolume, totalCount, classifiedData };
  }, [adiThreshold, cvThreshold]);

  const getPercentage = (val: number, total: number) => ((val / total) * 100).toFixed(1) + '%';
  const formatVolume = (val: number) => (val / 1000).toFixed(1) + 'k';

  // Custom tooltip for the scatter plot
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded p-2 shadow-md text-xs">
          <p className="font-semibold">{data.id}</p>
          <p>Type: <span className="capitalize">{data.type}</span></p>
          <p>ADI: {data.adi.toFixed(2)}</p>
          <p>CV: {data.cv.toFixed(2)}</p>
          <p>Volume: {data.volume.toLocaleString()}</p>
          <p>Seasonality: {(data.seasonality * 100).toFixed(0)}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="col-span-4">
      <CardHeader>
        <div className="flex justify-between items-start">
           <div>
             <CardTitle>Demand Pattern Analysis</CardTitle>
             <CardDescription>
               Classification of DFUs based on regularity (ADI) and variability (CV).
             </CardDescription>
           </div>
           <div className="flex gap-8 text-xs">
              <div className="space-y-2 w-48">
                 <div className="flex justify-between">
                    <span className="font-medium">ADI Threshold</span>
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
              <div className="space-y-2 w-48">
                 <div className="flex justify-between">
                    <span className="font-medium">CV Threshold</span>
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
           </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {/* Chart Area */}
           <div className="lg:col-span-2 h-[400px] relative border rounded-md bg-slate-50/50">
              <ResponsiveContainer width="100%" height="100%">
                 <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                       type="number" 
                       dataKey="adi" 
                       name="ADI" 
                       label={{ value: 'Average Demand Interval (ADI)', position: 'bottom', offset: 0 }} 
                       domain={[0.8, 'auto']}
                    />
                    <YAxis 
                       type="number" 
                       dataKey="cv" 
                       name="CV" 
                       label={{ value: 'Coefficient of Variation (CV)', angle: -90, position: 'left' }} 
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                    
                    {/* Threshold Lines */}
                    <ReferenceLine x={adiThreshold[0]} stroke="black" strokeDasharray="3 3" />
                    <ReferenceLine y={cvThreshold[0]} stroke="black" strokeDasharray="3 3" />

                    {/* Quadrant Labels - Approximate positioning */}
                    <ReferenceLine x={1} label={{ value: "SMOOTH", position: 'insideTopLeft', fill: '#64748b', fontSize: 10 }} stroke="none" />
                    <ReferenceLine x={3} label={{ value: "INTERMITTENT", position: 'insideTopLeft', fill: '#64748b', fontSize: 10 }} stroke="none" />
                    
                    <Scatter 
                       data={stats.classifiedData} 
                       fill="#8884d8"
                       shape={(props: any) => {
                          const { cx, cy, payload } = props;
                          // Color gradient from Blue (0) to Red (1) based on seasonality
                          const r = Math.round(255 * payload.seasonality);
                          const b = Math.round(255 * (1 - payload.seasonality));
                          const fill = `rgb(${r}, 0, ${b})`;
                          
                          return <circle cx={cx} cy={cy} r={4} fill={fill} opacity={0.7} />;
                       }}
                    />
                 </ScatterChart>
              </ResponsiveContainer>
              
              {/* Legend for Seasonality */}
              <div className="absolute top-2 right-2 bg-white/90 p-2 rounded border text-[10px] shadow-sm">
                 <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">Seasonality</span>
                 </div>
                 <div className="h-2 w-24 bg-gradient-to-r from-blue-600 to-red-600 rounded-full" />
                 <div className="flex justify-between text-muted-foreground mt-1">
                    <span>Non-Seasonal</span>
                    <span>Seasonal</span>
                 </div>
              </div>
           </div>

           {/* Summary Quadrant Stats */}
           <div className="grid grid-cols-2 gap-4 h-full content-start">
              {Object.entries(stats.quadrants).map(([key, data]) => (
                 <div key={key} className={`p-4 rounded-lg border ${data.color} flex flex-col justify-between h-[190px]`}>
                    <div>
                       <h4 className="font-bold text-lg mb-1">{data.label}</h4>
                       <p className="text-xs opacity-80 mb-4">
                          {key === 'smooth' && "Low ADI, Low CV"}
                          {key === 'erratic' && "Low ADI, High CV"}
                          {key === 'intermittent' && "High ADI, Low CV"}
                          {key === 'lumpy' && "High ADI, High CV"}
                       </p>
                    </div>
                    
                    <div className="space-y-3">
                       <div>
                          <p className="text-xs uppercase tracking-wider font-semibold opacity-70">DFU Count</p>
                          <div className="flex items-baseline gap-2">
                             <span className="text-2xl font-bold">{data.count}</span>
                             <span className="text-sm opacity-80">({getPercentage(data.count, stats.totalCount)})</span>
                          </div>
                       </div>
                       
                       <div>
                          <p className="text-xs uppercase tracking-wider font-semibold opacity-70">Volume</p>
                          <div className="flex items-baseline gap-2">
                             <span className="text-xl font-bold">{formatVolume(data.volume)}</span>
                             <span className="text-xs opacity-80">({getPercentage(data.volume, stats.totalVolume)})</span>
                          </div>
                       </div>
                    </div>
                 </div>
              ))}
           </div>
        </div>
      </CardContent>
    </Card>
  );
}
