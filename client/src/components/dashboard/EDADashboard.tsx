import { useState, useEffect, useMemo, useCallback } from 'react';
import { GeneralStats } from './widgets/GeneralStats';
import { TimeSeriesView } from './widgets/TimeSeriesView';
import { CategoryDistribution } from './widgets/CategoryDistribution';
import { OutlierTable } from './widgets/OutlierTable';
import { DataCompletenessChart } from './widgets/DataCompletenessChart';
import { DemandPatternAnalysis } from './widgets/DemandPatternAnalysis';
import { Button } from '@/components/ui/button';
import { Settings2, Download, AlertCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface EDADashboardProps {
  datasetId?: string | null;
  transforms?: Array<{ type: 'filter' | 'python' | 'sql'; data: any }>;
}

export default function EDADashboard({ datasetId, transforms = [] }: EDADashboardProps) {
  const [previewData, setPreviewData] = useState<{
    columns: string[];
    rows: any[];
    totalRows: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!datasetId) {
      setPreviewData(null);
      return;
    }

    setLoading(true);
    
    // Use unified transform endpoint if there are transforms, otherwise use preview
    const fetchData = async () => {
      try {
        let response;
        if (transforms.length > 0) {
          response = await fetch(`/api/datasets/${datasetId}/transform?limit=100`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transforms })
          });
        } else {
          response = await fetch(`/api/datasets/${datasetId}/preview?limit=100`);
        }
        
        if (response.ok) {
          const data = await response.json();
          setPreviewData({
            columns: data.columns,
            rows: data.rows,
            totalRows: data.totalRows
          });
        } else {
          setPreviewData(null);
        }
      } catch {
        setPreviewData(null);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [datasetId, JSON.stringify(transforms)]);
  const [widgets, setWidgets] = useState({
    generalStats: true,
    demandPattern: true,
    timeSeries: true,
    completeness: true,
    distribution: true,
    outliers: true,
  });

  const toggleWidget = (key: keyof typeof widgets) => {
    setWidgets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Generate analysis summary for export
  const generateSummary = useCallback(() => {
    if (!previewData) return null;
    
    const { columns, rows, totalRows } = previewData;
    
    // Calculate general stats
    let missingCount = 0;
    const totalCells = rows.length * columns.length;
    
    rows.forEach(row => {
      columns.forEach(col => {
        const val = row[col];
        if (val === null || val === undefined || val === '' || val === 'null') {
          missingCount++;
        }
      });
    });
    
    const completeness = totalCells > 0 ? ((totalCells - missingCount) / totalCells * 100).toFixed(1) : '100';
    
    // Count duplicates
    const rowKeys = rows.map(r => JSON.stringify(r));
    const duplicates = rowKeys.length - new Set(rowKeys).size;
    
    // Column completeness
    const columnStats = columns.map(col => {
      let nullCount = 0;
      const values: any[] = [];
      rows.forEach(row => {
        const val = row[col];
        if (val === null || val === undefined || val === '' || val === 'null') {
          nullCount++;
        } else {
          values.push(val);
        }
      });
      
      const filledCount = rows.length - nullCount;
      const completenessPercent = rows.length > 0 ? (filledCount / rows.length * 100).toFixed(1) : '100';
      
      // Determine data type
      const numericValues = values.filter(v => !isNaN(Number(v)));
      const isNumeric = numericValues.length > values.length * 0.8;
      
      let stats: any = {
        column: col,
        filled: filledCount,
        missing: nullCount,
        completeness: `${completenessPercent}%`,
        type: isNumeric ? 'numeric' : 'categorical'
      };
      
      if (isNumeric && numericValues.length > 0) {
        const nums = numericValues.map(Number);
        const sum = nums.reduce((a, b) => a + b, 0);
        const mean = sum / nums.length;
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        stats.min = min;
        stats.max = max;
        stats.mean = mean.toFixed(2);
      } else {
        const uniqueValues = new Set(values);
        stats.uniqueValues = uniqueValues.size;
        if (uniqueValues.size <= 10) {
          stats.topValues = Array.from(uniqueValues).slice(0, 10);
        }
      }
      
      return stats;
    });
    
    // Detect outliers
    const outliers: any[] = [];
    columns.forEach(col => {
      const values = rows.map(r => r[col]).filter(v => !isNaN(Number(v)));
      if (values.length > 2) {
        const nums = values.map(Number);
        const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
        const variance = nums.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / nums.length;
        const std = Math.sqrt(variance);
        
        if (std > 0) {
          rows.forEach((row, idx) => {
            const val = Number(row[col]);
            if (!isNaN(val)) {
              const zScore = (val - mean) / std;
              if (Math.abs(zScore) > 3) {
                outliers.push({
                  rowIndex: idx,
                  column: col,
                  value: val,
                  mean: mean.toFixed(2),
                  zScore: zScore.toFixed(2)
                });
              }
            }
          });
        }
      }
    });
    
    return {
      generatedAt: new Date().toISOString(),
      datasetSummary: {
        totalRows,
        sampleRows: rows.length,
        totalColumns: columns.length,
        duplicateRows: duplicates,
        overallCompleteness: `${completeness}%`,
        missingValues: missingCount
      },
      appliedFilters: filters,
      columnStatistics: columnStats,
      outliers: outliers.slice(0, 50) // Limit to top 50 outliers
    };
  }, [previewData, filters]);

  const handleExportSummary = useCallback(() => {
    const summary = generateSummary();
    if (!summary) return;
    
    const jsonStr = JSON.stringify(summary, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eda_summary_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [generateSummary]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2 mb-4">
        {previewData && (
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={handleExportSummary}
            data-testid="button-export-summary"
          >
            <Download className="w-4 h-4" /> Export Summary
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2" data-testid="button-configure-dashboard">
              <Settings2 className="w-4 h-4" /> Configure Dashboard
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Visible Widgets</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={widgets.generalStats}
              onCheckedChange={() => toggleWidget('generalStats')}
            >
              General Stats Cards
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={widgets.demandPattern}
              onCheckedChange={() => toggleWidget('demandPattern')}
            >
              Demand Pattern Analysis
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={widgets.timeSeries}
              onCheckedChange={() => toggleWidget('timeSeries')}
            >
              Time Series Analysis
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={widgets.completeness}
              onCheckedChange={() => toggleWidget('completeness')}
            >
              Data Completeness
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={widgets.distribution}
              onCheckedChange={() => toggleWidget('distribution')}
            >
              Volume Breakdown
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={widgets.outliers}
              onCheckedChange={() => toggleWidget('outliers')}
            >
              Anomaly Detection
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          Loading data...
        </div>
      )}
      
      {!loading && !previewData && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
          <AlertCircle className="w-5 h-5" />
          <div>
            <p className="font-medium">No data connected</p>
            <p className="text-sm text-amber-700">Connect a data source to the Validation node to see analytics.</p>
          </div>
        </div>
      )}
      
      {widgets.generalStats && previewData && <GeneralStats data={previewData} />}
      
      {widgets.demandPattern && previewData && <DemandPatternAnalysis data={previewData} />}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {widgets.timeSeries && previewData && <div className="lg:col-span-4"><TimeSeriesView data={previewData} /></div>}
        
        {widgets.completeness && previewData && <div className="lg:col-span-4"><DataCompletenessChart data={previewData} /></div>}

        {widgets.distribution && previewData && <div className="lg:col-span-2"><CategoryDistribution data={previewData} /></div>}
        {widgets.outliers && previewData && <div className="lg:col-span-2"><OutlierTable data={previewData} /></div>}
      </div>
    </div>
  );
}