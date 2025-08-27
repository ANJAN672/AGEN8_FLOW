import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";
import GmailOAuthCallback from "./pages/oauth/gmail-callback";
import { useEffect } from "react";
import { useNodes } from "@/state/nodes";
import { SlackChannelAutoLoader } from "@/components/realtime/SlackChannelAutoLoader";

type AppInitProps = { children: React.ReactNode };

const AppInit = ({ children }: AppInitProps) => {
  // Eagerly fetch nodes registry once at app start
  const { registry, loading, fetchRegistry } = useNodes();
  useEffect(() => {
    if (!registry && !loading) {
      void fetchRegistry();
    }
  }, [registry, loading, fetchRegistry]);
  return <>{children}</>;
};

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <SlackChannelAutoLoader />
        <BrowserRouter>
          <AppInit>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/oauth/gmail-callback" element={<GmailOAuthCallback />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppInit>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
