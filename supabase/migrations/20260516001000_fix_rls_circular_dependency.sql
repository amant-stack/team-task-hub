
-- Fix circular RLS dependency: project creator can't add themselves as member
-- because the projects SELECT policy requires is_project_member, creating a catch-22.

-- 1. Update projects SELECT policy to also allow the creator to see their project
DROP POLICY IF EXISTS "Members can view projects" ON public.projects;
CREATE POLICY "Members or creator can view projects"
  ON public.projects FOR SELECT TO authenticated
  USING (public.is_project_member(id, auth.uid()) OR created_by = auth.uid());

-- 2. Create a SECURITY DEFINER helper so the project_members INSERT policy
--    can check project creator without being blocked by projects RLS
CREATE OR REPLACE FUNCTION public.is_project_creator(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = _project_id AND created_by = _user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_project_creator(UUID, UUID) FROM PUBLIC, anon;

-- 3. Update project_members INSERT policy to use the SECURITY DEFINER function
DROP POLICY IF EXISTS "Admins can add members" ON public.project_members;
CREATE POLICY "Admins can add members"
  ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_admin(project_id, auth.uid())
    OR (
      user_id = auth.uid()
      AND role = 'admin'
      AND public.is_project_creator(project_id, auth.uid())
    )
  );
