import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const outliers = [
  { id: 'SKU-1029', date: '2023-11-15', value: 12400, mean: 1200, zScore: 8.5, reason: 'Spike' },
  { id: 'SKU-5521', date: '2023-12-01', value: 0, mean: 500, zScore: -2.1, reason: 'Zero Value' },
  { id: 'SKU-3392', date: '2023-10-22', value: 45000, mean: 2300, zScore: 12.1, reason: 'Extreme' },
  { id: 'SKU-1122', date: '2023-09-05', value: -50, mean: 120, zScore: -4.5, reason: 'Negative' },
];

const mockHistoryData = [
   { date: '2023-01', value: 1100 },
   { date: '2023-02', value: 1200 },
   { date: '2023-03', value: 1150 },
   { date: '2023-04', value: 1250 },
   { date: '2023-05', value: 1300 },
   { date: '2023-06', value: 1180 },
   { date: '2023-07', value: 1220 },
   { date: '2023-08', value: 1210 },
   { date: '2023-09', value: 1240 },
   { date: '2023-10', value: 1260 },
   { date: '2023-11', value: 12400 }, // The spike
   { date: '2023-12', value: 1280 },
];

export function OutlierTable() {
  const [selectedAnomaly, setSelectedAnomaly] = useState<any>(null);

  return (
    <>
       <Card className="col-span-2">
         <CardHeader>
           <CardTitle>Top Anomalies</CardTitle>
           <CardDescription>Records exceeding 3σ deviation or logic checks</CardDescription>
         </CardHeader>
         <CardContent>
           <Table>
             <TableHeader>
               <TableRow>
                 <TableHead>DFU ID</TableHead>
                 <TableHead>Date</TableHead>
                 <TableHead className="text-right">Value</TableHead>
                 <TableHead>Issue</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {outliers.map((row) => (
                 <TableRow 
                     key={row.id + row.date} 
                     className="cursor-pointer hover:bg-muted/50"
                     onClick={() => setSelectedAnomaly(row)}
                  >
                   <TableCell className="font-medium text-xs">{row.id}</TableCell>
                   <TableCell className="text-xs text-muted-foreground">{row.date}</TableCell>
                   <TableCell className="text-right text-xs font-mono">{row.value}</TableCell>
                   <TableCell>
                     <Badge 
                       variant="outline" 
                       className={
                         row.reason === 'Negative' ? "text-destructive border-destructive" :
                         row.reason === 'Zero Value' ? "text-amber-500 border-amber-500" :
                         "text-blue-500 border-blue-500"
                       }
                     >
                       {row.reason}
                     </Badge>
                   </TableCell>
                 </TableRow>
               ))}
             </TableBody>
           </Table>
         </CardContent>
       </Card>

       <Dialog open={!!selectedAnomaly} onOpenChange={(open) => !open && setSelectedAnomaly(null)}>
         <DialogContent className="sm:max-w-[600px]">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               Anomaly Detail: <span className="font-mono text-primary">{selectedAnomaly?.id}</span>
             </DialogTitle>
             <DialogDescription>
               Detected issue: <span className="font-medium text-foreground">{selectedAnomaly?.reason}</span> on {selectedAnomaly?.date}
             </DialogDescription>
           </DialogHeader>
           
           <div className="space-y-6 pt-4">
              <div className="grid grid-cols-3 gap-4">
                 <div className="p-3 border rounded-md bg-muted/20">
                    <p className="text-xs text-muted-foreground">Reported Value</p>
                    <p className="text-xl font-bold font-mono">{selectedAnomaly?.value}</p>
                 </div>
                 <div className="p-3 border rounded-md bg-muted/20">
                    <p className="text-xs text-muted-foreground">Historical Mean</p>
                    <p className="text-xl font-bold font-mono">{selectedAnomaly?.mean}</p>
                 </div>
                 <div className="p-3 border rounded-md bg-muted/20">
                    <p className="text-xs text-muted-foreground">Z-Score</p>
                    <p className={`text-xl font-bold font-mono ${selectedAnomaly?.zScore > 3 ? 'text-destructive' : 'text-foreground'}`}>
                       {selectedAnomaly?.zScore}σ
                    </p>
                 </div>
              </div>

              <div className="h-[200px] w-full border rounded-md p-2">
                 <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={mockHistoryData}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                       <XAxis dataKey="date" hide />
                       <Tooltip 
                          contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }}
                          labelStyle={{ color: 'hsl(var(--foreground))' }}
                       />
                       <Line 
                          type="monotone" 
                          dataKey="value" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          dot={{ r: 2 }} 
                       />
                    </LineChart>
                 </ResponsiveContainer>
              </div>

              <div>
                 <p className="text-sm font-medium mb-2">Raw Record Data</p>
                 <div className="border rounded-md overflow-hidden">
                    <Table>
                       <TableHeader>
                          <TableRow className="bg-muted/50">
                             <TableHead className="h-8">Field</TableHead>
                             <TableHead className="h-8">Value</TableHead>
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          <TableRow>
                             <TableCell className="py-2 text-xs font-medium">Product Category</TableCell>
                             <TableCell className="py-2 text-xs">Electronics</TableCell>
                          </TableRow>
                          <TableRow>
                             <TableCell className="py-2 text-xs font-medium">Region</TableCell>
                             <TableCell className="py-2 text-xs">North America</TableCell>
                          </TableRow>
                          <TableRow>
                             <TableCell className="py-2 text-xs font-medium">Source File</TableCell>
                             <TableCell className="py-2 text-xs">sales_q3_raw.csv</TableCell>
                          </TableRow>
                       </TableBody>
                    </Table>
                 </div>
              </div>
           </div>
         </DialogContent>
       </Dialog>
    </>
  );
}