import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Single Supabase client for the app — or `null` if env vars aren't set.
 * The auth gate treats `null` as "auth disabled" and lets the editor
 * load without sign-in, preserving the localStorage-only flow.
 */
export const supabase: SupabaseClient | null =
  url && anon ? createClient(url, anon) : null;

export const isAuthEnabled = supabase !== null;
