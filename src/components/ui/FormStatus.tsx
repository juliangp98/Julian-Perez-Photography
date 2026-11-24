// The line under a form after an action: a quiet confirmation, or an error
// read out to screen readers. One look and one wording across the site.
export default function FormStatus({
  state,
  ok = "Saved.",
  error = "Couldn't save. Try again.",
  className = "",
}: {
  state: "idle" | "ok" | "error" | string;
  ok?: string;
  error?: string;
  className?: string;
}) {
  if (state === "ok") {
    return (
      <span role="status" className={`text-sm text-muted ${className}`.trim()}>
        {ok}
      </span>
    );
  }
  if (state === "error") {
    return (
      <span role="alert" className={`text-sm text-danger ${className}`.trim()}>
        {error}
      </span>
    );
  }
  return null;
}
