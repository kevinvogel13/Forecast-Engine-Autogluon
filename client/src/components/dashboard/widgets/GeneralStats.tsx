import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, Copy, Rows3, Columns3, Database } from "lucide-react";
import { useMemo } from "react";

interface GeneralStatsProps {
  data: {
    columns: string[];
    rows: any[];
    totalRows: number;
  };
}

export function GeneralStats({ data }: GeneralStatsProps) {
  const stats = useMemo(() => {
    const totalRows = data.totalRows;
    const totalCols = data.columns.length;
    
    // Count null/empty values
    let missingCount = 0;
    let totalCells = data.rows.length * totalCols;
    
    data.rows.forEach(row => {
      data.columns.forEach(col => {
        const val = row[col];
        if (val === null || val === undefined || val === '' || val === 'null') {
          missingCount++;
        }
      });
    });
    
    const completeness = totalCells > 0 ? ((totalCells - missingCount) / totalCells * 100).toFixed(1) : 100;
    
    // Count unique values in first column (often an ID column)
    const firstCol = data.columns[0];
    const uniqueFirstCol = new Set(data.rows.map(r => r[firstCol])).size;
    
    // Check for duplicates
    const rowKeys = data.rows.map(r => JSON.stringify(r));
    const duplicates = rowKeys.length - new Set(rowKeys).size;
    
    return {
      totalRows,
      totalCols,
      missingCount,
      completeness: parseFloat(completeness as string),
      uniqueFirstCol,
      duplicates
    };
  }, [data]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Rows</CardTitle>
          <Rows3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalRows.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Records in dataset</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Columns</CardTitle>
          <Columns3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalCols}</div>
          <p className="text-xs text-muted-foreground">{data.columns.slice(0, 3).join(', ')}{data.columns.length > 3 ? '...' : ''}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Duplicate Rows</CardTitle>
          <Copy className={`h-4 w-4 ${stats.duplicates === 0 ? 'text-green-500' : 'text-amber-500'}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${stats.duplicates === 0 ? 'text-green-600' : 'text-amber-600'}`}>
            {stats.duplicates}
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.duplicates === 0 ? 'No duplicates found' : 'Duplicate rows detected'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Data Completeness</CardTitle>
          {stats.completeness >= 95 ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${stats.completeness >= 95 ? 'text-green-600' : 'text-amber-600'}`}>
            {stats.completeness}%
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.missingCount > 0 ? `${stats.missingCount} missing values` : 'All values present'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}