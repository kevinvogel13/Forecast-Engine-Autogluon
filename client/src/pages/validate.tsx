import { useState, useEffect } from 'react';
import Shell from '@/components/layout/Shell';
import EDADashboard from '@/components/dashboard/EDADashboard';
import { Button } from '@/components/ui/button';
import { FileCheck, ArrowRight, Download, Database } from 'lucide-react';
import { useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Dataset {
  id: string;
  filename: string;
  rows: number;
  cols: number;
}

export default function Validate() {
  const [, setLocation] = useLocation();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/datasets')
      .then(res => res.json())
      .then(data => {
        setDatasets(data);
        if (data.length > 0) {
          setSelectedDatasetId(data[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Shell>
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Data Validation & EDA</h2>
            <p className="text-muted-foreground">Exploratory analysis and quality checks for your forecasting dataset.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-muted-foreground" />
              <Select 
                value={selectedDatasetId || ''} 
                onValueChange={setSelectedDatasetId}
                disabled={loading || datasets.length === 0}
              >
                <SelectTrigger className="w-[200px]" data-testid="select-dataset">
                  <SelectValue placeholder={loading ? "Loading..." : "Select dataset"} />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((ds) => (
                    <SelectItem key={ds.id} value={ds.id}>
                      {ds.filename} ({ds.rows.toLocaleString()} rows)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" /> Export Report
            </Button>
            <Button 
              className="gap-2 bg-green-600 hover:bg-green-700"
              onClick={() => setLocation('/settings')}
            >
              Configure Models <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <EDADashboard datasetId={selectedDatasetId} />
      </div>
    </Shell>
  );
}
