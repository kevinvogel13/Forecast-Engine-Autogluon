import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const outliers = [
  { id: 'SKU-1029', date: '2023-11-15', value: 12400, mean: 1200, zScore: 8.5, reason: 'Spike' },
  { id: 'SKU-5521', date: '2023-12-01', value: 0, mean: 500, zScore: -2.1, reason: 'Zero Value' },
  { id: 'SKU-3392', date: '2023-10-22', value: 45000, mean: 2300, zScore: 12.1, reason: 'Extreme' },
  { id: 'SKU-1122', date: '2023-09-05', value: -50, mean: 120, zScore: -4.5, reason: 'Negative' },
];

export function OutlierTable() {
  return (
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
              <TableRow key={row.id + row.date}>
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
  );
}