import Shell from '@/components/layout/Shell';
import EDADashboard from '@/components/dashboard/EDADashboard';
import { Button } from '@/components/ui/button';
import { FileCheck, ArrowRight, Download } from 'lucide-react';
import { useLocation } from "wouter";

export default function Validate() {
  const [, setLocation] = useLocation();

  return (
    <Shell>
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Data Validation & EDA</h2>
            <p className="text-muted-foreground">Exploratory analysis and quality checks for your forecasting dataset.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" /> Export Report
            </Button>
            <Button 
              className="gap-2 bg-green-600 hover:bg-green-700"
              onClick={() => setLocation('/forecast-result')}
            >
              Approve Dataset <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <EDADashboard />
      </div>
    </Shell>
  );
}