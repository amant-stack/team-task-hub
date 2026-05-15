import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DEMO_EMAIL = "demo@teamtasks.app";
const DEMO_PASSWORD = "DemoUser2024!Secure";

export const seedDemoData = createServerFn({ method: "POST" }).handler(async () => {
  // 1. Create or get demo user
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
  let demoUser = existing.users.find((u) => u.email === DEMO_EMAIL);

  if (!demoUser) {
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { name: "Demo User" },
    });
    if (createErr) throw createErr;
    demoUser = created.user;
  }

  if (!demoUser) throw new Error("Failed to create demo user");

  // 2. Ensure profile exists
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", demoUser.id)
    .single();

  if (!profile) {
    await supabaseAdmin.from("profiles").insert({
      id: demoUser.id,
      name: "Demo User",
      email: DEMO_EMAIL,
    });
  }

  // 3. Create sample projects
  const { data: projects } = await supabaseAdmin
    .from("projects")
    .insert([
      { name: "Website Redesign", description: "Redesign the company website with modern UI/UX", created_by: demoUser.id },
      { name: "Mobile App Launch", description: "Prepare and launch the iOS and Android apps", created_by: demoUser.id },
    ])
    .select();

  if (!projects || projects.length === 0) throw new Error("Failed to create projects");

  const websiteProject = projects[0];
  const mobileProject = projects[1];

  // 4. Add demo user as admin to both projects
  await supabaseAdmin.from("project_members").insert([
    { project_id: websiteProject.id, user_id: demoUser.id, role: "admin" },
    { project_id: mobileProject.id, user_id: demoUser.id, role: "admin" },
  ]);

  // 5. Create sample tasks
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 7);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  await supabaseAdmin.from("tasks").insert([
    {
      project_id: websiteProject.id,
      title: "Design homepage mockups",
      description: "Create Figma mockups for the new homepage layout",
      status: "done",
      priority: "high",
      due_date: yesterday.toISOString().split("T")[0],
      assignee_id: demoUser.id,
      created_by: demoUser.id,
    },
    {
      project_id: websiteProject.id,
      title: "Implement responsive navigation",
      description: "Build the mobile-first responsive navbar component",
      status: "in_progress",
      priority: "high",
      due_date: today.toISOString().split("T")[0],
      assignee_id: demoUser.id,
      created_by: demoUser.id,
    },
    {
      project_id: websiteProject.id,
      title: "Write content for about page",
      description: "Draft copy for the team and mission sections",
      status: "todo",
      priority: "medium",
      due_date: tomorrow.toISOString().split("T")[0],
      assignee_id: demoUser.id,
      created_by: demoUser.id,
    },
    {
      project_id: websiteProject.id,
      title: "SEO optimization audit",
      description: "Run Lighthouse and fix Core Web Vitals issues",
      status: "todo",
      priority: "low",
      due_date: nextWeek.toISOString().split("T")[0],
      assignee_id: demoUser.id,
      created_by: demoUser.id,
    },
    {
      project_id: mobileProject.id,
      title: "Set up CI/CD pipeline",
      description: "Configure GitHub Actions for automated testing and deployment",
      status: "done",
      priority: "high",
      due_date: yesterday.toISOString().split("T")[0],
      assignee_id: demoUser.id,
      created_by: demoUser.id,
    },
    {
      project_id: mobileProject.id,
      title: "Beta testing with 50 users",
      description: "Distribute TestFlight builds and collect feedback",
      status: "in_progress",
      priority: "high",
      due_date: today.toISOString().split("T")[0],
      assignee_id: demoUser.id,
      created_by: demoUser.id,
    },
    {
      project_id: mobileProject.id,
      title: "App store screenshots",
      description: "Generate marketing screenshots for App Store and Play Store",
      status: "todo",
      priority: "medium",
      due_date: nextWeek.toISOString().split("T")[0],
      assignee_id: demoUser.id,
      created_by: demoUser.id,
    },
  ]);

  return {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    userId: demoUser.id,
  };
});
