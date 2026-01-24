import { Handle, Position } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, GitMerge, Filter, Calculator, Database, AlertCircle, Layers, ListTree, TableProperties, Code, HardDrive, History, Trash2, Settings2, BarChart3, CheckCircle2, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PipelineNodeProps {
  data: {
    label: string;
    type: string;
    stats?: {
      rows: number;
      cols: number;
      volume?: string;
    };
    status?: 'pending' | 'processing' | 'success' | 'error';
    onDelete?: () => void;
  };
  selected?: boolean;
}

const getIcon = (type: string) => {
  switch (type) {
    case 'input': return Database;
    case 'preview': return Table2;
    case 'sql': return Code;
    case 'merge': return GitMerge;
    case 'union': return Layers;
    case 'filter': return Filter;
    case 'transform': return Calculator;
    case 'groupby': return ListTree;
    case 'pivot': return TableProperties;
    case 'python': return Code;
    case 'output': return HardDrive;
    case 'history': return History;
    case 'eda': return BarChart3;
    case 'config': return Settings2;
    default: return FileSpreadsheet;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'input': return { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'bg-blue-100 text-blue-600', handle: 'bg-blue-500' };
    case 'preview': return { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: 'bg-indigo-100 text-indigo-600', handle: 'bg-indigo-500' };
    case 'merge': return { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'bg-orange-100 text-orange-600', handle: 'bg-orange-500' };
    case 'filter': return { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'bg-purple-100 text-purple-600', handle: 'bg-purple-500' };
    case 'eda': return { bg: 'bg-green-50', border: 'border-green-200', icon: 'bg-green-100 text-green-600', handle: 'bg-green-500' };
    case 'python': return { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'bg-yellow-100 text-yellow-600', handle: 'bg-yellow-500' };
    case 'sql': return { bg: 'bg-cyan-50', border: 'border-cyan-200', icon: 'bg-cyan-100 text-cyan-600', handle: 'bg-cyan-500' };
    case 'config': return { bg: 'bg-slate-50', border: 'border-slate-200', icon: 'bg-slate-100 text-slate-600', handle: 'bg-slate-500' };
    case 'output': return { bg: 'bg-red-50', border: 'border-red-200', icon: 'bg-red-100 text-red-600', handle: 'bg-red-500' };
    default: return { bg: 'bg-white', border: 'border-border', icon: 'bg-muted text-muted-foreground', handle: 'bg-slate-500' };
  }
};

const getStatusIndicator = (status?: string) => {
  switch (status) {
    case 'success': return { icon: CheckCircle2, color: 'text-green-500', label: 'Complete' };
    case 'error': return { icon: AlertCircle, color: 'text-red-500', label: 'Error' };
    case 'processing': return { icon: null, color: 'text-blue-500', label: 'Processing' };
    default: return null;
  }
};

export default function PipelineNode({ data, selected }: PipelineNodeProps) {
  const Icon = getIcon(data.type);
  const colors = getTypeColor(data.type);
  const statusInfo = getStatusIndicator(data.status);

  return (
    <div className={cn(
      "group relative min-w-[220px] rounded-xl transition-all duration-200",
      colors.bg, colors.border,
      "border-2 shadow-sm hover:shadow-md",
      selected && "ring-2 ring-blue-500 ring-offset-2 shadow-lg",
      data.status === 'processing' && "animate-pulse"
    )}>
      {/* Input Handle - Large and visible */}
      {data.type !== 'input' && (
        <Handle 
          type="target" 
          position={Position.Left} 
          className={cn(
            "!w-5 !h-5 !border-2 !border-white !shadow-md transition-all !-left-3",
            colors.handle,
            "hover:!w-6 hover:!h-6 hover:!shadow-lg"
          )}
          data-testid={`handle-target-${data.type}`}
        />
      )}

      {/* Node Content */}
      <div className="p-3">
        {/* Header */}
        <div className="flex items-start gap-2.5">
          <div className={cn("p-2 rounded-lg shrink-0", colors.icon)}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-sm font-semibold truncate text-slate-800" data-testid={`node-label-${data.type}`}>
              {data.label}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
              {data.type === 'input' ? 'Data Source' : 
               data.type === 'eda' ? 'Validation' :
               data.type === 'config' ? 'Model Config' :
               data.type}
            </p>
          </div>
          
          {/* Status indicator */}
          {statusInfo && (
            <div className={cn("shrink-0", statusInfo.color)}>
              {statusInfo.icon && <statusInfo.icon className="w-4 h-4" />}
              {data.status === 'processing' && (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          )}
        </div>


        {/* Error State */}
        {data.status === 'error' && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-red-700 bg-red-100 px-2 py-1.5 rounded-md border border-red-200">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span className="font-medium">Check configuration</span>
          </div>
        )}
      </div>

      {/* Output Handle - Large and visible */}
      {data.type !== 'output' && (
        <Handle 
          type="source" 
          position={Position.Right} 
          className={cn(
            "!w-5 !h-5 !border-2 !border-white !shadow-md transition-all !-right-3",
            colors.handle,
            "hover:!w-6 hover:!h-6 hover:!shadow-lg"
          )}
          data-testid={`handle-source-${data.type}`}
        />
      )}
    </div>
  );
}
