import { FileSpreadsheet, GitMerge, Filter, Calculator, Database } from 'lucide-react';

export default function Sidebar() {
  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow/type', nodeType);
    event.dataTransfer.setData('application/reactflow/label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-64 bg-card border-l border-border p-4 flex flex-col gap-4 overflow-y-auto">
      <div className="text-sm font-semibold text-muted-foreground mb-2">Components</div>
      
      <div className="space-y-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sources</div>
        <div 
          className="bg-card border-2 border-border p-3 rounded cursor-grab shadow-sm hover:shadow-md transition-all flex items-center gap-2 hover:border-blue-200 hover:bg-blue-50/50"
          onDragStart={(event) => onDragStart(event, 'input', 'Data Source')}
          draggable
        >
          <FileSpreadsheet className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium">Data Source</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Operations</div>
        <div 
          className="bg-card border-2 border-border p-3 rounded cursor-grab shadow-sm hover:shadow-md transition-all flex items-center gap-2 hover:border-orange-200 hover:bg-orange-50/50"
          onDragStart={(event) => onDragStart(event, 'merge', 'Merge')}
          draggable
        >
          <GitMerge className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-medium">Merge / Join</span>
        </div>
        <div 
          className="bg-card border-2 border-border p-3 rounded cursor-grab shadow-sm hover:shadow-md transition-all flex items-center gap-2 hover:border-purple-200 hover:bg-purple-50/50"
          onDragStart={(event) => onDragStart(event, 'filter', 'Filter')}
          draggable
        >
          <Filter className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium">Filter</span>
        </div>
        <div 
          className="bg-card border-2 border-border p-3 rounded cursor-grab shadow-sm hover:shadow-md transition-all flex items-center gap-2 hover:border-indigo-200 hover:bg-indigo-50/50"
          onDragStart={(event) => onDragStart(event, 'transform', 'Transform')}
          draggable
        >
          <Calculator className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-medium">Transform</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Outputs</div>
        <div 
          className="bg-card border-2 border-border p-3 rounded cursor-grab shadow-sm hover:shadow-md transition-all flex items-center gap-2 hover:border-green-200 hover:bg-green-50/50"
          onDragStart={(event) => onDragStart(event, 'output', 'Forecast Model')}
          draggable
        >
          <Database className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium">Model Output</span>
        </div>
      </div>
      
      <div className="mt-auto pt-4 border-t border-border">
         <p className="text-xs text-muted-foreground">
           Drag components onto the canvas to add them to your pipeline.
         </p>
      </div>
    </div>
  );
}