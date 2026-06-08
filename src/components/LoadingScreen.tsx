// The site's one loading identity. Rendered by the root `loading.tsx` Suspense
// boundary whenever a route segment is genuinely waiting on data — the dynamic
// admin/portal Supabase reads, a cold Sanity fetch — and never on instant or
// prerendered navigations. A simple line-art camera keeps the brand present
// during the wait instead of a bare spinner or a layout-specific skeleton.
// Pure presentational and server-rendered; the gentle `animate-pulse` is the
// same loading cue the rest of the UI uses.

export default function LoadingScreen({
  label = "Loading…",
}: {
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-6 text-center"
    >
      <svg
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="h-16 w-16 text-[var(--accent)] animate-pulse"
      >
        {/* Camera body */}
        <rect x="6" y="18" width="52" height="36" rx="4" />
        {/* Viewfinder bump over the lens */}
        <path d="M22 18l4-6h12l4 6" />
        {/* Lens — outer ring + aperture */}
        <circle cx="32" cy="37" r="11" />
        <circle cx="32" cy="37" r="5" />
        {/* Flash indicator */}
        <circle cx="49" cy="27" r="1.5" />
      </svg>
      <div className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">
        {label}
      </div>
    </div>
  );
}
