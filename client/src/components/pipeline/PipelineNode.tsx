import { Handle, Position } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, GitMerge, Filter, Calculator, Database, AlertCircle, Layers, ListTree, TableProperties, Code, HardDrive, History, Trash2, Settings2, CheckCircle2, Table2, LineChart, FileText, Eraser, CalendarClock, Group, ShieldAlert, Columns3, CopyMinus, ArrowRightLeft } from 'lucide-react';
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
    case 'exploration': return LineChart;
    case 'report': return FileText;
    case 'config': return Settings2;
    default: return FileSpreadsheet;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    // Data (blue)
    case 'input': return { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'bg-blue-100 text-blue-600', handle: 'bg-blue-500' };
    // Clean (amber)
    case 'filter': return { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'bg-amber-100 text-amber-600', handle: 'bg-amber-500' };
    case 'sampling': return { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'bg-amber-100 text-amber-600', handle: 'bg-amber-500' };
    case 'fillMissing': return { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'bg-amber-100 text-amber-600', handle: 'bg-amber-500' };
    case 'outlierTreatment': return { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'bg-amber-100 text-amber-600', handle: 'bg-amber-500' };
    case 'removeDuplicates': return { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'bg-amber-100 text-amber-600', handle: 'bg-amber-500' };
    // Reshape (teal)
    case 'merge': return { bg: 'bg-teal-50', border: 'border-teal-200', icon: 'bg-teal-100 text-teal-600', handle: 'bg-teal-500' };
    case 'aggregation': return { bg: 'bg-teal-50', border: 'border-teal-200', icon: 'bg-teal-100 text-teal-600', handle: 'bg-teal-500' };
    case 'dateGapFill': return { bg: 'bg-teal-50', border: 'border-teal-200', icon: 'bg-teal-100 text-teal-600', handle: 'bg-teal-500' };
    case 'columnTransform': return { bg: 'bg-teal-50', border: 'border-teal-200', icon: 'bg-teal-100 text-teal-600', handle: 'bg-teal-500' };
    case 'pivotUnpivot': return { bg: 'bg-teal-50', border: 'border-teal-200', icon: 'bg-teal-100 text-teal-600', handle: 'bg-teal-500' };
    // Code (slate)
    case 'python': return { bg: 'bg-slate-50', border: 'border-slate-200', icon: 'bg-slate-100 text-slate-600', handle: 'bg-slate-500' };
    case 'sql': return { bg: 'bg-slate-50', border: 'border-slate-200', icon: 'bg-slate-100 text-slate-600', handle: 'bg-slate-500' };
    // Analysis (emerald)
    case 'preview': return { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'bg-emerald-100 text-emerald-600', handle: 'bg-emerald-500' };
    case 'exploration': return { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'bg-emerald-100 text-emerald-600', handle: 'bg-emerald-500' };
    case 'report': return { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'bg-emerald-100 text-emerald-600', handle: 'bg-emerald-500' };
    // Model (violet)
    case 'config': return { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'bg-violet-100 text-violet-600', handle: 'bg-violet-500' };
    case 'output': return { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'bg-violet-100 text-violet-600', handle: 'bg-violet-500' };
    default: return { bg: 'bg-white', border: 'border-border', icon: 'bg-muted text-muted-foreground', handle: 'bg-slate-500' };
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'input': return 'Data Source';
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

      {!['output', 'preview', 'report'].includes(data.type) && (
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
