import { Handle, Position, useNodeId } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, GitMerge, Filter, Calculator, Database, AlertCircle, Layers, ListTree, TableProperties, Code, HardDrive, History, Trash2, Settings2, CheckCircle2, Table2, LineChart, FileText, Eraser, CalendarClock, Group, ShieldAlert, Columns3, CopyMinus, ArrowRightLeft, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCallback, useState, useRef, useEffect } from 'react';

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
    commentText?: string;
    onCommentChange?: (text: string) => void;
    previewRows?: Array<Record<string, any>>;
    previewColumns?: string[];
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
    case 'comment': return MessageSquare;
    default: return FileSpreadsheet;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'input': return { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'bg-blue-100 text-blue-600', handle: 'bg-blue-500' };
    case 'filter': return { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'bg-yellow-100 text-yellow-600', handle: 'bg-yellow-500' };
    case 'sampling': return { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'bg-yellow-100 text-yellow-600', handle: 'bg-yellow-500' };
    case 'fillMissing': return { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'bg-yellow-100 text-yellow-600', handle: 'bg-yellow-500' };
    case 'outlierTreatment': return { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'bg-yellow-100 text-yellow-600', handle: 'bg-yellow-500' };
    case 'removeDuplicates': return { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'bg-yellow-100 text-yellow-600', handle: 'bg-yellow-500' };
    case 'merge': return { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'bg-yellow-100 text-yellow-600', handle: 'bg-yellow-500' };
    case 'aggregation': return { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'bg-yellow-100 text-yellow-600', handle: 'bg-yellow-500' };
    case 'dateGapFill': return { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'bg-yellow-100 text-yellow-600', handle: 'bg-yellow-500' };
    case 'columnTransform': return { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'bg-yellow-100 text-yellow-600', handle: 'bg-yellow-500' };
    case 'pivotUnpivot': return { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'bg-yellow-100 text-yellow-600', handle: 'bg-yellow-500' };
    case 'python': return { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'bg-yellow-100 text-yellow-600', handle: 'bg-yellow-500' };
    case 'sql': return { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'bg-yellow-100 text-yellow-600', handle: 'bg-yellow-500' };
    case 'preview': return { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'bg-emerald-100 text-emerald-600', handle: 'bg-emerald-500' };
    case 'exploration': return { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'bg-emerald-100 text-emerald-600', handle: 'bg-emerald-500' };
    case 'report': return { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'bg-emerald-100 text-emerald-600', handle: 'bg-emerald-500' };
    case 'config': return { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'bg-violet-100 text-violet-600', handle: 'bg-violet-500' };
    case 'output': return { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'bg-violet-100 text-violet-600', handle: 'bg-violet-500' };
    case 'comment': return { bg: 'bg-amber-50', border: 'border-amber-300', icon: 'bg-amber-100 text-amber-600', handle: 'bg-amber-400' };
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
    case 'comment': return 'Note';
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

/* ── Comment (sticky note) node ── */
function CommentNode({ data, selected }: PipelineNodeProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(data.commentText || 'Double-click to edit…');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    data.onCommentChange?.(text);
  };

  return (
    <div
      className={cn(
        'relative min-w-[180px] max-w-[280px] rounded-lg border-2 shadow-sm',
        'bg-amber-50 border-amber-300',
        selected && 'ring-2 ring-amber-400 ring-offset-2',
      )}
      onDoubleClick={() => setEditing(true)}
      data-testid="node-comment"
    >
      {/* top bar */}
      <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1">
        <MessageSquare className="w-3 h-3 text-amber-500 shrink-0" />
        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">Note</span>
      </div>
      <div className="px-2.5 pb-2.5">
        {editing ? (
          <textarea
            ref={textareaRef}
            className="w-full text-xs text-slate-700 bg-transparent resize-none outline-none min-h-[60px]"
            value={text}
            onChange={e => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Escape') commit(); }}
            rows={4}
          />
        ) : (
          <p className="text-xs text-slate-700 whitespace-pre-wrap break-words min-h-[40px]">{text || 'Double-click to edit…'}</p>
        )}
      </div>
    </div>
  );
}

/* ── Hover preview tooltip ── */
function PreviewTooltip({ rows, columns }: { rows: Array<Record<string, any>>; columns: string[] }) {
  const cols = columns.slice(0, 5);
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-white border border-slate-200 rounded-lg shadow-xl p-2 min-w-[280px] max-w-[420px] pointer-events-none">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Output preview</p>
      <div className="overflow-auto max-h-[160px]">
        <table className="text-[10px] w-full border-collapse">
          <thead>
            <tr className="bg-slate-50">
              {cols.map(c => (
                <th key={c} className="text-left px-1.5 py-1 border border-slate-200 font-semibold text-slate-600 truncate max-w-[80px]">{c}</th>
              ))}
              {columns.length > 5 && <th className="px-1 py-1 border border-slate-200 text-slate-400">+{columns.length - 5}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                {cols.map(c => (
                  <td key={c} className="px-1.5 py-1 border border-slate-100 text-slate-700 max-w-[80px] truncate">
                    {row[c] === null || row[c] === undefined ? <span className="text-slate-400 italic">null</span> : String(row[c])}
                  </td>
                ))}
                {columns.length > 5 && <td className="px-1 py-1 border border-slate-100" />}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PipelineNode({ data, selected }: PipelineNodeProps) {
  const nodeId = useNodeId();
  const [showPreview, setShowPreview] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSourceClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    window.dispatchEvent(new CustomEvent('quick-connect-click', {
      detail: { nodeId, x: rect.right + 10, y: rect.top + rect.height / 2 }
    }));
  }, [nodeId]);

  const handleMouseEnter = useCallback(() => {
    if (!data.previewRows?.length) return;
    hoverTimerRef.current = setTimeout(() => setShowPreview(true), 500);
  }, [data.previewRows]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setShowPreview(false);
  }, []);

  // Comment node renders differently
  if (data.type === 'comment') {
    return <CommentNode data={data} selected={selected} />;
  }

  const Icon = getIcon(data.type);
  const colors = getTypeColor(data.type);
  const statusInfo = getStatusIndicator(data.status);

  return (
    <div
      className={cn(
        "group relative min-w-[220px] rounded-xl transition-all duration-200",
        colors.bg, colors.border,
        "border-2 shadow-sm hover:shadow-md",
        selected && "ring-2 ring-blue-500 ring-offset-2 shadow-lg",
        data.status === 'processing' && "animate-pulse"
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Hover preview */}
      {showPreview && data.previewRows && data.previewColumns && (
        <PreviewTooltip rows={data.previewRows} columns={data.previewColumns} />
      )}

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

        {data.status === 'success' && data.stats && (data.stats.rows > 0 || data.stats.cols > 0) && (
          <div className="mt-2 flex items-center gap-2 text-[10px] text-emerald-700">
            <span className="bg-emerald-100 px-1.5 py-0.5 rounded font-medium">{data.stats.rows.toLocaleString()} rows</span>
            <span className="bg-emerald-100 px-1.5 py-0.5 rounded font-medium">{data.stats.cols} cols</span>
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
          onClick={handleSourceClick}
        />
      )}
    </div>
  );
}
