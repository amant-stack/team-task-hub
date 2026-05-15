import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2, CalendarDays, FolderKanban, CheckCircle2, Clock3, CircleDot,
  Search, SlidersHorizontal, X, ArrowUpDown, AlertTriangle, Filter
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-tasks")({ component: MyTasks });

type Status = "todo" | "in_progress" | "done";
type Priority = "low" | "medium" | "high";
type SortKey = "due_date_asc" | "due_date_desc" | "priority_desc" | "created_desc" | "created_asc" | "alpha" | "status";
type DueDatePreset = "all" | "today" | "tomorrow" | "week" | "month" | "overdue" | "custom";

interface Task {
  id: string; project_id: string; title: string; description: string | null;
  due_date: string | null; priority: Priority; status: Status;
  assignee_id: string | null; created_by: string; created_at: string;
}
interface Project { id: string; name: string; }
interface Profile { id: string; name: string; email: string; }

const STATUS_MAP: Record<Status, string> = { todo: "To Do", in_progress: "In Progress", done: "Done" };
const PRIORITY_ORDER: Record<Priority, number> = { high: 3, medium: 2, low: 1 };
const STATUS_ORDER: Record<Status, number> = { todo: 0, in_progress: 1, done: 2 };
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "due_date_asc", label: "Due Date (Soonest)" },
  { value: "due_date_desc", label: "Due Date (Latest)" },
  { value: "priority_desc", label: "Priority (High → Low)" },
  { value: "created_desc", label: "Recently Created" },
  { value: "created_asc", label: "Oldest First" },
  { value: "alpha", label: "Alphabetical" },
  { value: "status", label: "Status Progress" },
];

const STORAGE_KEY = "baki-task-filters";

function saveFilters(f: object) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(f)); } catch {} }
function loadFilters(): any { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; } }

