import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle } from 'lucide-react';

interface OutlierTableProps {
  data?: {
    columns: string[];
    rows: any[];
    totalRows: number;
  };
}

interface Outlier {
  rowIndex: number;
  column: string;
  value: number;
  mean: number;
  std: number;
  zScore: number;
  reason: string;
  rowData: Record<string, any>;
}

function isNumeric(value: any): boolean {
  if (value === null || value === undefined || value === '') return false;
  return !isNaN(Number(value));
}

export function OutlierTable({ data }: OutlierTableProps) {
  const [selectedOutlier, setSelectedOutlier] = useState<Outlier | null>(null);

  const { outliers, numericColumns } = useMemo(() => {
    if (!data || !data.rows.length || !data.columns.length) {
      return { outliers: [], numericColumns: [] };
    }

    const numericColumns: string[] = [];
    const columnStats: Record<string, { values: number[]; mean: number; std: number }> = {};

    data.columns.forEach(col => {
      const values: number[] = [];
      const sampleSize = Math.min(data.rows.length, 100);
      let numericCount = 0;
      
      for (let i = 0; i < sampleSize; i++) {
        const val = data.rows[i][col];
        if (isNumeric(val)) {
          numericCount++;
        }
      }

      if (numericCount >= sampleSize * 0.7) {
        numericColumns.push(col);
        
        data.rows.forEach(row => {
          const val = row[col];
          if (isNumeric(val)) {
            values.push(Number(val));
          }
        });

        if (values.length > 0) {
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
          const std = Math.sqrt(variance);
          
          columnStats[col] = { values, mean, std };
        }
      }
    });

    const detectedOutliers: Outlier[] = [];

    data.rows.forEach((row, rowIndex) => {
      numericColumns.forEach(col => {
        const val = row[col];
        if (!isNumeric(val)) return;
        
        const numVal = Number(val);
        const stats = columnStats[col];
        
        if (!stats || stats.std === 0) return;
        
        const zScore = (numVal - stats.mean) / stats.std;
        
        if (Math.abs(zScore) > 3) {
          let reason = 'Extreme';
          if (numVal < 0 && stats.mean >= 0) reason = 'Negative';
          else if (numVal === 0 && stats.mean > 10) reason = 'Zero Value';
          else if (zScore > 0) reason = 'Spike';
          else reason = 'Drop';
          
          detectedOutliers.push({
            rowIndex,
            column: col,
            value: numVal,
            mean: Math.round(stats.mean * 100) / 100,
            std: Math.round(stats.std * 100) / 100,
            zScore: Math.round(zScore * 10) / 10,
            reason,
            rowData: row
          });
        }
      });
    });

    detectedOutliers.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));

    return { 
      outliers: detectedOutliers.slice(0, 20), 
      numericColumns 
    };
  }, [data]);

  if (!data || !data.rows.length) {
    return (
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Top Anomalies</CardTitle>
          <CardDescription>Records exceeding 3σ deviation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No data available</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (numericColumns.length === 0) {
    return (
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Top Anomalies</CardTitle>
          <CardDescription>Records exceeding 3σ deviation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No numeric columns detected</p>
              <p className="text-sm mt-1">Outlier detection requires numeric data</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (outliers.length === 0) {
    return (
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Top Anomalies</CardTitle>
          <CardDescription>Records exceeding 3σ deviation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <div className="text-4xl mb-2">✓</div>
              <p className="text-green-600 font-medium">No outliers detected</p>
              <p className="text-sm mt-1">All numeric values are within 3 standard deviations</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
       <Card className="col-span-2">
         <CardHeader>
           <CardTitle>Top Anomalies</CardTitle>
           <CardDescription>Records exceeding 3σ deviation ({outliers.length} found)</CardDescription>
         </CardHeader>
         <CardContent>
           <Table data-testid="outlier-table">
             <TableHeader>
               <TableRow>
                 <TableHead>Row</TableHead>
                 <TableHead>Column</TableHead>
                 <TableHead className="text-right">Value</TableHead>
                 <TableHead className="text-right">Z-Score</TableHead>
                 <TableHead>Issue</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {outliers.slice(0, 10).map((row, idx) => (
                 <TableRow 
                     key={`${row.rowIndex}-${row.column}-${idx}`} 
                     className="cursor-pointer hover:bg-muted/50"
                     onClick={() => setSelectedOutlier(row)}
                     data-testid={`outlier-row-${idx}`}
                  >
                   <TableCell className="font-medium text-xs">{row.rowIndex + 1}</TableCell>
                   <TableCell className="text-xs text-muted-foreground">{row.column}</TableCell>
                   <TableCell className="text-right text-xs font-mono">{row.value.toLocaleString()}</TableCell>
                   <TableCell className="text-right text-xs font-mono">{row.zScore}σ</TableCell>
                   <TableCell>
                     <Badge 
                       variant="outline" 
                       className={
                         row.reason === 'Negative' ? "text-destructive border-destructive" :
                         row.reason === 'Zero Value' ? "text-amber-500 border-amber-500" :
                         row.reason === 'Drop' ? "text-orange-500 border-orange-500" :
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

       <Dialog open={!!selectedOutlier} onOpenChange={(open) => !open && setSelectedOutlier(null)}>
         <DialogContent className="sm:max-w-[600px]">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               Outlier Detail: <span className="font-mono text-primary">Row {selectedOutlier ? selectedOutlier.rowIndex + 1 : ''}</span>
             </DialogTitle>
             <DialogDescription>
               Detected issue: <span className="font-medium text-foreground">{selectedOutlier?.reason}</span> in column <span className="font-mono">{selectedOutlier?.column}</span>
             </DialogDescription>
           </DialogHeader>
           
           <div className="space-y-6 pt-4">
              <div className="grid grid-cols-3 gap-4">
                 <div className="p-3 border rounded-md bg-muted/20">
                    <p className="text-xs text-muted-foreground">Value</p>
                    <p className="text-xl font-bold font-mono">{selectedOutlier?.value?.toLocaleString()}</p>
                 </div>
                 <div className="p-3 border rounded-md bg-muted/20">
                    <p className="text-xs text-muted-foreground">Column Mean</p>
                    <p className="text-xl font-bold font-mono">{selectedOutlier?.mean?.toLocaleString()}</p>
                 </div>
                 <div className="p-3 border rounded-md bg-muted/20">
                    <p className="text-xs text-muted-foreground">Z-Score</p>
                    <p className={`text-xl font-bold font-mono ${selectedOutlier && Math.abs(selectedOutlier.zScore) > 3 ? 'text-destructive' : 'text-foreground'}`}>
                       {selectedOutlier?.zScore}σ
                    </p>
                 </div>
              </div>

              <div>
                 <p className="text-sm font-medium mb-2">Full Row Data</p>
                 <div className="border rounded-md overflow-hidden max-h-[300px] overflow-y-auto">
                    <Table>
                       <TableHeader>
                          <TableRow className="bg-muted/50">
                             <TableHead className="h-8">Field</TableHead>
                             <TableHead className="h-8">Value</TableHead>
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {selectedOutlier && Object.entries(selectedOutlier.rowData).map(([field, value]) => (
                            <TableRow key={field}>
                               <TableCell className={`py-2 text-xs font-medium ${field === selectedOutlier.column ? 'text-primary' : ''}`}>
                                 {field}
                                 {field === selectedOutlier.column && <Badge variant="outline" className="ml-2 text-[10px]">Outlier</Badge>}
                               </TableCell>
                               <TableCell className={`py-2 text-xs ${field === selectedOutlier.column ? 'font-bold text-primary' : ''}`}>
                                 {value === null || value === undefined ? <span className="text-muted-foreground">(null)</span> : String(value)}
                               </TableCell>
                            </TableRow>
                          ))}
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
