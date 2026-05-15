-- Task Comments System
-- Supports threaded discussions, editing, and role-based moderation

CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.task_comments(id) ON DELETE CASCADE, -- for threaded replies
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 5000),
  is_edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX idx_task_comments_user_id ON public.task_comments(user_id);
CREATE INDEX idx_task_comments_parent_id ON public.task_comments(parent_id);
CREATE INDEX idx_task_comments_created_at ON public.task_comments(task_id, created_at);

-- Enable RLS
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- SELECT: project members can view comments on tasks in their projects
CREATE POLICY "Project members can view task comments"
  ON public.task_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.project_members pm ON pm.project_id = t.project_id
      WHERE t.id = task_comments.task_id AND pm.user_id = auth.uid()
    )
  );

-- INSERT: project members can add comments
CREATE POLICY "Project members can add comments"
  ON public.task_comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.project_members pm ON pm.project_id = t.project_id
      WHERE t.id = task_comments.task_id AND pm.user_id = auth.uid()
    )
  );

-- UPDATE: users can edit their own comments
CREATE POLICY "Users can edit own comments"
  ON public.task_comments FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: users can delete own comments, admins can delete any in their projects
CREATE POLICY "Users or admins can delete comments"
  ON public.task_comments FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.project_members pm ON pm.project_id = t.project_id
      WHERE t.id = task_comments.task_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'admin'
    )
  );

-- Auto-update updated_at on edit
CREATE OR REPLACE FUNCTION public.handle_comment_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  NEW.is_edited = TRUE;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_comment_update
  BEFORE UPDATE OF content ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_comment_update();
