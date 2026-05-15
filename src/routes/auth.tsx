import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const DEMO_EMAIL = "demo@teamtasks.app";
const DEMO_PASSWORD = "DemoUser2024!Secure";

function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (!loading && user) return <Navigate to="/dashboard" />;

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setBusy(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Welcome back");
      navigate({ to: "/dashboard" });
    }
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    const { error } = await signUp(name, email, password);
    setBusy(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Account created — you're signed in");
      navigate({ to: "/dashboard" });
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-primary to-primary/70 p-12 text-primary-foreground">
        <div className="text-2xl font-bold tracking-tight">TeamTasks</div>
        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight">
            Run projects.<br/>Ship together.
          </h1>
          <p className="text-primary-foreground/80 max-w-sm">
            A focused workspace for teams to plan projects, assign tasks, and track progress in real time.
          </p>
          <ul className="space-y-3 text-primary-foreground/90 text-sm">
            {["Create projects and invite teammates", "Assign tasks with priority & due dates", "Track To Do · In Progress · Done", "Admin / Member roles built in"].map((t) => (
              <li key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{t}</li>
            ))}
          </ul>
        </div>
        <div className="text-xs text-primary-foreground/60">© TeamTasks</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome to TeamTasks</CardTitle>
            <CardDescription>Sign in or create an account to get started.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Log in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input id="login-password" type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Log in
                  </Button>
                </form>
                <div className="mt-4 rounded-lg border border-dashed bg-muted/40 p-4 text-center space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Demo Account</p>
                  <div className="text-sm space-y-1">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-muted-foreground">Email:</span>
                      <code className="text-xs bg-background px-1.5 py-0.5 rounded">{DEMO_EMAIL}</code>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-muted-foreground">Password:</span>
                      <code className="text-xs bg-background px-1.5 py-0.5 rounded">{DEMO_PASSWORD}</code>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={async () => {
                      setLoginEmail(DEMO_EMAIL);
                      setLoginPassword(DEMO_PASSWORD);
                      setBusy(true);
                      const { error } = await signIn(DEMO_EMAIL, DEMO_PASSWORD);
                      setBusy(false);
                      if (error) {
                        toast.error(error);
                      } else {
                        toast.success("Welcome, Demo User");
                        navigate({ to: "/dashboard" });
                      }
                    }}
                    disabled={busy}
                  >
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Use Demo Account
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="su-name">Name</Label>
                    <Input id="su-name" required value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-email">Email</Label>
                    <Input id="su-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-password">Password</Label>
                    <Input id="su-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
