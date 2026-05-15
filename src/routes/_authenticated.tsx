import { createFileRoute, Outlet, Navigate, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Loader2, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" />;

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  const initials = (user.user_metadata?.name as string | undefined)?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
            <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-sm">T</div>
            TeamTasks
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            <Link to="/dashboard" className="px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-1.5" activeProps={{ className: "px-3 py-1.5 text-sm rounded-md text-foreground bg-accent flex items-center gap-1.5" }}>
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">{initials}</div>
              <span className="hidden sm:inline text-muted-foreground">{user.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
