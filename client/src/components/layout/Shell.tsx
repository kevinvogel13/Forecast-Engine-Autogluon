import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { GitMerge } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
          <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm px-6 flex items-center justify-between shrink-0 z-10">
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground text-xs font-mono font-bold shrink-0 cursor-default" data-testid="app-logo">FP</div>
               <h1 className="text-sm font-medium text-muted-foreground ml-2" data-testid="app-title">
                 Forecasting Pipeline
               </h1>
            </div>
          </header>
          
          <div className="flex-1 overflow-auto p-6 scroll-smooth">
            <div className="max-w-7xl mx-auto h-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}