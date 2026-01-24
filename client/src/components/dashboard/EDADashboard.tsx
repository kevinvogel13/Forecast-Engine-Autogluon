import { useState, useEffect, useMemo, useCallback } from 'react';
import { GeneralStats } from './widgets/GeneralStats';
import { TimeSeriesView } from './widgets/TimeSeriesView';
import { CategoryDistribution } from './widgets/CategoryDistribution';
import { OutlierTable } from './widgets/OutlierTable';
import { DataCompletenessChart } from './widgets/DataCompletenessChart';
import { DemandPatternAnalysis } from './widgets/DemandPatternAnalysis';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Settings2, Download, AlertCircle, Users } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

interface SamplingInfo {
  totalGroups: number;
  sampledGroups: number;
  sampledRows: number;
}

export default function EDADashboard({ datasetId, transforms = [] }: EDADashboardProps) {
  const [previewData, setPreviewData] = useState<{
    columns: string[];
    rows: any[];
    totalRows: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [groupColumn, setGroupColumn] = useState<string>('');
  const [samplePercent, setSamplePercent] = useState<number>(100);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [samplingInfo, setSamplingInfo] = useState<SamplingInfo | null>(null);

  // Fetch available columns when datasetId or transforms change
  // Uses transformed data to get columns (including derived columns like DFU)
  useEffect(() => {
    if (!datasetId) {
      setAvailableColumns([]);
      setGroupColumn('');
      return;
    }

    const fetchColumns = async () => {
      try {
        let response;
        // If there are transforms, use transform endpoint to get post-transform columns
        if (transforms.length > 0) {
          response = await fetch(`/api/datasets/${datasetId}/transform?limit=1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transforms })
          });
        } else {
          response = await fetch(`/api/datasets/${datasetId}/preview?limit=1`);
        }
        
        if (response.ok) {
          const data = await response.json();
          const newColumns = data.columns || [];
          setAvailableColumns(newColumns);
          
          // Auto-select best group column (prefer DFU, SKU, Product, or first column)
          const defaultGroup = newColumns.find((col: string) => 
            col.toLowerCase().includes('dfu') || 
            col.toLowerCase().includes('sku') || 
            col.toLowerCase().includes('product') ||
            col.toLowerCase().includes('id')
          ) || newColumns[0] || '';
          
          // Only update groupColumn if it's not already set or doesn't exist in new columns
          if (!groupColumn || !newColumns.includes(groupColumn)) {
            setGroupColumn(defaultGroup);
          }
        }
      } catch {
        setAvailableColumns([]);
      }
    };
    fetchColumns();
  }, [datasetId, JSON.stringify(transforms)]);

  // Fetch data using stratified sampling
  useEffect(() => {
    if (!datasetId || !groupColumn) {
      setPreviewData(null);
      setSamplingInfo(null);
      return;
    }

    setLoading(true);
    
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/datasets/${datasetId}/stratified-sample`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            groupColumn,
            samplePercent,
            transforms
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          setPreviewData({
            columns: data.columns,
            rows: data.rows,
            totalRows: data.totalRows
          });
          setSamplingInfo({
            totalGroups: data.totalGroups,
            sampledGroups: data.sampledGroups,
            sampledRows: data.sampledRows
          });
        } else {
          setPreviewData(null);
          setSamplingInfo(null);
        }
      } catch {
        setPreviewData(null);
        setSamplingInfo(null);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [datasetId, groupColumn, samplePercent, JSON.stringify(transforms)]);
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
      appliedTransforms: transforms,
      columnStatistics: columnStats,
      outliers: outliers.slice(0, 50) // Limit to top 50 outliers
    };
  }, [previewData, transforms]);

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
      <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <Label className="text-sm text-muted-foreground">Group By:</Label>
            <Select value={groupColumn} onValueChange={setGroupColumn} data-testid="select-group-column">
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Select column" />
              </SelectTrigger>
              <SelectContent>
                {availableColumns.map(col => (
                  <SelectItem key={col} value={col}>{col}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Sample:</Label>
            <div className="w-32">
              <Slider 
                value={[samplePercent]} 
                onValueChange={(val) => setSamplePercent(val[0])}
                min={5} 
                max={100} 
                step={5}
                data-testid="slider-sample-percent"
              />
            </div>
            <span className="text-xs font-medium w-12">{samplePercent}%</span>
          </div>
          {samplingInfo && (
            <span className="text-xs text-muted-foreground">
              ({samplingInfo.sampledGroups.toLocaleString()} of {samplingInfo.totalGroups.toLocaleString()} groups, {samplingInfo.sampledRows.toLocaleString()} rows)
            </span>
          )}
        </div>
        <div className="flex gap-2">
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