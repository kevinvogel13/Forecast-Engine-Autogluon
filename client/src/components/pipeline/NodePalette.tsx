import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Database, 
  GitMerge, 
  Filter, 
  Settings2, 
  Binary, 
  Code2, 
  FileOutput,
  Plus,
  X,
  Table2,
  Layers,
  LineChart,
  FileText,
  Eraser,
  CalendarClock,
  ShieldAlert,
  Columns3,
  CopyMinus,
  ArrowRightLeft
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NodePaletteProps {
  onDragStart: (event: React.DragEvent, nodeType: string, label: string) => void;
  onAddNode: (nodeType: string, label: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const categories = [
  {
    label: 'Source',
    nodes: [
      { type: 'input', label: 'Data Source', icon: Database, color: 'bg-blue-100 text-blue-600', description: 'Import data from file or SQL' },
    ]
  },
  {
    label: 'Prep',
    nodes: [
      { type: 'filter', label: 'Filter', icon: Filter, color: 'bg-yellow-100 text-yellow-600', description: 'Filter rows by condition' },
      { type: 'fillMissing', label: 'Fill Missing', icon: Eraser, color: 'bg-yellow-100 text-yellow-600', description: 'Fill NaN/null values' },
      { type: 'removeDuplicates', label: 'Remove Duplicates', icon: CopyMinus, color: 'bg-yellow-100 text-yellow-600', description: 'Deduplicate rows' },
      { type: 'outlierTreatment', label: 'Outlier Treatment', icon: ShieldAlert, color: 'bg-yellow-100 text-yellow-600', description: 'Detect & treat outliers' },
      { type: 'sampling', label: 'Sampling', icon: Layers, color: 'bg-yellow-100 text-yellow-600', description: 'Stratified group sampling' },
      { type: 'merge', label: 'Merge / Join', icon: GitMerge, color: 'bg-yellow-100 text-yellow-600', description: 'Combine multiple datasets' },
      { type: 'columnTransform', label: 'Column Transform', icon: Columns3, color: 'bg-yellow-100 text-yellow-600', description: 'Rename, drop, cast columns' },
      { type: 'dateGapFill', label: 'Date Gap Filler', icon: CalendarClock, color: 'bg-yellow-100 text-yellow-600', description: 'Fill missing time periods' },
      { type: 'pivotUnpivot', label: 'Pivot / Unpivot', icon: ArrowRightLeft, color: 'bg-yellow-100 text-yellow-600', description: 'Reshape wide ↔ long' },
      { type: 'python', label: 'Python Script', icon: Code2, color: 'bg-yellow-100 text-yellow-600', description: 'Custom Python transform' },
      { type: 'sql', label: 'SQL Transform', icon: Binary, color: 'bg-yellow-100 text-yellow-600', description: 'SQL-based transformation' },
    ]
  },
  {
    label: 'Analysis',
    nodes: [
      { type: 'preview', label: 'Data Preview', icon: Table2, color: 'bg-emerald-100 text-emerald-600', description: 'View head of dataframe' },
      { type: 'exploration', label: 'Exploration', icon: LineChart, color: 'bg-emerald-100 text-emerald-600', description: 'Single chart/analysis component' },
      { type: 'report', label: 'Report', icon: FileText, color: 'bg-emerald-100 text-emerald-600', description: 'Combine charts into HTML report' },
    ]
  },
  {
    label: 'Model',
    nodes: [
      { type: 'config', label: 'Model Config', icon: Settings2, color: 'bg-violet-100 text-violet-600', description: 'Configure forecast model' },
      { type: 'output', label: 'Output', icon: FileOutput, color: 'bg-violet-100 text-violet-600', description: 'View forecast results' },
    ]
  }
];

export default function NodePalette({ onDragStart, onAddNode, isOpen, onToggle }: NodePaletteProps) {
  return (
    <div className="absolute top-4 left-4 z-20">
      <Button 
        size="icon" 
        className={cn(
          "w-12 h-12 rounded-full shadow-lg transition-all duration-300",
          isOpen 
            ? "bg-slate-700 hover:bg-slate-800" 
            : "bg-blue-600 hover:bg-blue-700"
        )}
        onClick={onToggle}
        data-testid="button-add-component"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
      </Button>
      
      {isOpen && (
        <Card className="absolute top-16 left-0 shadow-xl border-border/60 bg-white w-72 animate-in fade-in slide-in-from-top-2 duration-200 max-h-[80vh] overflow-hidden flex flex-col">
          <CardContent className="p-3 overflow-y-auto">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
              Tap to add or drag onto canvas
            </p>
            <div className="space-y-3">
              {categories.map((category) => (
                <div key={category.label}>
                  <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest px-1 mb-1">
                    {category.label}
                  </p>
                  <div className="space-y-0.5">
                    {category.nodes.map((node) => (
                      <div
                        key={node.type}
                        className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-50 rounded-lg transition-all border border-transparent hover:border-slate-200 hover:shadow-sm group active:bg-slate-100"
                        draggable
                        onDragStart={(event) => {
                          onDragStart(event, node.type, node.label);
                          onToggle();
                        }}
                        onClick={() => {
                          onAddNode(node.type, node.label);
                          onToggle();
                        }}
                        data-testid={`palette-${node.type}`}
                      >
                        <div className={cn("p-1.5 rounded-md", node.color)}>
                          <node.icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-800">{node.label}</p>
                          <p className="text-[10px] text-muted-foreground truncate leading-tight">{node.description}</p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-blue-600 font-medium">
                          TAP
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
