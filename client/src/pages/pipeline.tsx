import Shell from '@/components/layout/Shell';
import FlowEditor from '@/components/pipeline/FlowEditor';
import { Button } from '@/components/ui/button';
import { Plus, Save, Download } from 'lucide-react';

export default function Pipeline() {
  return (
    <Shell>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Pipeline Configuration</h2>
            <p className="text-muted-foreground">Visually design your data transformation and join logic.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" /> Export Config
            </Button>
            <Button variant="default" className="gap-2">
              <Save className="w-4 h-4" /> Save Pipeline
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-[600px] flex flex-col">
           <FlowEditor />
        </div>
      </div>
    </Shell>
  );
}