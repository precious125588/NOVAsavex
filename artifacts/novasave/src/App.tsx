import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import History from "@/pages/History";
import Admin from "@/pages/Admin";
import FAQ from "@/pages/FAQ";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import VideoStudio from "@/pages/VideoStudio";
import Music from "@/pages/Music";
import Movies from "@/pages/Movies";
import Adult from "@/pages/Adult";
import Anime from "@/pages/Anime";
import StatusHub from "@/pages/StatusHub";
import CodeDebugger from "@/pages/CodeDebugger";
import Tools from "@/pages/Tools";
import Trending from "@/pages/Trending";
import Booster from "@/pages/Booster";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/studio" component={VideoStudio} />
      <Route path="/history" component={History} />
      <Route path="/music" component={Music} />
      <Route path="/movies" component={Movies} />
      <Route path="/anime" component={Anime} />
      <Route path="/adult" component={Adult} />
      <Route path="/status" component={StatusHub} />
      <Route path="/debug" component={CodeDebugger} />
      <Route path="/tools" component={Tools} />
      <Route path="/trending" component={Trending} />
      <Route path="/boost" component={Booster} />
      <Route path="/admin" component={Admin} />
      <Route path="/faq" component={FAQ} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
