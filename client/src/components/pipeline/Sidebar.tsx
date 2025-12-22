import { FileSpreadsheet, GitMerge, Filter, Calculator, Database, Layers, ListTree, TableProperties, Code, HardDrive } from 'lucide-react';

export default function Sidebar() {
  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow/type', nodeType);
    event.dataTransfer.setData('application/reactflow/label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-full bg-card border-b border-border p-2 flex items-center gap-6 overflow-x-auto shrink-0 shadow-sm z-20">
      <div className="flex items-center gap-4">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0 hidden md:block">Sources</div>
        <div className="flex gap-2">
          <div 
            className="bg-background border border-border px-3 py-1.5 rounded cursor-grab shadow-sm hover:shadow-md transition-all flex items-center gap-2 hover:border-blue-200 hover:bg-blue-50/50"
            onDragStart={(event) => onDragStart(event, 'input', 'File Source')}
            draggable
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs font-medium whitespace-nowrap">File Source</span>
          </div>
          <div 
            className="bg-background border border-border px-3 py-1.5 rounded cursor-grab shadow-sm hover:shadow-md transition-all flex items-center gap-2 hover:border-cyan-200 hover:bg-cyan-50/50"
            onDragStart={(event) => onDragStart(event, 'sql', 'SQL Query')}
            draggable
          >
            <Database className="w-3.5 h-3.5 text-cyan-600" />
            <span className="text-xs font-medium whitespace-nowrap">SQL Query</span>
          </div>
        </div>
      </div>

      <div className="w-px h-8 bg-border shrink-0" />

      <div className="flex items-center gap-4">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0 hidden md:block">Operations</div>
        <div className="flex gap-2">
          <div 
            className="bg-background border border-border px-3 py-1.5 rounded cursor-grab shadow-sm hover:shadow-md transition-all flex items-center gap-2 hover:border-orange-200 hover:bg-orange-50/50"
            onDragStart={(event) => onDragStart(event, 'merge', 'Merge')}
            draggable
          >
            <GitMerge className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-xs font-medium whitespace-nowrap">Merge</span>
          </div>
          <div 
            className="bg-background border border-border px-3 py-1.5 rounded cursor-grab shadow-sm hover:shadow-md transition-all flex items-center gap-2 hover:border-purple-200 hover:bg-purple-50/50"
            onDragStart={(event) => onDragStart(event, 'filter', 'Filter')}
            draggable
          >
            <Filter className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-xs font-medium whitespace-nowrap">Filter</span>
          </div>
          <div 
            className="bg-background border border-border px-3 py-1.5 rounded cursor-grab shadow-sm hover:shadow-md transition-all flex items-center gap-2 hover:border-indigo-200 hover:bg-indigo-50/50"
            onDragStart={(event) => onDragStart(event, 'groupby', 'Group By')}
            draggable
          >
            <ListTree className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-xs font-medium whitespace-nowrap">Group By</span>
          </div>
          <div 
            className="bg-background border border-border px-3 py-1.5 rounded cursor-grab shadow-sm hover:shadow-md transition-all flex items-center gap-2 hover:border-indigo-200 hover:bg-indigo-50/50"
            onDragStart={(event) => onDragStart(event, 'transform', 'Transform')}
            draggable
          >
            <Calculator className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-xs font-medium whitespace-nowrap">Transform</span>
          </div>
          <div 
            className="bg-background border border-border px-3 py-1.5 rounded cursor-grab shadow-sm hover:shadow-md transition-all flex items-center gap-2 hover:border-yellow-200 hover:bg-yellow-50/50"
            onDragStart={(event) => onDragStart(event, 'python', 'Python Script')}
            draggable
          >
            <Code className="w-3.5 h-3.5 text-yellow-600" />
            <span className="text-xs font-medium whitespace-nowrap">Python</span>
          </div>
        </div>
      </div>

      <div className="w-px h-8 bg-border shrink-0" />

      <div className="flex items-center gap-4">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0 hidden md:block">Outputs</div>
        <div className="flex gap-2">
          <div 
            className="bg-background border border-border px-3 py-1.5 rounded cursor-grab shadow-sm hover:shadow-md transition-all flex items-center gap-2 hover:border-green-200 hover:bg-green-50/50"
            onDragStart={(event) => onDragStart(event, 'output', 'Baseline Forecast')}
            draggable
          >
            <HardDrive className="w-3.5 h-3.5 text-green-600" />
            <span className="text-xs font-medium whitespace-nowrap">Forecast</span>
          </div>
          <div 
            className="bg-background border border-border px-3 py-1.5 rounded cursor-grab shadow-sm hover:shadow-md transition-all flex items-center gap-2 hover:border-slate-200 hover:bg-slate-50/50"
            onDragStart={(event) => onDragStart(event, 'history', 'Historic Data')}
            draggable
          >
            <Database className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-xs font-medium whitespace-nowrap">History</span>
          </div>
        </div>
      </div>
    </div>
  );
}