import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { GitMerge } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const HEADER_PORTAL_ID = "header-actions-portal";

export default function Shell({ children, fullBleed }: { children: React.ReactNode; fullBleed?: boolean }) {
  const [location] = useLocation();

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
          <header className="h-12 border-b border-border bg-card/50 backdrop-blur-sm px-4 flex items-center justify-between shrink-0 z-10">
            <div className="flex items-center gap-2">
               <div className="w-7 h-7 rounded bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-mono font-bold shrink-0 cursor-default" data-testid="app-logo">FP</div>
               <h1 className="text-sm font-medium text-muted-foreground ml-1" data-testid="app-title">
                 Forecasting Pipeline
               </h1>
            </div>
            <div id={HEADER_PORTAL_ID} className="flex items-center gap-2" data-testid="header-actions" />
          </header>
          
          {fullBleed ? (
            <div className="flex-1 overflow-hidden">
              {children}
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-6 scroll-smooth">
              <div className="max-w-7xl mx-auto h-full">
                {children}
              </div>
            </div>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}
