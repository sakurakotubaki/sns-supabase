import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { saveProfile } from "@/app/actions";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const supabase = await getSupabaseServerClient();
  if (!supabase) redirect("/login?redirect=/onboarding");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login?redirect=/onboarding");

  let errorNote: string | null = null;
  let profile: { username: string | null; display_name: string | null; bio: string | null } | null = null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("username, display_name, bio")
      .eq("id", session.user.id)
      .single();
    if (error) throw error;
    profile = data;
  } catch (e: any) {
    errorNote =
      "Cannot read profile. Ensure DB schema and RLS policies are applied (see README).";
  }

  const sp = await searchParams;
  const inlineError = sp?.error ? decodeURIComponent(sp?.message || "") : null;

  return (
    <div className="max-w-md mx-auto mt-10">
      <h1 className="text-xl font-semibold mb-4">Set up your profile</h1>
      {errorNote && (
        <div className="mb-3 text-sm text-red-600">{errorNote}</div>
      )}
      {inlineError && (
        <div className="mb-3 text-sm text-red-600">{inlineError}</div>
      )}
      <form action={saveProfile} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Username</label>
          <input
            name="username"
            required
            minLength={3}
            maxLength={32}
            defaultValue={profile?.username ?? ""}
            className="border rounded-md px-2 py-1 w-full text-black bg-white placeholder:text-gray-400"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Display name</label>
          <input
            name="display_name"
            defaultValue={profile?.display_name ?? ""}
            className="border rounded-md px-2 py-1 w-full text-black bg-white placeholder:text-gray-400"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Bio</label>
          <textarea
            name="bio"
            rows={3}
            defaultValue={profile?.bio ?? ""}
            className="border rounded-md px-2 py-1 w-full text-black bg-white placeholder:text-gray-400"
          />
        </div>
        <button className="rounded-md bg-black text-white px-3 py-1 text-sm">
          Save and continue
        </button>
      </form>
    </div>
  );
}
