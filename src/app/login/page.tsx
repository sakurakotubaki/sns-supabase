export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string; sent?: string }>;
}) {
  const sp = await searchParams;
  const redirect = sp?.redirect ?? "/";
  const error = sp?.error;
  const sent = sp?.sent === "1";

  return (
    <div className="max-w-md mx-auto mt-10">
      <h1 className="text-xl font-semibold mb-4">Sign in / Sign up</h1>
      {error && (
        <div className="mb-3 text-sm text-red-600">{error}</div>
      )}

      {sent ? (
        <div className="text-sm text-green-700 mb-4">
          Magic link sent. Check your email to continue.
        </div>
      ) : null}

      <form
        action={async (fd) => {
          "use server";
          const { signInWithMagicLink } = await import("@/app/actions");
          fd.set("redirect", redirect);
          await signInWithMagicLink(fd);
        }}
        className="space-y-3 max-w-sm"
      >
        <label className="block text-sm">Email</label>
        <input
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className="border rounded-md px-2 py-1 w-full text-black bg-white placeholder:text-gray-400"
        />
        <button className="rounded-md bg-black text-white px-3 py-1 text-sm">
          Send magic link
        </button>
      </form>
    </div>
  );
}
