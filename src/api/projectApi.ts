import { supabase, isAuthEnabled } from "../auth/supabase";
import type { Project } from "../types/project";

export async function saveProjectToDB(project: Project): Promise<boolean> {
  if (!supabase || !isAuthEnabled) return false;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;

  const { error } = await supabase.from("projects").upsert(
    {
      user_id: userData.user.id,
      name: project.name,
      data: project as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.warn("saveProjectToDB:", error.message);
    return false;
  }
  return true;
}

export async function loadProjectFromDB(): Promise<Project | null> {
  if (!supabase || !isAuthEnabled) return null;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from("projects")
    .select("data")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (error || !data) {
    if (error) console.warn("loadProjectFromDB:", error.message);
    return null;
  }
  return (data as { data: unknown }).data as Project;
}
