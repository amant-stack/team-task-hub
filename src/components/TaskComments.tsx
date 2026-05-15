import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send, Pencil, Trash2, Reply, X, Loader2, MessageSquare, CornerDownRight, Smile } from "lucide-react";

interface Profile { id: string; name: string; email: string; }
type Role = "admin" | "member";

interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
}

interface TaskCommentsProps {
  taskId: string;
  projectId: string;
  userId: string;
  isAdmin: boolean;
  profiles: Record<string, Profile>;
  memberRoles: Record<string, Role>;
}

const EMOJI_PICKS = ["👍", "❤️", "🎉", "🚀", "👀", "💯", "🔥", "✅", "❌", "💡", "🐛", "⚡"];

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TaskComments({ taskId, projectId, userId, isAdmin, profiles, memberRoles }: TaskCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadComments = useCallback(async () => {
    const { data, error } = await supabase
      .from("task_comments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Failed to load comments:", error);
    } else {
      setComments((data as Comment[]) ?? []);
    }
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Auto-scroll to bottom on new comments
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  const handlePost = async (e: FormEvent) => {
    e.preventDefault();
    const content = newComment.trim();
    if (!content) return;
    setSending(true);
    const { error } = await supabase.from("task_comments").insert({
      task_id: taskId,
      user_id: userId,
      parent_id: replyToId,
      content,
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setNewComment("");
    setReplyToId(null);
    setShowEmoji(false);
    await loadComments();
  };

  const handleEdit = async (commentId: string) => {
    const content = editContent.trim();
    if (!content) return;
    const { error } = await supabase
      .from("task_comments")
      .update({ content })
      .eq("id", commentId);
    if (error) { toast.error(error.message); return; }
    setEditingId(null);
    setEditContent("");
    await loadComments();
  };

  const handleDelete = async (commentId: string) => {
    const { error } = await supabase
      .from("task_comments")
      .delete()
      .eq("id", commentId);
    if (error) { toast.error(error.message); return; }
    toast.success("Comment deleted");
    await loadComments();
  };

  const startEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const startReply = (comment: Comment) => {
    setReplyToId(comment.id);
    inputRef.current?.focus();
  };

  const addEmoji = (emoji: string) => {
    setNewComment((prev) => prev + emoji);
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  // Separate top-level and reply comments
  const topLevel = comments.filter((c) => !c.parent_id);
  const replies = comments.filter((c) => c.parent_id);

  const replyTo = replyToId ? comments.find((c) => c.id === replyToId) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b mb-3">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Discussion</h3>
        <span className="text-xs text-muted-foreground">({comments.length})</span>
      </div>

      {/* Comments List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1 min-h-[120px] max-h-[360px] pr-1 -mr-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : topLevel.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No comments yet. Start the discussion!</p>
          </div>
        ) : (
          topLevel.map((comment) => {
            const commentReplies = replies.filter((r) => r.parent_id === comment.id);
            return (
              <div key={comment.id}>
                <CommentCard
                  comment={comment}
                  profiles={profiles}
                  memberRoles={memberRoles}
                  userId={userId}
                  isAdmin={isAdmin}
                  isEditing={editingId === comment.id}
                  editContent={editContent}
                  onEditContentChange={setEditContent}
                  onStartEdit={() => startEdit(comment)}
                  onCancelEdit={() => { setEditingId(null); setEditContent(""); }}
                  onSaveEdit={() => handleEdit(comment.id)}
                  onDelete={() => handleDelete(comment.id)}
                  onReply={() => startReply(comment)}
                />
                {/* Replies */}
                {commentReplies.length > 0 && (
                  <div className="ml-6 pl-3 border-l-2 border-muted space-y-1">
                    {commentReplies.map((reply) => (
                      <CommentCard
                        key={reply.id}
                        comment={reply}
                        profiles={profiles}
                        memberRoles={memberRoles}
                        userId={userId}
                        isAdmin={isAdmin}
                        isEditing={editingId === reply.id}
                        editContent={editContent}
                        onEditContentChange={setEditContent}
                        onStartEdit={() => startEdit(reply)}
                        onCancelEdit={() => { setEditingId(null); setEditContent(""); }}
                        onSaveEdit={() => handleEdit(reply.id)}
                        onDelete={() => handleDelete(reply.id)}
                        onReply={() => startReply(reply)}
                        isReply
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Reply indicator */}
      {replyTo && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-t-lg border border-b-0 text-xs text-muted-foreground mt-2">
          <CornerDownRight className="h-3 w-3" />
          <span>Replying to <strong>{profiles[replyTo.user_id]?.name ?? "Unknown"}</strong></span>
          <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={() => setReplyToId(null)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handlePost} className={`mt-${replyTo ? "0" : "3"} relative`}>
        <div className={`flex gap-2 items-end ${replyTo ? "border border-t-0 rounded-b-lg p-2 bg-muted/30" : ""}`}>
          <div className="flex-1 relative">
            <Textarea
              ref={inputRef}
              placeholder={replyTo ? "Write a reply…" : "Add a comment…"}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={2}
              className="text-sm resize-none pr-10 min-h-[60px]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handlePost(e);
                }
              }}
            />
            {/* Emoji picker toggle */}
            <button
              type="button"
              onClick={() => setShowEmoji(!showEmoji)}
              className="absolute right-2 bottom-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Smile className="h-4 w-4" />
            </button>
          </div>
          <Button type="submit" size="icon" disabled={sending || !newComment.trim()} className="h-9 w-9 shrink-0">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>

        {/* Emoji Picker */}
        {showEmoji && (
          <div className="absolute bottom-full mb-1 right-0 bg-popover border rounded-lg shadow-lg p-2 flex flex-wrap gap-1 z-50 w-[200px]">
            {EMOJI_PICKS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => addEmoji(emoji)}
                className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent text-base transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground mt-1">
          Press <kbd className="px-1 py-0.5 bg-muted rounded text-[9px] font-mono">Ctrl+Enter</kbd> to send
        </p>
      </form>
    </div>
  );
}

function CommentCard({ comment, profiles, memberRoles, userId, isAdmin, isEditing, editContent, onEditContentChange, onStartEdit, onCancelEdit, onSaveEdit, onDelete, onReply, isReply }: {
  comment: Comment; profiles: Record<string, Profile>; memberRoles: Record<string, Role>;
  userId: string; isAdmin: boolean; isEditing: boolean; editContent: string;
  onEditContentChange: (v: string) => void; onStartEdit: () => void; onCancelEdit: () => void;
  onSaveEdit: () => void; onDelete: () => void; onReply: () => void; isReply?: boolean;
}) {
  const author = profiles[comment.user_id];
  const authorName = author?.name ?? author?.email ?? "Unknown";
  const authorInitial = authorName[0]?.toUpperCase() ?? "?";
  const role = memberRoles[comment.user_id];
  const isOwn = comment.user_id === userId;
  const canEdit = isOwn;
  const canDelete = isOwn || isAdmin;

  // Render @mentions in content
  const renderContent = (text: string) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) =>
      part.startsWith("@") ? (
        <span key={i} className="text-primary font-medium">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <div className={`group flex gap-2.5 py-2 px-2 rounded-lg hover:bg-muted/40 transition-colors ${isReply ? "py-1.5" : ""}`}>
      {/* Avatar */}
      <div className={`${isReply ? "h-6 w-6 text-[9px]" : "h-7 w-7 text-[10px]"} rounded-full bg-gradient-to-br from-primary/80 to-primary/40 text-primary-foreground flex items-center justify-center font-bold shrink-0 mt-0.5`}>
        {authorInitial}
      </div>

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`font-semibold ${isReply ? "text-xs" : "text-sm"}`}>{authorName}</span>
          {role && (
            <Badge variant={role === "admin" ? "default" : "secondary"} className="text-[8px] px-1 py-0 h-3.5 leading-none">
              {role}
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">{relativeTime(comment.created_at)}</span>
          {comment.is_edited && (
            <span className="text-[9px] text-muted-foreground italic">(edited)</span>
          )}
        </div>

        {/* Content */}
        {isEditing ? (
          <div className="mt-1 space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => onEditContentChange(e.target.value)}
              rows={2}
              className="text-sm resize-none min-h-[50px]"
              autoFocus
            />
            <div className="flex gap-1">
              <Button size="sm" className="h-7 text-xs" onClick={onSaveEdit} disabled={!editContent.trim()}>Save</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancelEdit}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p className={`${isReply ? "text-xs" : "text-sm"} text-foreground/90 whitespace-pre-wrap break-words mt-0.5 leading-relaxed`}>
            {renderContent(comment.content)}
          </p>
        )}

        {/* Actions */}
        {!isEditing && (
          <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!isReply && (
              <button onClick={onReply} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-accent transition-colors">
                <Reply className="h-3 w-3" /> Reply
              </button>
            )}
            {canEdit && (
              <button onClick={onStartEdit} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-accent transition-colors">
                <Pencil className="h-3 w-3" /> Edit
              </button>
            )}
            {canDelete && (
              <button onClick={onDelete} className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-destructive/10 transition-colors">
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
