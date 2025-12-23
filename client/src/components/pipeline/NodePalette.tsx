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
  FileOutput
} from "lucide-react";

export default function NodePalette({ onDragStart }: { onDragStart: (event: React.DragEvent, nodeType: string, label: string) => void }) {
  const nodes = [
    { type: 'input', label: 'Data Source', icon: Database, color: 'text-blue-500' },
    { type: 'merge', label: 'Merge / Join', icon: GitMerge, color: 'text-orange-500' },
    { type: 'filter', label: 'Filter', icon: Filter, color: 'text-purple-500' },
    { type: 'eda', label: 'Validation', icon: BarChart3, color: 'text-green-500' },
    { type: 'python', label: 'Python Script', icon: Code2, color: 'text-yellow-500' },
    { type: 'sql', label: 'SQL Transform', icon: Binary, color: 'text-cyan-500' },
    { type: 'config', label: 'Model Config', icon: Settings2, color: 'text-slate-500' },
    { type: 'output', label: 'Output', icon: FileOutput, color: 'text-red-500' },
  ];

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
      <Card className="shadow-lg border-border/60 bg-white/90 backdrop-blur-sm">
        <CardContent className="p-2 flex gap-2">
          {nodes.map((node) => (
            <div
              key={node.type}
              className="flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing p-2 hover:bg-muted rounded-md transition-colors w-20 group"
              draggable
              onDragStart={(event) => onDragStart(event, node.type, node.label)}
            >
              <div className={`p-2 rounded-full bg-slate-100 group-hover:bg-white border border-transparent group-hover:border-slate-200 transition-all ${node.color}`}>
                <node.icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">{node.label}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}