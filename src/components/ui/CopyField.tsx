import CopyButton from "./CopyButton";

// A read-only value with a Copy action, for lifting AI drafts into Studio or a
// link into an email. With `href`, the label is a link next to the Copy action
// instead of the value in a box. `what` names the value for the Copy button's
// screen-reader name ("Copy filing address") when the label reads as a
// sentence; it defaults to the label.
export default function CopyField({
  label,
  value,
  href,
  what = label,
}: {
  label: string;
  value: string;
  href?: string;
  what?: string;
}) {
  if (href) {
    return (
      <div className="flex items-center justify-between gap-3">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-sm underline underline-offset-4 hover:text-accent"
        >
          {label}
        </a>
        <CopyButton text={value} what={what} />
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.18em] text-muted">{label}</div>
        <CopyButton text={value} what={what} />
      </div>
      <p className="mt-1.5 whitespace-pre-line break-words rounded border border-border bg-white p-3 text-sm leading-relaxed">
        {value}
      </p>
    </div>
  );
}
