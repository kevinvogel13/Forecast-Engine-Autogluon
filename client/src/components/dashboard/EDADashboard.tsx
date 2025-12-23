import { useState } from 'react';
import { GeneralStats } from './widgets/GeneralStats';
import { TimeSeriesView } from './widgets/TimeSeriesView';
import { CategoryDistribution } from './widgets/CategoryDistribution';
import { OutlierTable } from './widgets/OutlierTable';
import { DataCompletenessChart } from './widgets/DataCompletenessChart';
import { DemandPatternAnalysis } from './widgets/DemandPatternAnalysis';
import { Button } from '@/components/ui/button';
import { Settings2, Eye, EyeOff } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function EDADashboard() {
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

      {widgets.generalStats && <GeneralStats />}
      
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