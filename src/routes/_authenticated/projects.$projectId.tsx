import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback, type FormEvent, type DragEvent } from "react";
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
import { ArrowLeft, Plus, Trash2, UserPlus, Loader2, CalendarDays, Pencil, Shield, User, GripVertical, CircleDot, Clock3, CheckCircle2, MessageSquare } from "lucide-react";
import { TaskComments } from "@/components/TaskComments";

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
  const [memberEmails, setMemberEmails] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [addResults, setAddResults] = useState<{ email: string; ok: boolean; msg: string }[]>([]);

  const [taskOpen, setTaskOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tTitle, setTTitle] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [tDue, setTDue] = useState("");
  const [tPriority, setTPriority] = useState<Priority>("medium");
  const [tAssignee, setTAssignee] = useState<string>("");

  // Edit task state
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [eTitle, setETitle] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eDue, setEDue] = useState("");
  const [ePriority, setEPriority] = useState<Priority>("medium");
  const [eStatus, setEStatus] = useState<Status>("todo");
  const [eAssignee, setEAssignee] = useState<string>("");

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

  const handleAddMembers = async (e: FormEvent) => {
    e.preventDefault();
    setAddingMember(true);
    setAddResults([]);

    // Parse emails: split by comma, newline, semicolon, or space
    const emails = memberEmails
      .split(/[,;\n\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0 && e.includes("@"));

    if (emails.length === 0) {
      setAddingMember(false);
      toast.error("Please enter at least one valid email.");
      return;
    }

    // Deduplicate
    const unique = [...new Set(emails)];
    const existingUserIds = new Set(members.map((m) => m.user_id));
    const results: { email: string; ok: boolean; msg: string }[] = [];
    let addedCount = 0;

    for (const email of unique) {
      // Lookup user
      const { data: prof } = await supabase
        .from("profiles").select("id").ilike("email", email).maybeSingle();
      if (!prof) {
        results.push({ email, ok: false, msg: "User not found — they need to sign up first" });
        continue;
      }
      if (existingUserIds.has(prof.id)) {
        results.push({ email, ok: false, msg: "Already a member" });
        continue;
      }
      const { error } = await supabase
        .from("project_members")
        .insert({ project_id: projectId, user_id: prof.id, role: "member" });
      if (error) {
        results.push({ email, ok: false, msg: error.message });
      } else {
        results.push({ email, ok: true, msg: "Added" });
        existingUserIds.add(prof.id);
        addedCount++;
      }
    }

    setAddResults(results);
    setAddingMember(false);

    if (addedCount > 0) {
      toast.success(`${addedCount} member${addedCount > 1 ? "s" : ""} added`);
      await load();
    }
    if (addedCount === unique.length) {
      // All succeeded — close dialog
      setMemberEmails("");
      setAddResults([]);
      setAddMemberOpen(false);
    }
  };

  const handleRemoveMember = async (memberId: string, userId: string) => {
    if (userId === project?.created_by) { toast.error("Cannot remove the project owner"); return; }
    const { error } = await supabase.from("project_members").delete().eq("id", memberId);
    if (error) { toast.error(error.message); return; }
    toast.success("Member removed");
    await load();
  };

  const handleChangeRole = async (memberId: string, userId: string, newRole: Role) => {
    if (userId === project?.created_by) { toast.error("Cannot change the project owner's role"); return; }
    const { error } = await supabase.from("project_members").update({ role: newRole }).eq("id", memberId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Role changed to ${newRole}`);
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

  const openEditDialog = (task: Task) => {
    setEditTask(task);
    setETitle(task.title);
    setEDesc(task.description ?? "");
    setEDue(task.due_date ?? "");
    setEPriority(task.priority);
    setEStatus(task.status);
    setEAssignee(task.assignee_id ?? "");
    setEditOpen(true);
  };

  const handleEditTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!editTask) return;
    setSaving(true);

    const canEditAll = isAdmin;
    const updateData: Record<string, unknown> = { status: eStatus };
    if (canEditAll) {
      updateData.title = eTitle.trim();
      updateData.description = eDesc.trim() || null;
      updateData.due_date = eDue || null;
      updateData.priority = ePriority;
      updateData.assignee_id = eAssignee || null;
    }

    const { error } = await supabase.from("tasks").update(updateData).eq("id", editTask.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Task updated");
    setEditOpen(false);
    setEditTask(null);
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
    <div className="space-y-8 fade-in">
      <div>
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <Badge variant={isAdmin ? "default" : "secondary"} className="flex items-center gap-1">
                {isAdmin ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                {myRole}
              </Badge>
            </div>
            {project.description && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{project.description}</p>}
            {!isAdmin && (
              <p className="text-xs text-muted-foreground mt-2 bg-muted/50 rounded-md px-3 py-1.5 inline-block">
                As a member, you can view all tasks and update the status of tasks assigned to you.
              </p>
            )}
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
          <h2 className="text-lg font-semibold mb-3">Kanban Board</h2>
          <KanbanBoard
            tasks={tasks}
            profiles={profiles}
            isAdmin={isAdmin}
            userId={user?.id ?? ""}
            onStatusChange={updateStatus}
            onDelete={deleteTask}
            onEdit={openEditDialog}
          />
        </section>

        <aside className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Members ({members.length})</CardTitle>
                {isAdmin && (
                  <Dialog open={addMemberOpen} onOpenChange={(open) => { setAddMemberOpen(open); if (!open) { setAddResults([]); setMemberEmails(""); } }}>
                    <DialogTrigger asChild><Button size="sm" variant="outline"><UserPlus className="h-3.5 w-3.5" />Add</Button></DialogTrigger>
                    <DialogContent>
                      <form onSubmit={handleAddMembers}>
                        <DialogHeader>
                          <DialogTitle>Add members</DialogTitle>
                          <DialogDescription>Enter one or more emails, separated by commas or new lines.</DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor="m-emails">Email addresses</Label>
                            <Textarea
                              id="m-emails"
                              required
                              placeholder={"alice@example.com\nbob@example.com\ncharlie@example.com"}
                              value={memberEmails}
                              onChange={(e) => setMemberEmails(e.target.value)}
                              rows={4}
                              className="text-sm"
                            />
                            <p className="text-[11px] text-muted-foreground">Separate multiple emails with commas, semicolons, or new lines.</p>
                          </div>
                          {addResults.length > 0 && (
                            <div className="border rounded-lg divide-y text-xs max-h-[160px] overflow-y-auto">
                              {addResults.map((r, i) => (
                                <div key={i} className={`flex items-center justify-between px-3 py-2 ${r.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                                  <span className="truncate font-medium">{r.email}</span>
                                  <span className="shrink-0 ml-2">{r.ok ? "✓ Added" : r.msg}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <DialogFooter>
                          <Button type="submit" disabled={addingMember}>
                            {addingMember && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Add members
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {members.map((m) => {
                const p = profiles[m.user_id];
                const isOwner = m.user_id === project.created_by;
                const memberTaskCount = tasks.filter((t) => t.assignee_id === m.user_id).length;
                return (
                  <div key={m.id} className="flex items-center justify-between gap-2 text-sm rounded-lg px-2 py-2 hover:bg-muted/50 transition-colors group">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-primary/15 text-primary text-xs font-medium flex items-center justify-center shrink-0">
                        {(p?.name ?? p?.email ?? "?")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-medium">{p?.name ?? "Unknown"}</span>
                          {isOwner && (
                            <span className="text-[9px] uppercase tracking-wider font-bold text-amber-600 bg-amber-100 px-1 py-0.5 rounded shrink-0">Owner</span>
                          )}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{p?.email}</div>
                        <div className="text-[10px] text-muted-foreground">{memberTaskCount} task{memberTaskCount !== 1 ? "s" : ""} assigned</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isAdmin && !isOwner ? (
                        <Select value={m.role} onValueChange={(v) => handleChangeRole(m.id, m.user_id, v as Role)}>
                          <SelectTrigger className="h-7 w-[90px] text-[11px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={m.role === "admin" ? "default" : "secondary"} className="text-[10px]">{m.role}</Badge>
                      )}
                      {isAdmin && !isOwner && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove {p?.name ?? "this member"}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                They will lose access to this project and all their task assignments will remain but they won't be able to update them.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRemoveMember(m.id, m.user_id)}>Remove</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                );
              })}
              {members.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No members yet</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Edit Task Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setEditTask(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {editTask && (
            <form onSubmit={handleEditTask}>
              <DialogHeader>
                <DialogTitle>Edit task</DialogTitle>
                <DialogDescription>
                  {isAdmin ? "Update all task details." : "You can update the status of this task."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="e-title">Title</Label>
                  <Input id="e-title" required maxLength={200} value={eTitle} onChange={(e) => setETitle(e.target.value)} disabled={!isAdmin} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e-desc">Description</Label>
                  <Textarea id="e-desc" maxLength={1000} value={eDesc} onChange={(e) => setEDesc(e.target.value)} disabled={!isAdmin} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="e-due">Due date</Label>
                    <Input id="e-due" type="date" value={eDue} onChange={(e) => setEDue(e.target.value)} disabled={!isAdmin} />
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={ePriority} onValueChange={(v) => setEPriority(v as Priority)} disabled={!isAdmin}>
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
                  <Label>Status</Label>
                  <Select value={eStatus} onValueChange={(v) => setEStatus(v as Status)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isAdmin && (
                  <div className="space-y-2">
                    <Label>Assignee</Label>
                    <Select value={eAssignee || "none"} onValueChange={(v) => setEAssignee(v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.user_id} value={m.user_id}>{profiles[m.user_id]?.name ?? profiles[m.user_id]?.email ?? "Unknown"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save changes
                </Button>
              </DialogFooter>
            </form>
          )}

          {/* Comments Section */}
          {editTask && (
            <div className="border-t pt-4 mt-2">
              <TaskComments
                taskId={editTask.id}
                projectId={projectId}
                userId={user?.id ?? ""}
                isAdmin={isAdmin}
                profiles={profiles}
                memberRoles={Object.fromEntries(members.map((m) => [m.user_id, m.role]))}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const COLUMN_META: Record<Status, { label: string; icon: React.ReactNode; color: string }> = {
  todo: { label: "To Do", icon: <CircleDot className="h-3.5 w-3.5" />, color: "var(--status-todo)" },
  in_progress: { label: "In Progress", icon: <Clock3 className="h-3.5 w-3.5" />, color: "var(--status-in_progress)" },
  done: { label: "Done", icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "var(--status-done)" },
};

function KanbanBoard({ tasks, profiles, isAdmin, userId, onStatusChange, onDelete, onEdit }: {
  tasks: Task[]; profiles: Record<string, Profile>; isAdmin: boolean; userId: string;
  onStatusChange: (task: Task, status: Status) => void; onDelete: (id: string) => void; onEdit: (task: Task) => void;
}) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<Status | null>(null);

  const canDragTask = useCallback((task: Task) => {
    return isAdmin || task.assignee_id === userId;
  }, [isAdmin, userId]);

  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, task: Task) => {
    if (!canDragTask(task)) { e.preventDefault(); return; }
    setDraggedTaskId(task.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
    // Add slight delay for the dragging class to show
    requestAnimationFrame(() => {
      const el = document.getElementById(`kanban-card-${task.id}`);
      if (el) el.classList.add("dragging");
    });
  }, [canDragTask]);

  const handleDragEnd = useCallback(() => {
    if (draggedTaskId) {
      const el = document.getElementById(`kanban-card-${draggedTaskId}`);
      if (el) el.classList.remove("dragging");
    }
    setDraggedTaskId(null);
    setDragOverColumn(null);
  }, [draggedTaskId]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, colStatus: Status) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(colStatus);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    // Only clear if leaving the column itself, not a child
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverColumn(null);
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>, targetStatus: Status) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== targetStatus) {
      onStatusChange(task, targetStatus);
    }
    setDraggedTaskId(null);
    setDragOverColumn(null);
  }, [tasks, onStatusChange]);

  return (
    <div className="kanban-board">
      {STATUSES.map(({ key }) => {
        const meta = COLUMN_META[key];
        const colTasks = tasks.filter((t) => t.status === key);
        const isDragOver = dragOverColumn === key;
        return (
          <div
            key={key}
            className={`kanban-column ${isDragOver ? "drag-over" : ""}`}
            onDragOver={(e) => handleDragOver(e, key)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, key)}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full status-pulse" style={{ background: meta.color }} />
                <h3 className="font-semibold text-sm">{meta.label}</h3>
              </div>
              <span className="text-xs font-medium bg-background/80 rounded-full px-2.5 py-0.5 border">
                {colTasks.length}
              </span>
            </div>

            {/* Cards */}
            <div className="space-y-2">
              {colTasks.map((t) => (
                <KanbanCard
                  key={t.id}
                  task={t}
                  profiles={profiles}
                  canDrag={canDragTask(t)}
                  canEdit={isAdmin || t.assignee_id === userId}
                  canDelete={isAdmin}
                  isDragging={draggedTaskId === t.id}
                  onDragStart={(e) => handleDragStart(e, t)}
                  onDragEnd={handleDragEnd}
                  onEdit={() => onEdit(t)}
                  onDelete={() => onDelete(t.id)}
                />
              ))}

              {/* Empty state */}
              {colTasks.length === 0 && (
                <div className={`border-2 border-dashed rounded-lg py-8 text-center text-xs text-muted-foreground transition-colors ${
                  isDragOver ? "border-primary/40 bg-primary/5" : "border-muted"
                }`}>
                  {isDragOver ? "Drop here" : "No tasks"}
                </div>
              )}

              {/* Drop indicator at bottom */}
              {colTasks.length > 0 && <div className="kanban-drop-indicator" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({ task, profiles, canDrag, canEdit, canDelete, isDragging, onDragStart, onDragEnd, onEdit, onDelete }: {
  task: Task; profiles: Record<string, Profile>; canDrag: boolean; canEdit: boolean; canDelete: boolean;
  isDragging: boolean; onDragStart: (e: DragEvent<HTMLDivElement>) => void; onDragEnd: () => void;
  onEdit: () => void; onDelete: () => void;
}) {
  const assignee = task.assignee_id ? profiles[task.assignee_id] : null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdue = task.due_date && task.status !== "done" && new Date(task.due_date) < today;

  return (
    <div
      id={`kanban-card-${task.id}`}
      className={`kanban-card ${isDragging ? "dragging" : ""} ${!canDrag ? "not-draggable" : ""} ${overdue ? "overdue-card" : ""}`}
      draggable={canDrag}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {/* Header: drag handle + title + priority */}
      <div className="flex items-start gap-1.5">
        {canDrag && (
          <GripVertical className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0 cursor-grab" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span
              className={`text-sm font-medium leading-snug ${canEdit ? "cursor-pointer hover:text-primary transition-colors" : ""}`}
              onClick={canEdit ? onEdit : undefined}
            >
              {task.title}
            </span>
            <span
              className="text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded shrink-0"
              style={{
                background: `color-mix(in oklch, var(--priority-${task.priority}) 18%, transparent)`,
                color: `var(--priority-${task.priority})`,
              }}
            >
              {task.priority}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5 ml-5">{task.description}</p>
      )}

      {/* Footer: due date + assignee + actions */}
      <div className="flex items-center justify-between mt-2.5 ml-5">
        <div className="flex items-center gap-3 text-xs text-muted-foreground min-w-0">
          {task.due_date && (
            <span className={`flex items-center gap-1 ${overdue ? "text-destructive font-semibold" : ""}`}>
              <CalendarDays className="h-3 w-3" />
              {overdue && "Overdue · "}
              {new Date(task.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          )}
          <span className="flex items-center gap-1 truncate">
            {assignee ? (
              <>
                <span className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[9px] font-semibold flex items-center justify-center shrink-0">
                  {assignee.name[0]?.toUpperCase()}
                </span>
                <span className="truncate">{assignee.name}</span>
              </>
            ) : (
              <span className="italic">Unassigned</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {canEdit && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit} title="Edit task">
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          {canDelete && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDelete} title="Delete task">
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
