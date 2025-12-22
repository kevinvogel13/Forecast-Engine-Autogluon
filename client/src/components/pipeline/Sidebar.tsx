import { FileSpreadsheet, GitMerge, Filter, Calculator, Database } from 'lucide-react';

export default function Sidebar() {
  const onDragStart = (event: React.DragEvent, nodeType: string, label: string, className: string) => {
    event.dataTransfer.setData('application/reactflow/type', nodeType);
    event.dataTransfer.setData('application/reactflow/label', label);
    event.dataTransfer.setData('application/reactflow/className', className);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-64 bg-card border-l border-border p-4 flex flex-col gap-4 overflow-y-auto">
      <div className="text-sm font-semibold text-muted-foreground mb-2">Components</div>
      
      <div className="space-y-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sources</div>
        <div 
          className="bg-white border-2 border-blue-200 p-3 rounded cursor-grab shadow-sm hover:shadow-md transition-all flex items-center gap-2"
          onDragStart={(event) => onDragStart(event, 'input', 'CSV Source', 'border-2 border-blue-200 bg-white min-w-[150px]')}
          draggable
        >
          <FileSpreadsheet className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium">Data Source</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Operations</div>
        <div 
          className="bg-orange-50 border-2 border-orange-200 p-3 rounded cursor-grab shadow-sm hover:shadow-md transition-all flex items-center gap-2"
          onDragStart={(event) => onDragStart(event, 'default', 'Merge', 'border-2 border-orange-200 bg-orange-50 min-w-[150px]')}
          draggable
        >
          <GitMerge className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-medium">Merge / Join</span>
        </div>
        <div 
          className="bg-purple-50 border-2 border-purple-200 p-3 rounded cursor-grab shadow-sm hover:shadow-md transition-all flex items-center gap-2"
          onDragStart={(event) => onDragStart(event, 'default', 'Filter', 'border-2 border-purple-200 bg-purple-50 min-w-[150px]')}
          draggable
        >
          <Filter className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium">Filter</span>
        </div>
        <div 
          className="bg-indigo-50 border-2 border-indigo-200 p-3 rounded cursor-grab shadow-sm hover:shadow-md transition-all flex items-center gap-2"
          onDragStart={(event) => onDragStart(event, 'default', 'Transform', 'border-2 border-indigo-200 bg-indigo-50 min-w-[150px]')}
          draggable
        >
          <Calculator className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-medium">Transform</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Outputs</div>
        <div 
          className="bg-green-50 border-2 border-green-200 p-3 rounded cursor-grab shadow-sm hover:shadow-md transition-all flex items-center gap-2"
          onDragStart={(event) => onDragStart(event, 'output', 'Forecast Model', 'border-2 border-green-200 bg-green-50 min-w-[150px] font-bold')}
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