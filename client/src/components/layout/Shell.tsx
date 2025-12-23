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
        {/* Sidebar */}
        <aside className="w-16 border-r border-border bg-card flex flex-col z-20 transition-all duration-300 ease-in-out">
          <div className="h-14 border-b border-border flex items-center justify-center px-4">
            <div className="flex items-center gap-2 font-semibold text-lg text-primary min-w-max">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground text-xs font-mono font-bold shrink-0 cursor-default">F</div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Forecaster</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          
          <nav className="flex-1 p-2 space-y-2 overflow-hidden flex flex-col items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/" className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-md transition-colors cursor-pointer",
                    "bg-primary/10 text-primary" 
                  )}>
                    <GitMerge className="w-5 h-5 shrink-0" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Pipeline</p>
              </TooltipContent>
            </Tooltip>
          </nav>

          <div className="p-4 border-t border-border overflow-hidden flex justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-medium shrink-0 cursor-pointer hover:bg-accent/80 transition-colors">
                  JD
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <div className="text-xs">
                  <div className="font-medium">John Doe</div>
                  <div className="text-muted-foreground">Data Scientist</div>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
          <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm px-6 flex items-center justify-between shrink-0 z-10">
            <h1 className="text-sm font-medium text-muted-foreground">
              Pipeline Designer
            </h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
               <span>Project: Q3 Forecasting</span>
               <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
               <span>Online</span>
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