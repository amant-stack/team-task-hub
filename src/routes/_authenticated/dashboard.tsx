import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, FolderKanban, ListTodo, Clock3, AlertTriangle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

interface Project { id: string; name: string; description: string | null; created_by: string; created_at: string; }
interface Task { id: string; project_id: string; title: string; status: "todo" | "in_progress" | "done"; due_date: string | null; assignee_id: string | null; }
interface MemberRow { project_id: string; role: "admin" | "member"; }

function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [memberships, setMemberships] = useState<Record<string, "admin" | "member">>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: mems } = await supabase.from("project_members").select("project_id, role");
    const memMap: Record<string, "admin" | "member"> = {};
    (mems as MemberRow[] | null)?.forEach((m) => { memMap[m.project_id] = m.role; });
    setMemberships(memMap);
    const { data: projs } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    setProjects((projs as Project[]) ?? []);
    const { data: ts } = await supabase.from("tasks").select("id, project_id, title, status, due_date, assignee_id");
    setTasks((ts as Task[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const myTasks = tasks.filter((t) => t.assignee_id === user?.id);
    const today = new Date(); today.setHours(0,0,0,0);
    const overdue = tasks.filter((t) => t.status !== "done" && t.due_date && new Date(t.due_date) < today).length;
    return {
      total: tasks.length,
      todo: tasks.filter((t) => t.status === "todo").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      done: tasks.filter((t) => t.status === "done").length,
      mine: myTasks.length,
      overdue,
    };
  }, [tasks, user]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreating(true);
    const { data: project, error } = await supabase
      .from("projects")
      .insert({ name: newName.trim(), description: newDesc.trim() || null, created_by: user.id })
      .select()
      .single();
    if (error || !project) {
      setCreating(false);
      toast.error(error?.message ?? "Failed to create project");
      return;
    }
    const { error: memErr } = await supabase
      .from("project_members")
      .insert({ project_id: project.id, user_id: user.id, role: "admin" });
    setCreating(false);
    if (memErr) { toast.error(memErr.message); return; }
    toast.success("Project created");
    setCreateOpen(false);
    setNewName(""); setNewDesc("");
    await load();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your projects and tasks.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" />New project</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Create a project</DialogTitle>
                <DialogDescription>You'll become the project admin.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="p-name">Name</Label>
                  <Input id="p-name" required maxLength={120} value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-desc">Description</Label>
                  <Textarea id="p-desc" maxLength={500} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<ListTodo className="h-4 w-4" />} label="Total tasks" value={stats.total} />
        <StatCard icon={<Clock3 className="h-4 w-4" />} label="In progress" value={stats.in_progress} />
        <StatCard icon={<FolderKanban className="h-4 w-4" />} label="Assigned to me" value={stats.mine} />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Overdue" value={stats.overdue} tone={stats.overdue > 0 ? "danger" : undefined} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatusCard label="To Do" count={stats.todo} status="todo" />
        <StatusCard label="In Progress" count={stats.in_progress} status="in_progress" />
        <StatusCard label="Done" count={stats.done} status="done" />
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Your projects</h2>
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : projects.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No projects yet. Create one to get started.</CardContent></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const role = memberships[p.id] ?? "member";
              const projTasks = tasks.filter((t) => t.project_id === p.id);
              const open = projTasks.filter((t) => t.status !== "done").length;
              return (
                <Link key={p.id} to="/projects/$projectId" params={{ projectId: p.id }}>
                  <Card className="hover:border-primary/50 transition-colors h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{p.name}</CardTitle>
                        <Badge variant={role === "admin" ? "default" : "secondary"}>{role}</Badge>
                      </div>
                      <CardDescription className="line-clamp-2">{p.description || "No description"}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xs text-muted-foreground">{projTasks.length} task{projTasks.length === 1 ? "" : "s"} · {open} open</div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: "danger" }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div>
        <div className={`mt-2 text-3xl font-bold ${tone === "danger" && value > 0 ? "text-destructive" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function StatusCard({ label, count, status }: { label: string; count: number; status: "todo" | "in_progress" | "done" }) {
  const color = `var(--status-${status})`;
  return (
    <Card>
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold">{count}</div>
        </div>
        <span className="h-3 w-3 rounded-full" style={{ background: color }} />
      </CardContent>
    </Card>
  );
}
