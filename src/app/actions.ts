"use server";

import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createPost(formData: FormData) {
  const supabase = await getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase env not configured");

  const body = String(formData.get("body") || "").trim();
  if (!body) return;

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) redirect("/login?redirect=/");

  const { error } = await supabase.from("posts").insert({
    author_id: user!.id,
    body,
  });
  if (error) throw error;
}

export async function saveProfile(formData: FormData) {
  const supabase = await getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase env not configured");

  const username = String(formData.get("username") || "").trim();
  const display_name = String(formData.get("display_name") || "").trim();
  const bio = String(formData.get("bio") || "").trim();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) redirect("/login?redirect=/onboarding");

  // Prefer update to comply with common RLS (insert often restricted)
  const { error, data } = await supabase
    .from("profiles")
    .update({ username, display_name, bio })
    .eq("id", user!.id)
    // Request the row back so we can detect missing profiles reliably
    .select("id");
  if (error) {
    // Surface policy errors via query param instead of crashing
    const code = (error as any).code || "unknown";
    const msg = encodeURIComponent((error as any).message || "update failed");
    redirect(`/onboarding?error=${code}&message=${msg}`);
  }
  if (!data || data.length === 0) {
    // Row not found: likely trigger not applied. Guide user.
    redirect(
      `/onboarding?error=not_found&message=${encodeURIComponent(
        "profile row not found; apply SQL from README"
      )}`
    );
  }

  redirect("/");
}

export async function signInWithMagicLink(formData: FormData) {
  const redirectTo = String(formData.get("redirect") || "/");
  const email = String(formData.get("email") || "").trim();
  const supabase = await getSupabaseServerClient();
  if (!supabase) redirect(`/login?error=env&redirect=${encodeURIComponent(redirectTo)}`);

  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const emailRedirectTo = `${site}/auth/callback?next=${encodeURIComponent(redirectTo)}`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo },
  });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}&redirect=${encodeURIComponent(redirectTo)}`);
  }
  // Show confirmation message
  redirect(`/login?sent=1&redirect=${encodeURIComponent(redirectTo)}`);
}

export async function signOut() {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/login");
}

export async function followUser(formData: FormData) {
  const supabase = await getSupabaseServerClient();
  if (!supabase) redirect("/login");
  const targetId = String(formData.get("targetId") || "");
  if (!targetId) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (user.id === targetId) return; // ignore self-follow
  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: user.id, following_id: targetId })
    .select("follower_id")
    .single();
  // Ignore duplicate follows (unique violation)
  if (error && (error as any).code !== "23505") {
    throw error;
  }
  const path = String(formData.get("path") || "/timeline");
  revalidatePath(path);
  redirect(path);
}

export async function unfollowUser(formData: FormData) {
  const supabase = await getSupabaseServerClient();
  if (!supabase) redirect("/login");
  const targetId = String(formData.get("targetId") || "");
  if (!targetId) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", targetId)
    .then(() => {});
  const path = String(formData.get("path") || "/timeline");
  revalidatePath(path);
  redirect(path);
}
