import { FileSpreadsheet, GitMerge, Filter, Calculator, Database, Layers, ListTree, TableProperties, Code, HardDrive, History } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

export default function Sidebar() {
  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow/type', nodeType);
    event.dataTransfer.setData('application/reactflow/label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  const DraggableIcon = ({ type, label, icon: Icon, colorClass, borderClass }: { type: string, label: string, icon: any, colorClass: string, borderClass: string }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <div 
          className={`bg-card border-2 border-border p-3 rounded-lg cursor-grab shadow-sm hover:shadow-md transition-all flex items-center justify-center w-10 h-10 ${borderClass}`}
          onDragStart={(event) => onDragStart(event, type, label)}
          draggable
        >
          <Icon className={`w-5 h-5 ${colorClass}`} />
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );

  return (
    <TooltipProvider delayDuration={0}>
      <div className="w-16 bg-card border-l border-border py-4 flex flex-col items-center gap-4 overflow-y-auto overflow-x-hidden h-full">
        
        <div className="flex flex-col gap-3 w-full items-center">
          <DraggableIcon 
            type="input" 
            label="File Source" 
            icon={FileSpreadsheet} 
            colorClass="text-blue-500" 
            borderClass="hover:border-blue-200 hover:bg-blue-50/50" 
          />
          <DraggableIcon 
            type="sql" 
            label="SQL Query" 
            icon={Database} 
            colorClass="text-cyan-600" 
            borderClass="hover:border-cyan-200 hover:bg-cyan-50/50" 
          />
        </div>

        <Separator className="w-8" />

        <div className="flex flex-col gap-3 w-full items-center">
          <DraggableIcon 
            type="merge" 
            label="Merge / Join" 
            icon={GitMerge} 
            colorClass="text-orange-500" 
            borderClass="hover:border-orange-200 hover:bg-orange-50/50" 
          />
          <DraggableIcon 
            type="union" 
            label="Union" 
            icon={Layers} 
            colorClass="text-orange-500" 
            borderClass="hover:border-orange-200 hover:bg-orange-50/50" 
          />
          <DraggableIcon 
            type="filter" 
            label="Filter" 
            icon={Filter} 
            colorClass="text-purple-500" 
            borderClass="hover:border-purple-200 hover:bg-purple-50/50" 
          />
          <DraggableIcon 
            type="groupby" 
            label="Group By" 
            icon={ListTree} 
            colorClass="text-indigo-500" 
            borderClass="hover:border-indigo-200 hover:bg-indigo-50/50" 
          />
          <DraggableIcon 
            type="pivot" 
            label="Pivot" 
            icon={TableProperties} 
            colorClass="text-indigo-500" 
            borderClass="hover:border-indigo-200 hover:bg-indigo-50/50" 
          />
          <DraggableIcon 
            type="transform" 
            label="Transform" 
            icon={Calculator} 
            colorClass="text-indigo-500" 
            borderClass="hover:border-indigo-200 hover:bg-indigo-50/50" 
          />
          <DraggableIcon 
            type="python" 
            label="Python Script" 
            icon={Code} 
            colorClass="text-yellow-600" 
            borderClass="hover:border-yellow-200 hover:bg-yellow-50/50" 
          />
        </div>

        <Separator className="w-8" />

        <div className="flex flex-col gap-3 w-full items-center">
          <DraggableIcon 
            type="output" 
            label="Baseline Forecast" 
            icon={HardDrive} 
            colorClass="text-green-600" 
            borderClass="hover:border-green-200 hover:bg-green-50/50" 
          />
          <DraggableIcon 
            type="history" 
            label="Historic Data" 
            icon={History} 
            colorClass="text-slate-600" 
            borderClass="hover:border-slate-200 hover:bg-slate-50/50" 
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
