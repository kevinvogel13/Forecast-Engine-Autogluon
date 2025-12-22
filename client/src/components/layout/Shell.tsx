import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FileSpreadsheet, GitMerge, Settings } from "lucide-react";
import { useState } from "react";

export default function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(true);

  const navItems = [
    { icon: GitMerge, label: "Pipeline", href: "/" },
    { icon: LayoutDashboard, label: "Validation", href: "/validate" },
    { icon: Settings, label: "Settings", href: "/settings" },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={cn(
          "border-r border-border bg-card flex flex-col z-20 transition-all duration-300 ease-in-out",
          isCollapsed ? "w-16" : "w-64"
        )}
        onMouseEnter={() => setIsCollapsed(false)}
        onMouseLeave={() => setIsCollapsed(true)}
      >
        <div className={cn(
          "h-14 border-b border-border flex items-center overflow-hidden transition-all",
          isCollapsed ? "px-4 justify-center" : "px-6"
        )}>
          <div className="flex items-center gap-2 font-semibold text-lg text-primary min-w-max">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground text-xs font-mono font-bold shrink-0">F</div>
            <span className={cn(
              "transition-opacity duration-300",
              isCollapsed ? "opacity-0 w-0" : "opacity-100"
            )}>
              Forecaster
            </span>
          </div>
        </div>
        
        <nav className="flex-1 p-2 space-y-1 overflow-hidden">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer min-w-max",
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  isCollapsed && "justify-center px-0"
                )}>
                  <item.icon className="w-5 h-5 shrink-0" />
                  <span className={cn(
                    "transition-all duration-300",
                    isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                  )}>
                    {item.label}
                  </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border overflow-hidden">
          <div className={cn(
            "flex items-center gap-3 transition-all min-w-max",
            isCollapsed && "justify-center"
          )}>
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-medium shrink-0">
              JD
            </div>
            <div className={cn(
              "text-xs transition-opacity duration-300",
               isCollapsed ? "opacity-0 w-0" : "opacity-100"
            )}>
              <div className="font-medium text-foreground">John Doe</div>
              <div className="text-muted-foreground">Data Scientist</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm px-6 flex items-center justify-between shrink-0 z-10">
          <h1 className="text-sm font-medium text-muted-foreground">
            {navItems.find(i => i.href === location)?.label || 'Dashboard'}
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
  );
}