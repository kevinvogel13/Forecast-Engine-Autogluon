import { useState, useEffect } from 'react';
import { GeneralStats } from './widgets/GeneralStats';
import { TimeSeriesView } from './widgets/TimeSeriesView';
import { CategoryDistribution } from './widgets/CategoryDistribution';
import { OutlierTable } from './widgets/OutlierTable';
import { DataCompletenessChart } from './widgets/DataCompletenessChart';
import { DemandPatternAnalysis } from './widgets/DemandPatternAnalysis';
import { Button } from '@/components/ui/button';
import { Settings2, Eye, EyeOff, AlertCircle } from 'lucide-react';
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
}

export default function EDADashboard({ datasetId }: EDADashboardProps) {
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
    fetch(`/api/datasets/${datasetId}/preview?limit=100`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setPreviewData({
            columns: data.columns,
            rows: data.rows,
            totalRows: data.totalRows
          });
        } else {
          setPreviewData(null);
        }
      })
      .catch(() => setPreviewData(null))
      .finally(() => setLoading(false));
  }, [datasetId]);
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

  return (
    <div className="space-y-6">
      <div className="flex justify-end mb-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
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
      
      {widgets.demandPattern && <DemandPatternAnalysis />}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {widgets.timeSeries && <div className="lg:col-span-4"><TimeSeriesView /></div>}
        
        {widgets.completeness && <div className="lg:col-span-4"><DataCompletenessChart /></div>}

        {widgets.distribution && <div className="lg:col-span-2"><CategoryDistribution /></div>}
        {widgets.outliers && <div className="lg:col-span-2"><OutlierTable /></div>}
      </div>
    </div>
  );
}