import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { format, subDays, addDays } from 'date-fns';

export function DataCompletenessChart() {
  // Generate mock data representing record counts over time
  // This simulates data where some dates might have fewer records (missing data)
  const data = useMemo(() => {
    const result = [];
    const startDate = subDays(new Date(), 365);
    
    for (let i = 0; i < 365; i++) {
      const currentDate = addDays(startDate, i);
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
      
      // Simulate variable record counts
      // Base count: 100
      // Weekends: lower counts (sometimes missing)
      // Random drops to simulate outages
      let recordCount = 100;
      let minTime = "00:00:00";
      let maxTime = "23:59:59";
      
      if (isWeekend) {
        recordCount = Math.floor(Math.random() * 20) + 80; // 80-100 records
      } else {
        recordCount = Math.floor(Math.random() * 10) + 95; // 95-105 records
      }
      
      // Simulate a data outage on a specific range
      if (i > 150 && i < 155) {
        recordCount = Math.floor(Math.random() * 50); // Significant drop
      }

      // Simulate gaps in min/max time (e.g., data arrived late or stopped early)
      if (recordCount < 80) {
        minTime = "08:00:00"; 
        maxTime = "16:00:00";
      }

      result.push({
        date: format(currentDate, 'yyyy-MM-dd'),
        count: recordCount,
        minTime,
        maxTime,
        expected: 100
      });
    }
    return result;
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Completeness Over Time</CardTitle>
        <CardDescription>
          Daily record counts and time coverage. Drops indicate potential missing data or outages.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(val) => format(new Date(val), 'MMM d')}
                minTickGap={30}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6B7280' }}
              />
              <YAxis 
                yAxisId="left"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6B7280' }}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}
                formatter={(value: any, name: any) => {
                  if (name === "Record Count") return [value, "Records"];
                  return [value, name];
                }}
                labelFormatter={(label) => format(new Date(label), 'MMM d, yyyy')}
              />
              <Legend />
              
              <Bar 
                yAxisId="left"
                dataKey="count" 
                name="Record Count" 
                fill="#3b82f6" 
                radius={[4, 4, 0, 0]}
                opacity={0.8}
              />
              
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="expected" 
                name="Expected Count" 
                stroke="#ef4444" 
                strokeWidth={2}
                dot={false}
                strokeDasharray="5 5"
              />

            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
