"use client";

import { useRouter } from "next/navigation";
import Select from "@/components/ui/fields/Select";

// Which service's call guide the Content page shows: choosing one opens it
// (?service=<slug>), so the guide itself is drawn on the server.
export default function GuidePicker({
  value,
  groups,
}: {
  value: string;
  groups: { label: string; options: { value: string; label: string }[] }[];
}) {
  const router = useRouter();
  return (
    <div>
      <label htmlFor="guide-for" className="block text-sm font-medium mb-1.5">
        Guide for
      </label>
      <Select
        id="guide-for"
        key={value}
        defaultValue={value}
        onChange={(e) => {
          const slug = e.target.value;
          router.push(slug ? `/admin/content?service=${encodeURIComponent(slug)}` : "/admin/content", {
            scroll: false,
          });
        }}
      >
        <option value="">No service yet (the general guide)</option>
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
    </div>
  );
}
