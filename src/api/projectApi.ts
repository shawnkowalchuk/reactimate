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

/**
 * Admin-only: list every cloud project with its full JSONB.
 *
 * RLS allows this for any profile with is_admin = true (see the
 * "admins read all projects" policy in supabase/schema.sql). The
 * server enforces it; this client function just shapes the result.
 *
 * Note: returns full project data per row. With ~hundreds of users
 * that's still small (each project is typically a few KB of JSON),
 * but if the user base grows past a few thousand, move the
 * aggregation server-side (RPC or materialized view).
 */
export interface AdminProjectRow {
  id: string;
  user_id: string;
  name: string;
  data: Project;
  created_at: string;
  updated_at: string;
}

export async function listAllProjectsAdmin(): Promise<AdminProjectRow[]> {
  if (!supabase || !isAuthEnabled) return [];
  const { data, error } = await supabase
    .from("projects")
    .select("id, user_id, name, data, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) {
    console.warn("listAllProjectsAdmin:", error.message);
    return [];
  }
  return (data ?? []) as AdminProjectRow[];
}
