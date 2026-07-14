import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Classes from "./pages/Classes";
import ClassDetail from "./pages/ClassDetail";
import Students from "./pages/Students";
import StudentDetail from "./pages/StudentDetail";
import AdminPanel from "./pages/AdminPanel";
import ChangePassword from "./pages/ChangePassword";
import Archive from "./pages/Archive";
import AppLayout from "./components/AppLayout";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import { useAuth } from "./_core/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { useEnrollmentChime } from "./hooks/useEnrollmentChime";

function EnrollmentChimeProvider() {
  const { user } = useAuth();
  useEnrollmentChime(!!user);
  return null;
}

function ProtectedRoute({ component: Component, roles }: { component: React.ComponentType; roles?: string[] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
          <p className="text-muted-foreground mt-2">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/classes">
        {() => <ProtectedRoute component={Classes} />}
      </Route>
      <Route path="/classes/:id">
        {() => <ProtectedRoute component={ClassDetail} />}
      </Route>
      <Route path="/students">
        {() => <ProtectedRoute component={Students} />}
      </Route>
      <Route path="/students/:id">
        {() => <ProtectedRoute component={StudentDetail} />}
      </Route>
      <Route path="/admin">
        {() => <ProtectedRoute component={AdminPanel} roles={["super_admin", "admin"]} />}
      </Route>
      <Route path="/archive">
        {() => <ProtectedRoute component={Archive} roles={["super_admin", "admin"]} />}
      </Route>
      <Route path="/change-password">
        {() => <ProtectedRoute component={ChangePassword} />}
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster theme="dark" position="top-right" />
          <EnrollmentChimeProvider />
          <Router />
          <PWAInstallPrompt />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
