import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { createPost } from "@/app/actions";

export default async function TimelinePage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string; before?: string; scope?: string }>;
}) {
  const supabase = await getSupabaseServerClient();
  if (!supabase) redirect("/login");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login?redirect=/timeline");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", session.user.id)
    .single();
  if (!profile?.username) redirect("/onboarding");

  const sp = (await searchParams) || {};
  const mode = sp.mode === "follow" ? "follow" : "all";
  const scope = sp.scope === "global" ? "global" : "timeline"; // default timeline
  const before = sp.before;

  type Row = {
    id: string;
    author_id: string;
    body: string;
    created_at: string;
    username?: string | null;
    display_name?: string | null;
  };

  let posts: Row[] | null = null;
  if (scope === "timeline") {
    let query = supabase
      .from("timeline")
      .select("id, author_id, body, created_at, username, display_name")
      .order("created_at", { ascending: false })
      .limit(20);
    if (before) {
      query = query.lt("created_at", before);
    }
    posts = (await query).data as Row[] | null;
  } else {
    // Global: all users' posts
    let q = supabase
      .from("posts")
      .select("id, author_id, body, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (before) q = q.lt("created_at", before);
    const base = (await q).data as Row[] | null;
    const authorIds = Array.from(new Set((base || []).map((p) => p.author_id)));
    let profileMap = new Map<string, { username: string | null; display_name: string | null }>();
    if (authorIds.length > 0) {
      const prof = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", authorIds);
      (prof.data || []).forEach((r: any) => {
        profileMap.set(r.id, { username: r.username, display_name: r.display_name });
      });
    }
    posts = (base || []).map((p) => ({
      ...p,
      username: profileMap.get(p.author_id)?.username ?? null,
      display_name: profileMap.get(p.author_id)?.display_name ?? null,
    }));
  }

  if (mode === "follow") {
    posts = (posts || []).filter((p) => p.author_id !== session.user.id);
  }

  // Determine follow state for authors in the list
  const authorIds = Array.from(new Set((posts || []).map((p) => p.author_id))).filter(
    (id) => id !== session.user.id
  );
  let followingSet = new Set<string>();
  if (authorIds.length > 0) {
    const { data: rows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", session.user.id)
      .in("following_id", authorIds);
    (rows || []).forEach((r: any) => followingSet.add(r.following_id));
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Timeline</h1>
      <form action={createPost} className="w-full border rounded-lg p-3 bg-white">
        <textarea
          className="w-full resize-none outline-none text-black bg-white placeholder:text-gray-400"
          placeholder="What's happening?"
          name="body"
          maxLength={2000}
          rows={3}
        />
        <div className="flex items-center justify-end mt-2">
          <button className="rounded-md bg-blue-600 text-white px-3 py-1 text-sm">
            Post
          </button>
        </div>
      </form>

      {(!posts || posts.length === 0) && (
        <p className="text-sm text-gray-500">No posts yet.</p>
      )}

      <div className="flex items-center gap-3 text-sm">
        <a
          href={"/timeline?scope=timeline&mode=all"}
          className={`px-2 py-1 rounded ${scope === "timeline" && mode === "all" ? "bg-black text-white" : "border"}`}
        >
          Timeline (me + following)
        </a>
        <a
          href={"/timeline?scope=timeline&mode=follow"}
          className={`px-2 py-1 rounded ${scope === "timeline" && mode === "follow" ? "bg-black text-white" : "border"}`}
        >
          Following only
        </a>
        <a
          href={`/timeline?scope=global&mode=${mode}`}
          className={`px-2 py-1 rounded ${scope === "global" ? "bg-black text-white" : "border"}`}
        >
          Global (all users)
        </a>
      </div>

      <ul className="flex flex-col gap-3">
        {posts?.map((p: { id: string; author_id: string; body: string; created_at: string; username?: string | null; display_name?: string | null }) => (
          <li key={p.id as string} className="border rounded-lg p-3 bg-white">
            <div className="flex items-start gap-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-8 h-8 text-gray-400"
                aria-hidden
              >
                <path d="M12 12c2.761 0 5-2.686 5-6s-2.239-6-5-6-5 2.686-5 6 2.239 6 5 6zm0 2c-4.418 0-8 3.134-8 7v1h16v-1c0-3.866-3.582-7-8-7z"/>
              </svg>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  {p.username ? (
                    <a href={`/u/${p.username as string}`} className="font-medium hover:underline">
                      {(p.display_name as string) || (p.username as string)}
                    </a>
                  ) : (
                    <span className="font-medium">User</span>
                  )}
                  <span className="text-gray-500 text-xs">
                    {new Date(p.created_at as string).toLocaleString()}
                  </span>
                </div>
                <div className="whitespace-pre-wrap mt-1">{p.body as string}</div>
              </div>
              {p.author_id !== session.user.id && (
                <div>
                  {followingSet.has(p.author_id) ? (
                    <form action={async (fd) => {
                      "use server";
                      const { unfollowUser } = await import("@/app/actions");
                      fd.set("targetId", p.author_id);
                      fd.set("path", `/timeline?scope=${scope}&mode=${mode}`);
                      await unfollowUser(fd);
                    }}>
                      <button className="rounded-md border px-3 py-1 text-sm">Unfollow</button>
                    </form>
                  ) : (
                    <form action={async (fd) => {
                      "use server";
                      const { followUser } = await import("@/app/actions");
                      fd.set("targetId", p.author_id);
                      fd.set("path", `/timeline?scope=${scope}&mode=${mode}`);
                      await followUser(fd);
                    }}>
                      <button className="rounded-md bg-black text-white px-3 py-1 text-sm">Follow</button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {posts && posts.length > 0 && (
        <div>
          <a
            className="text-sm underline"
            href={`/timeline?scope=${scope}&mode=${mode}&before=${encodeURIComponent(
              String(posts[posts.length - 1].created_at)
            )}`}
          >
            Load more
          </a>
        </div>
      )}
    </div>
  );
}
