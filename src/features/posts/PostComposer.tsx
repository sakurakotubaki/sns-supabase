"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

export function PostComposer({ onPosted }: { onPosted?: () => void }) {
  const supabase = getSupabaseClient();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      alert("Supabase env is not configured.");
      return;
    }
    if (!body.trim()) return;
    setLoading(true);
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) throw userErr || new Error("Not signed in");
      const { error } = await supabase.from("posts").insert({
        author_id: user.id,
        body: body.trim(),
      });
      if (error) throw error;
      setBody("");
      onPosted?.();
    } catch (err: any) {
      alert(err.message ?? "Failed to post");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full border rounded-lg p-3 bg-white">
      <textarea
        className="w-full resize-none outline-none"
        placeholder="What's happening?"
        maxLength={2000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-500">{body.length}/2000</span>
        <button
          type="submit"
          disabled={loading || !body.trim()}
          className="rounded-md bg-blue-600 text-white px-3 py-1 text-sm disabled:opacity-50"
        >
          {loading ? "Posting..." : "Post"}
        </button>
      </div>
    </form>
  );
}
