import Shell from '@/components/layout/Shell';
import ValidationStats from '@/components/dashboard/ValidationStats';
import { Button } from '@/components/ui/button';
import { FileCheck, ArrowRight } from 'lucide-react';

export default function Validate() {
  return (
    <Shell>
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Data Validation</h2>
            <p className="text-muted-foreground">Review data quality metrics and distributions before forecasting.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2">
              <FileCheck className="w-4 h-4" /> Download Report
            </Button>
            <Button className="gap-2 bg-green-600 hover:bg-green-700">
              Approve & Forecast <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <ValidationStats />
      </div>
    </Shell>
  );
}