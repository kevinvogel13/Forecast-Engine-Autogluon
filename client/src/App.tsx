import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Pipeline from "@/pages/pipeline";
import Validate from "@/pages/validate";
import Settings from "@/pages/settings";
import ForecastResult from "@/pages/forecast-result";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Pipeline} />
      <Route path="/pipeline" component={() => <Redirect to="/" />} />
      <Route path="/validate" component={Validate} />
      <Route path="/settings" component={Settings} />
      <Route path="/forecast-result" component={ForecastResult} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;