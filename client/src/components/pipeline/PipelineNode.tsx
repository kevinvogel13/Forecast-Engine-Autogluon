import { Handle, Position } from '@xyflow/react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, GitMerge, Filter, Calculator, Database, AlertCircle } from 'lucide-react';
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
  };
  selected?: boolean;
}

const getIcon = (type: string) => {
  switch (type) {
    case 'input': return FileSpreadsheet;
    case 'merge': return GitMerge;
    case 'filter': return Filter;
    case 'transform': return Calculator;
    case 'output': return Database;
    default: return FileSpreadsheet;
  }
};

const getStatusColor = (status?: string) => {
  switch (status) {
    case 'success': return 'border-green-500 shadow-[0_0_10px_-2px_rgba(34,197,94,0.3)]';
    case 'error': return 'border-red-500 shadow-[0_0_10px_-2px_rgba(239,68,68,0.3)]';
    case 'processing': return 'border-blue-500 shadow-[0_0_10px_-2px_rgba(59,130,246,0.3)] animate-pulse';
    default: return 'border-border';
  }
};

export default function PipelineNode({ data, selected }: PipelineNodeProps) {
  const Icon = getIcon(data.type);
  const statusClass = getStatusColor(data.status);

  return (
    <div className={cn(
      "group relative min-w-[200px] rounded-lg bg-card border-2 transition-all duration-200",
      statusClass,
      selected && "ring-2 ring-primary ring-offset-2 border-primary"
    )}>
      {/* Input Handle */}
      {data.type !== 'input' && (
        <Handle 
          type="target" 
          position={Position.Left} 
          className="!w-3 !h-3 !-left-2 !bg-muted-foreground border-2 border-background" 
        />
      )}

      <div className="p-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className={cn(
            "p-1.5 rounded-md",
            data.type === 'input' ? "bg-blue-100 text-blue-600" :
            data.type === 'output' ? "bg-green-100 text-green-600" :
            "bg-muted text-muted-foreground"
          )}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-card-foreground">{data.label}</p>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{data.type}</p>
          </div>
        </div>

        {/* Stats Grid */}
        {data.stats && (
          <div className="grid grid-cols-2 gap-1 mt-2 pt-2 border-t border-border/50">
            <div className="bg-muted/50 rounded px-2 py-1">
              <p className="text-[10px] text-muted-foreground uppercase">Rows</p>
              <p className="text-xs font-mono font-medium">{data.stats.rows.toLocaleString()}</p>
            </div>
            <div className="bg-muted/50 rounded px-2 py-1">
              <p className="text-[10px] text-muted-foreground uppercase">Cols</p>
              <p className="text-xs font-mono font-medium">{data.stats.cols}</p>
            </div>
            {data.stats.volume && (
              <div className="col-span-2 bg-muted/50 rounded px-2 py-1 mt-1">
                 <div className="flex justify-between items-center">
                    <p className="text-[10px] text-muted-foreground uppercase">Total Vol</p>
                    <p className="text-xs font-mono font-medium text-primary">{data.stats.volume}</p>
                 </div>
              </div>
            )}
          </div>
        )}

        {/* Error State */}
        {data.status === 'error' && (
           <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 px-2 py-1 rounded">
              <AlertCircle className="w-3 h-3" />
              <span className="font-medium">Schema Mismatch</span>
           </div>
        )}
      </div>

      {/* Output Handle */}
      {data.type !== 'output' && (
        <Handle 
          type="source" 
          position={Position.Right} 
          className="!w-3 !h-3 !-right-2 !bg-muted-foreground border-2 border-background" 
        />
      )}
    </div>
  );
}