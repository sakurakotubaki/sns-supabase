"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Post = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export function PostList() {
  const supabase = getSupabaseClient();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchPosts = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from("posts")
        .select("id, author_id, body, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (!mounted) return;
      if (error) {
        console.error(error);
      } else {
        setPosts(data ?? []);
      }
      setLoading(false);
    };
    fetchPosts();

    if (!supabase) return () => {};
    const channel = supabase
      .channel("posts-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        (payload) => {
          setPosts((prev) => [payload.new as Post, ...prev]);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;

  if (posts.length === 0)
    return <p className="text-sm text-gray-500">No posts yet.</p>;

  return (
    <ul className="flex flex-col gap-3">
      {posts.map((p) => (
        <li key={p.id} className="border rounded-lg p-3 bg-white">
          <div className="text-xs text-gray-500">
            {new Date(p.created_at).toLocaleString()}
          </div>
          <div className="whitespace-pre-wrap mt-1">{p.body}</div>
        </li>
      ))}
    </ul>
  );
}
