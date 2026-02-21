import { Handle, Position } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, GitMerge, Filter, Calculator, Database, AlertCircle, Layers, ListTree, TableProperties, Code, HardDrive, History, Trash2, Settings2, BarChart3, CheckCircle2, Table2, LineChart, FileText, Eraser, CalendarClock, Group, ShieldAlert, Columns3, CopyMinus, ArrowRightLeft } from 'lucide-react';
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
    case 'sampling': return Layers;
    case 'fillMissing': return Eraser;
    case 'dateGapFill': return CalendarClock;
    case 'aggregation': return Group;
    case 'outlierTreatment': return ShieldAlert;
    case 'columnTransform': return Columns3;
    case 'removeDuplicates': return CopyMinus;
    case 'pivotUnpivot': return ArrowRightLeft;
    case 'transform': return Calculator;
    case 'groupby': return ListTree;
    case 'pivot': return TableProperties;
    case 'python': return Code;
    case 'output': return HardDrive;
    case 'history': return History;
    case 'eda': return BarChart3;
    case 'exploration': return LineChart;
    case 'report': return FileText;
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
    case 'sampling': return { bg: 'bg-pink-50', border: 'border-pink-200', icon: 'bg-pink-100 text-pink-600', handle: 'bg-pink-500' };
    case 'fillMissing': return { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'bg-amber-100 text-amber-600', handle: 'bg-amber-500' };
    case 'dateGapFill': return { bg: 'bg-teal-50', border: 'border-teal-200', icon: 'bg-teal-100 text-teal-600', handle: 'bg-teal-500' };
    case 'aggregation': return { bg: 'bg-sky-50', border: 'border-sky-200', icon: 'bg-sky-100 text-sky-600', handle: 'bg-sky-500' };
    case 'outlierTreatment': return { bg: 'bg-rose-50', border: 'border-rose-200', icon: 'bg-rose-100 text-rose-600', handle: 'bg-rose-500' };
    case 'columnTransform': return { bg: 'bg-lime-50', border: 'border-lime-200', icon: 'bg-lime-100 text-lime-600', handle: 'bg-lime-500' };
    case 'removeDuplicates': return { bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', icon: 'bg-fuchsia-100 text-fuchsia-600', handle: 'bg-fuchsia-500' };
    case 'pivotUnpivot': return { bg: 'bg-stone-50', border: 'border-stone-200', icon: 'bg-stone-100 text-stone-600', handle: 'bg-stone-500' };
    case 'eda': return { bg: 'bg-green-50', border: 'border-green-200', icon: 'bg-green-100 text-green-600', handle: 'bg-green-500' };
    case 'exploration': return { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'bg-emerald-100 text-emerald-600', handle: 'bg-emerald-500' };
    case 'report': return { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'bg-violet-100 text-violet-600', handle: 'bg-violet-500' };
    case 'python': return { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'bg-yellow-100 text-yellow-600', handle: 'bg-yellow-500' };
    case 'sql': return { bg: 'bg-cyan-50', border: 'border-cyan-200', icon: 'bg-cyan-100 text-cyan-600', handle: 'bg-cyan-500' };
    case 'config': return { bg: 'bg-slate-50', border: 'border-slate-200', icon: 'bg-slate-100 text-slate-600', handle: 'bg-slate-500' };
    case 'output': return { bg: 'bg-red-50', border: 'border-red-200', icon: 'bg-red-100 text-red-600', handle: 'bg-red-500' };
    default: return { bg: 'bg-white', border: 'border-border', icon: 'bg-muted text-muted-foreground', handle: 'bg-slate-500' };
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'input': return 'Data Source';
    case 'eda': return 'Validation';
    case 'config': return 'Model Config';
    case 'fillMissing': return 'Fill Missing';
    case 'dateGapFill': return 'Date Gap Fill';
    case 'outlierTreatment': return 'Outlier Treatment';
    case 'columnTransform': return 'Column Transform';
    case 'removeDuplicates': return 'Remove Duplicates';
    case 'pivotUnpivot': return 'Pivot / Unpivot';
    default: return type;
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

      <div className="p-3">
        <div className="flex items-start gap-2.5">
          <div className={cn("p-2 rounded-lg shrink-0", colors.icon)}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-sm font-semibold truncate text-slate-800" data-testid={`node-label-${data.type}`}>
              {data.label}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
              {getTypeLabel(data.type)}
            </p>
          </div>
          
          {statusInfo && (
            <div className={cn("shrink-0", statusInfo.color)}>
              {statusInfo.icon && <statusInfo.icon className="w-4 h-4" />}
              {data.status === 'processing' && (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          )}
        </div>

        {data.status === 'error' && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-red-700 bg-red-100 px-2 py-1.5 rounded-md border border-red-200">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span className="font-medium">Check configuration</span>
          </div>
        )}
      </div>

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
