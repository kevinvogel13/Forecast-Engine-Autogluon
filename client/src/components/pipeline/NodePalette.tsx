import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Database, 
  GitMerge, 
  Filter, 
  Settings2, 
  BarChart3, 
  Binary, 
  Code2, 
  FileOutput,
  Plus,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NodePaletteProps {
  onDragStart: (event: React.DragEvent, nodeType: string, label: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export default function NodePalette({ onDragStart, isOpen, onToggle }: NodePaletteProps) {
  const nodes = [
    { type: 'input', label: 'Data Source', icon: Database, color: 'bg-blue-100 text-blue-600', description: 'Import data from file or SQL' },
    { type: 'merge', label: 'Merge / Join', icon: GitMerge, color: 'bg-orange-100 text-orange-600', description: 'Combine multiple datasets' },
    { type: 'filter', label: 'Filter', icon: Filter, color: 'bg-purple-100 text-purple-600', description: 'Filter rows by condition' },
    { type: 'eda', label: 'Validation', icon: BarChart3, color: 'bg-green-100 text-green-600', description: 'Validate and explore data' },
    { type: 'python', label: 'Python Script', icon: Code2, color: 'bg-yellow-100 text-yellow-600', description: 'Custom Python transform' },
    { type: 'sql', label: 'SQL Transform', icon: Binary, color: 'bg-cyan-100 text-cyan-600', description: 'SQL-based transformation' },
    { type: 'config', label: 'Model Config', icon: Settings2, color: 'bg-slate-100 text-slate-600', description: 'Configure forecast model' },
    { type: 'output', label: 'Output', icon: FileOutput, color: 'bg-red-100 text-red-600', description: 'View forecast results' },
  ];

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
        <Card className="absolute top-16 left-0 shadow-xl border-border/60 bg-white w-72 animate-in fade-in slide-in-from-top-2 duration-200">
          <CardContent className="p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
              Drag components onto canvas
            </p>
            <div className="space-y-1">
              {nodes.map((node) => (
                <div
                  key={node.type}
                  className="flex items-center gap-3 cursor-grab active:cursor-grabbing p-2.5 hover:bg-slate-50 rounded-lg transition-all border border-transparent hover:border-slate-200 hover:shadow-sm group"
                  draggable
                  onDragStart={(event) => {
                    onDragStart(event, node.type, node.label);
                    onToggle();
                  }}
                  data-testid={`palette-${node.type}`}
                >
                  <div className={cn("p-2 rounded-lg", node.color)}>
                    <node.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{node.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{node.description}</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-blue-600 font-medium">
                    DRAG
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