function getDateRange(preset: DueDatePreset): { start: Date | null; end: Date | null } {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const end = new Date(now);
  switch (preset) {
    case "today": return { start: now, end: new Date(now.getTime() + 86400000) };
    case "tomorrow": { const t = new Date(now.getTime() + 86400000); return { start: t, end: new Date(t.getTime() + 86400000) }; }
    case "week": { end.setDate(end.getDate() + 7); return { start: now, end }; }
    case "month": { end.setMonth(end.getMonth() + 1); return { start: now, end }; }
    case "overdue": return { start: new Date(0), end: now };
    default: return { start: null, end: null };
  }
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((p, i) => regex.test(p) ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-800/60 rounded px-0.5">{p}</mark> : p);
}

function MyTasks() {
  const { user } = useAuth();
  const saved = loadFilters();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Record<string, Project>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState(saved.search || "");
  const [filterStatus, setFilterStatus] = useState<Status | "all">(saved.status || "all");
  const [filterPriority, setFilterPriority] = useState<Priority | "all">(saved.priority || "all");
  const [filterProject, setFilterProject] = useState<string>(saved.project || "all");
  const [filterDueDate, setFilterDueDate] = useState<DueDatePreset>(saved.dueDate || "all");
  const [sortBy, setSortBy] = useState<SortKey>(saved.sort || "due_date_asc");
  const [showFilters, setShowFilters] = useState(false);

  // Persist filters
  useEffect(() => {
    saveFilters({ search, status: filterStatus, priority: filterPriority, project: filterProject, dueDate: filterDueDate, sort: sortBy });
  }, [search, filterStatus, filterPriority, filterProject, filterDueDate, sortBy]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // Load ALL tasks user can see (via RLS)
    const { data: ts } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    const allTasks = (ts as Task[]) ?? [];
    setTasks(allTasks);

    const projectIds = [...new Set(allTasks.map((t) => t.project_id))];
    if (projectIds.length > 0) {
      const { data: projs } = await supabase.from("projects").select("id, name").in("id", projectIds);
      const pMap: Record<string, Project> = {};
      (projs as Project[] | null)?.forEach((p) => { pMap[p.id] = p; });
      setProjects(pMap);
    }

    const userIds = [...new Set(allTasks.map((t) => t.assignee_id).filter(Boolean) as string[])];
    if (userIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, name, email").in("id", userIds);
      const uMap: Record<string, Profile> = {};
      (profs as Profile[] | null)?.forEach((p) => { uMap[p.id] = p; });
      setProfiles(uMap);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  const filteredAndSorted = useMemo(() => {
    let result = [...tasks];
    const q = search.trim().toLowerCase();

    // Search
    if (q) {
      result = result.filter((t) => {
        const projName = projects[t.project_id]?.name?.toLowerCase() ?? "";
        const assigneeName = t.assignee_id ? (profiles[t.assignee_id]?.name?.toLowerCase() ?? "") : "";
        return t.title.toLowerCase().includes(q) || (t.description?.toLowerCase().includes(q) ?? false) || projName.includes(q) || assigneeName.includes(q);
      });
    }
    // Status
    if (filterStatus !== "all") result = result.filter((t) => t.status === filterStatus);
    // Priority
    if (filterPriority !== "all") result = result.filter((t) => t.priority === filterPriority);
    // Project
    if (filterProject !== "all") result = result.filter((t) => t.project_id === filterProject);
    // Due date
    if (filterDueDate !== "all" && filterDueDate !== "custom") {
      const { start, end } = getDateRange(filterDueDate);
      if (filterDueDate === "overdue") {
        result = result.filter((t) => t.due_date && t.status !== "done" && new Date(t.due_date) < today);
      } else if (start && end) {
        result = result.filter((t) => { if (!t.due_date) return false; const d = new Date(t.due_date); return d >= start && d < end; });
      }
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "due_date_asc": return (a.due_date ?? "9999") < (b.due_date ?? "9999") ? -1 : 1;
        case "due_date_desc": return (b.due_date ?? "") < (a.due_date ?? "") ? -1 : 1;
        case "priority_desc": return PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
        case "created_desc": return b.created_at.localeCompare(a.created_at);
        case "created_asc": return a.created_at.localeCompare(b.created_at);
        case "alpha": return a.title.localeCompare(b.title);
        case "status": return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        default: return 0;
      }
    });
    return result;
  }, [tasks, search, filterStatus, filterPriority, filterProject, filterDueDate, sortBy, projects, profiles, today]);

  const activeFilterCount = [filterStatus !== "all", filterPriority !== "all", filterProject !== "all", filterDueDate !== "all", search.trim() !== ""].filter(Boolean).length;

  const resetFilters = () => { setSearch(""); setFilterStatus("all"); setFilterPriority("all"); setFilterProject("all"); setFilterDueDate("all"); setSortBy("due_date_asc"); };

  const updateStatus = async (taskId: string, status: Status) => {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", taskId);
    if (error) { toast.error(error.message); return; }
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    toast.success(`Status → ${STATUS_MAP[status]}`);
  };

  const stats = useMemo(() => ({
    total: tasks.length,
    todo: tasks.filter((t) => t.status === "todo").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    done: tasks.filter((t) => t.status === "done").length,
    overdue: tasks.filter((t) => t.due_date && t.status !== "done" && new Date(t.due_date) < today).length,
    highPriority: tasks.filter((t) => t.priority === "high" && t.status !== "done").length,
  }), [tasks, today]);

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Tasks</h1>
        <p className="text-sm text-muted-foreground">Search, filter, and manage all your tasks across projects.</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 stagger-in">
        <StatChip label="Total" count={stats.total} onClick={() => resetFilters()} />
        <StatChip label="To Do" count={stats.todo} color="var(--status-todo)" onClick={() => { resetFilters(); setFilterStatus("todo"); }} />
        <StatChip label="In Progress" count={stats.inProgress} color="var(--status-in_progress)" onClick={() => { resetFilters(); setFilterStatus("in_progress"); }} />
        <StatChip label="Done" count={stats.done} color="var(--status-done)" onClick={() => { resetFilters(); setFilterStatus("done"); }} />
        <StatChip label="Overdue" count={stats.overdue} color="var(--destructive)" onClick={() => { resetFilters(); setFilterDueDate("overdue"); }} />
        <StatChip label="High Priority" count={stats.highPriority} color="var(--priority-high)" onClick={() => { resetFilters(); setFilterPriority("high"); }} />
      </div>

      {/* Search + Filter Bar */}
      <div className="sticky top-14 z-20 bg-background/95 backdrop-blur-sm pb-3 -mx-1 px-1 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks, projects, members…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 relative" onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">{activeFilterCount}</span>
            )}
          </Button>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="w-[180px] h-10 shrink-0 hidden sm:flex">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 border rounded-lg bg-card animate-in slide-in-from-top-2 duration-200">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Status</label>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as Status | "all")}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Priority</label>
              <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v as Priority | "all")}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Due Date</label>
              <Select value={filterDueDate} onValueChange={(v) => setFilterDueDate(v as DueDatePreset)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Date</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="tomorrow">Tomorrow</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="overdue">Overdue Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Project</label>
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {Object.values(projects).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {activeFilterCount > 0 && (
              <div className="col-span-full flex items-center justify-between pt-1">
                <div className="flex flex-wrap gap-1">
                  {filterStatus !== "all" && <Badge variant="secondary" className="text-[10px] gap-1">Status: {STATUS_MAP[filterStatus]}<X className="h-2.5 w-2.5 cursor-pointer" onClick={() => setFilterStatus("all")} /></Badge>}
                  {filterPriority !== "all" && <Badge variant="secondary" className="text-[10px] gap-1">Priority: {filterPriority}<X className="h-2.5 w-2.5 cursor-pointer" onClick={() => setFilterPriority("all")} /></Badge>}
                  {filterDueDate !== "all" && <Badge variant="secondary" className="text-[10px] gap-1">Due: {filterDueDate}<X className="h-2.5 w-2.5 cursor-pointer" onClick={() => setFilterDueDate("all")} /></Badge>}
                  {filterProject !== "all" && <Badge variant="secondary" className="text-[10px] gap-1">Project: {projects[filterProject]?.name}<X className="h-2.5 w-2.5 cursor-pointer" onClick={() => setFilterProject("all")} /></Badge>}
                </div>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={resetFilters}>Reset All</Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{filteredAndSorted.length} task{filteredAndSorted.length !== 1 ? "s" : ""} {activeFilterCount > 0 ? "matching filters" : "total"}</span>
        {/* Mobile sort */}
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-[160px] h-7 text-xs sm:hidden"><ArrowUpDown className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>{SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filteredAndSorted.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Search className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="font-semibold text-base mb-1">No tasks found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {search ? `No results for "${search}"` : "Try adjusting your filters."}
            </p>
            {activeFilterCount > 0 && <Button variant="outline" size="sm" onClick={resetFilters}>Reset All Filters</Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredAndSorted.map((task) => {
            const overdue = task.due_date && task.status !== "done" && new Date(task.due_date) < today;
            const proj = projects[task.project_id];
            const assignee = task.assignee_id ? profiles[task.assignee_id] : null;
            return (
              <Card key={task.id} className={`card-hover ${overdue ? "border-l-[3px] border-l-destructive" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: `var(--status-${task.status})` }} />
                        <span className="font-medium text-sm">{highlightMatch(task.title, search)}</span>
                        <span className="text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: `color-mix(in oklch, var(--priority-${task.priority}) 18%, transparent)`, color: `var(--priority-${task.priority})` }}>
                          {task.priority}
                        </span>
                        {overdue && <Badge variant="destructive" className="text-[9px] h-4 px-1.5"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" />Overdue</Badge>}
                      </div>
                      {task.description && <p className="text-xs text-muted-foreground line-clamp-1 mb-1">{highlightMatch(task.description, search)}</p>}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {proj && (
                          <Link to="/projects/$projectId" params={{ projectId: task.project_id }} className="flex items-center gap-1 hover:text-foreground transition-colors">
                            <FolderKanban className="h-3 w-3" />{highlightMatch(proj.name, search)}
                          </Link>
                        )}
                        {task.due_date && (
                          <span className={`flex items-center gap-1 ${overdue ? "text-destructive font-medium" : ""}`}>
                            <CalendarDays className="h-3 w-3" />{new Date(task.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        )}
                        {assignee && (
                          <span className="flex items-center gap-1">
                            <span className="h-4 w-4 rounded-full bg-primary/15 text-primary text-[8px] font-bold flex items-center justify-center">{assignee.name[0]?.toUpperCase()}</span>
                            {highlightMatch(assignee.name, search)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Select value={task.status} onValueChange={(v) => updateStatus(task.id, v as Status)}>
                      <SelectTrigger className="h-8 text-xs w-[130px] shrink-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todo">To Do</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatChip({ label, count, color, onClick }: { label: string; count: number; color?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left p-3 rounded-lg border bg-card hover:bg-accent transition-colors">
      <div className="text-lg font-bold" style={color ? { color } : {}}>{count}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
    </button>
  );
}
