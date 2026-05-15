import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, UserPlus, Loader2, CalendarDays } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  component: ProjectPage,
});

interface Project { id: string; name: string; description: string | null; created_by: string; }
type Role = "admin" | "member";
interface MemberRow { id: string; user_id: string; role: Role; }
interface Profile { id: string; name: string; email: string; }
type Status = "todo" | "in_progress" | "done";
type Priority = "low" | "medium" | "high";
interface Task {
  id: string; project_id: string; title: string; description: string | null;
  due_date: string | null; priority: Priority; status: Status;
  assignee_id: string | null; created_by: string; created_at: string;
}

const STATUSES: { key: Status; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

function ProjectPage() {
  const { projectId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // dialogs / forms
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  const [taskOpen, setTaskOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tTitle, setTTitle] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [tDue, setTDue] = useState("");
  const [tPriority, setTPriority] = useState<Priority>("medium");
  const [tAssignee, setTAssignee] = useState<string>("");

  const myRole: Role | null = useMemo(() => {
    const m = members.find((x) => x.user_id === user?.id);
    return m?.role ?? null;
  }, [members, user]);
  const isAdmin = myRole === "admin";

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: ms }, { data: ts }] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
      supabase.from("project_members").select("id, user_id, role").eq("project_id", projectId),
      supabase.from("tasks").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    ]);
    setProject(p as Project | null);
    setMembers((ms as MemberRow[]) ?? []);
    setTasks((ts as Task[]) ?? []);
    const ids = (ms as MemberRow[] | null)?.map((m) => m.user_id) ?? [];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, name, email").in("id", ids);
      const map: Record<string, Profile> = {};
      (profs as Profile[] | null)?.forEach((pr) => { map[pr.id] = pr; });
      setProfiles(map);
    } else {
      setProfiles({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId]);

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    setAddingMember(true);
    const email = memberEmail.trim().toLowerCase();
    const { data: prof, error: pErr } = await supabase
      .from("profiles").select("id").ilike("email", email).maybeSingle();
    if (pErr || !prof) {
      setAddingMember(false);
      toast.error("No user with that email. They need to sign up first.");
      return;
    }
    const { error } = await supabase
      .from("project_members")
      .insert({ project_id: projectId, user_id: prof.id, role: "member" });
    setAddingMember(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Member added");
    setMemberEmail(""); setAddMemberOpen(false);
    await load();
  };

  const handleRemoveMember = async (memberId: string, userId: string) => {
    if (userId === project?.created_by) { toast.error("Cannot remove the project owner"); return; }
    const { error } = await supabase.from("project_members").delete().eq("id", memberId);
    if (error) { toast.error(error.message); return; }
    toast.success("Member removed");
    await load();
  };

  const handleCreateTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreating(true);
    const { error } = await supabase.from("tasks").insert({
      project_id: projectId,
      title: tTitle.trim(),
      description: tDesc.trim() || null,
      due_date: tDue || null,
      priority: tPriority,
      assignee_id: tAssignee || null,
      created_by: user.id,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Task created");
    setTaskOpen(false);
    setTTitle(""); setTDesc(""); setTDue(""); setTPriority("medium"); setTAssignee("");
    await load();
  };

  const updateStatus = async (task: Task, status: Status) => {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", task.id);
    if (error) { toast.error(error.message); return; }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)));
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Task deleted");
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const deleteProject = async () => {
    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (error) { toast.error(error.message); return; }
    toast.success("Project deleted");
    navigate({ to: "/dashboard" });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!project) {
    return <div className="text-center py-20"><p className="text-muted-foreground">Project not found or you don't have access.</p><Link to="/dashboard" className="text-primary text-sm mt-2 inline-block">Back to dashboard</Link></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <Badge variant={isAdmin ? "default" : "secondary"}>{myRole}</Badge>
            </div>
            {project.description && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{project.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
                <DialogTrigger asChild><Button><Plus className="h-4 w-4" />New task</Button></DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleCreateTask}>
                    <DialogHeader>
                      <DialogTitle>Create task</DialogTitle>
                      <DialogDescription>Fill in the task details below.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2"><Label htmlFor="t-title">Title</Label><Input id="t-title" required maxLength={200} value={tTitle} onChange={(e) => setTTitle(e.target.value)} /></div>
                      <div className="space-y-2"><Label htmlFor="t-desc">Description</Label><Textarea id="t-desc" maxLength={1000} value={tDesc} onChange={(e) => setTDesc(e.target.value)} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2"><Label htmlFor="t-due">Due date</Label><Input id="t-due" type="date" value={tDue} onChange={(e) => setTDue(e.target.value)} /></div>
                        <div className="space-y-2">
                          <Label>Priority</Label>
                          <Select value={tPriority} onValueChange={(v) => setTPriority(v as Priority)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Assignee</Label>
                        <Select value={tAssignee || "none"} onValueChange={(v) => setTAssignee(v === "none" ? "" : v)}>
                          <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Unassigned</SelectItem>
                            {members.map((m) => (
                              <SelectItem key={m.user_id} value={m.user_id}>{profiles[m.user_id]?.name ?? profiles[m.user_id]?.email ?? "Unknown"}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter><Button type="submit" disabled={creating}>{creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create task</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="outline" size="icon" aria-label="Delete project"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Delete this project?</AlertDialogTitle><AlertDialogDescription>This permanently removes the project, its members, and all tasks.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={deleteProject}>Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <section>
          <h2 className="text-lg font-semibold mb-3">Tasks</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {STATUSES.map(({ key, label }) => {
              const colTasks = tasks.filter((t) => t.status === key);
              return (
                <div key={key} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: `var(--status-${key})` }} />
                      <h3 className="font-medium text-sm">{label}</h3>
                    </div>
                    <span className="text-xs text-muted-foreground">{colTasks.length}</span>
                  </div>
                  <div className="space-y-2 min-h-[100px]">
                    {colTasks.map((t) => (
                      <TaskCard key={t.id} task={t} profiles={profiles} canEdit={isAdmin || t.assignee_id === user?.id} canDelete={isAdmin} onStatus={(s) => updateStatus(t, s)} onDelete={() => deleteTask(t.id)} />
                    ))}
                    {colTasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No tasks</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Members ({members.length})</CardTitle>
                {isAdmin && (
                  <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                    <DialogTrigger asChild><Button size="sm" variant="outline"><UserPlus className="h-3.5 w-3.5" />Add</Button></DialogTrigger>
                    <DialogContent>
                      <form onSubmit={handleAddMember}>
                        <DialogHeader><DialogTitle>Add member</DialogTitle><DialogDescription>Enter the email of an existing user.</DialogDescription></DialogHeader>
                        <div className="py-4 space-y-2">
                          <Label htmlFor="m-email">Email</Label>
                          <Input id="m-email" type="email" required value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
                        </div>
                        <DialogFooter><Button type="submit" disabled={addingMember}>{addingMember && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add member</Button></DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {members.map((m) => {
                const p = profiles[m.user_id];
                const isOwner = m.user_id === project.created_by;
                return (
                  <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-primary/15 text-primary text-xs font-medium flex items-center justify-center">{(p?.name ?? p?.email ?? "?")[0].toUpperCase()}</div>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{p?.name ?? "Unknown"}</div>
                        <div className="truncate text-xs text-muted-foreground">{p?.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant={m.role === "admin" ? "default" : "secondary"} className="text-[10px]">{m.role}</Badge>
                      {isAdmin && !isOwner && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveMember(m.id, m.user_id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function TaskCard({ task, profiles, canEdit, canDelete, onStatus, onDelete }: {
  task: Task; profiles: Record<string, Profile>; canEdit: boolean; canDelete: boolean;
  onStatus: (s: Status) => void; onDelete: () => void;
}) {
  const assignee = task.assignee_id ? profiles[task.assignee_id] : null;
  const today = new Date(); today.setHours(0,0,0,0);
  const overdue = task.due_date && task.status !== "done" && new Date(task.due_date) < today;
  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-medium leading-snug">{task.title}</div>
          <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded" style={{ background: `color-mix(in oklch, var(--priority-${task.priority}) 18%, transparent)`, color: `var(--priority-${task.priority})` }}>{task.priority}</span>
        </div>
        {task.description && <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>}
        <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {task.due_date && (
              <span className={`flex items-center gap-1 ${overdue ? "text-destructive" : ""}`}>
                <CalendarDays className="h-3 w-3" />{new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="truncate">{assignee ? assignee.name : "Unassigned"}</div>
        </div>
        <div className="flex items-center gap-1 pt-1">
          {canEdit ? (
            <Select value={task.status} onValueChange={(v) => onStatus(v as Status)}>
              <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="text-xs text-muted-foreground flex-1">View only</div>
          )}
          {canDelete && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
