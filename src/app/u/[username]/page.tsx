import { notFound, redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { followUser, unfollowUser } from "@/app/actions";

function Avatar({ className = "w-16 h-16" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className + " text-gray-400"}
      aria-hidden
    >
      <path d="M12 12c2.761 0 5-2.686 5-6s-2.239-6-5-6-5 2.686-5 6 2.239 6 5 6zm0 2c-4.418 0-8 3.134-8 7v1h16v-1c0-3.866-3.582-7-8-7z"/>
    </svg>
  );
}

export default async function UserPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await getSupabaseServerClient();
  if (!supabase) redirect("/login");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect(`/login?redirect=/u/${encodeURIComponent(username)}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio")
    .eq("username", username)
    .single();
  if (!profile) notFound();

  const isSelf = profile.id === session.user.id;

  const [{ count: followers }, { count: following }] = await Promise.all([
    supabase
      .from("follows")
      .select("follower_id", { head: true, count: "exact" })
      .eq("following_id", profile.id),
    supabase
      .from("follows")
      .select("following_id", { head: true, count: "exact" })
      .eq("follower_id", profile.id),
  ]);

  // Check follow state
  const { count: isFollowingCount } = await supabase
    .from("follows")
    .select("follower_id", { head: true, count: "exact" })
    .eq("follower_id", session.user.id)
    .eq("following_id", profile.id);
  const isFollowing = Boolean(isFollowingCount && isFollowingCount > 0);

  // Fetch user's posts
  const { data: posts } = await supabase
    .from("posts")
    .select("id, body, created_at")
    .eq("author_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <section className="border rounded-lg bg-white p-4 flex gap-4 items-start">
        <Avatar />
        <div className="flex-1">
          <h1 className="text-lg font-semibold">
            {profile.display_name || profile.username}
          </h1>
          <div className="text-sm text-gray-500">@{profile.username}</div>
          {profile.bio ? (
            <p className="mt-2 whitespace-pre-wrap">{profile.bio}</p>
          ) : null}
          <div className="mt-3 text-sm text-gray-600 flex gap-4">
            <span>{followers ?? 0} followers</span>
            <span>{following ?? 0} following</span>
          </div>
        </div>
        {!isSelf && (
          <div>
            {isFollowing ? (
              <form action={unfollowUser}>
                <input type="hidden" name="targetId" value={profile.id} />
                <input type="hidden" name="path" value={`/u/${profile.username}`} />
                <button className="rounded-md border px-3 py-1 text-sm">
                  Unfollow
                </button>
              </form>
            ) : (
              <form action={followUser}>
                <input type="hidden" name="targetId" value={profile.id} />
                <input type="hidden" name="path" value={`/u/${profile.username}`} />
                <button className="rounded-md bg-black text-white px-3 py-1 text-sm">
                  Follow
                </button>
              </form>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        {(!posts || posts.length === 0) && (
          <p className="text-sm text-gray-500">No posts yet.</p>
        )}
        {posts?.map((p) => (
          <article key={p.id} className="border rounded-lg bg-white p-3">
            <div className="text-xs text-gray-500">
              {new Date(p.created_at as string).toLocaleString()}
            </div>
            <div className="whitespace-pre-wrap mt-1">{p.body}</div>
          </article>
        ))}
      </section>
    </div>
  );
}
