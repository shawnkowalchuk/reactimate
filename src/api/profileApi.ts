import { supabase } from "../auth/supabase";

export interface Profile {
  id: string;
  email: string | null;
  is_admin: boolean;
  created_at: string;
  last_seen_at: string | null;
}

export async function fetchMyProfile(): Promise<Profile | null> {
  if (!supabase) return null;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, is_admin, created_at, last_seen_at")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (error) {
    console.warn("fetchMyProfile:", error.code, error.message);
    return null;
  }
  return data as Profile | null;
}

export async function touchLastSeen(): Promise<void> {
  if (!supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  await supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", userData.user.id);
}

export async function listAllProfiles(): Promise<Profile[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, is_admin, created_at, last_seen_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("listAllProfiles:", error.message);
    return [];
  }
  return (data ?? []) as Profile[];
}
