"use client";

// Links two or more of one person's projects into a bundle (e.g. "Wedding +
// Engagement") or unlinks one. Used by the portal and the admin project page
// via `endpoint`; both routes keep a bundle within a single person.

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import FormStatus from "@/components/ui/FormStatus";

type Project = { id: string; title: string; bundleLabel?: string };

const SUGGESTED = [
  "Wedding + Engagement",
  "Maternity + Newborn",
  "Family + Newborn",
];

export default function PortalBundles({
  projects,
  endpoint = "/api/portal/bundle",
}: {
  projects: Project[];
  endpoint?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [done, setDone] = useState("");

  // Existing bundles among these projects, grouped by label — surfaced in the
  // collapsed header so the grouping is visible without opening the panel.
  const existingBundles = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of projects) {
      if (!p.bundleLabel) continue;
      if (!map.has(p.bundleLabel)) map.set(p.bundleLabel, []);
      map.get(p.bundleLabel)!.push(p.title);
    }
    return [...map.entries()];
  }, [projects]);

  function toggle(id: string) {
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  }

  async function post(body: unknown, doneText: string) {
    setBusy(true);
    setError(false);
    setDone("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setSelected([]);
      setLabel("");
      setDone(doneText);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const canLink = selected.length >= 2 && label.trim().length > 0;

  return (
    <Panel>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-medium">
          {existingBundles.length > 0
            ? "Bundles"
            : "Link projects into a bundle"}
        </span>
        <span className="text-accent text-xl leading-none">
          {open ? "–" : "+"}
        </span>
      </button>

      {/* Existing bundles, visible without expanding. */}
      {existingBundles.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {existingBundles.map(([label, titles]) => (
            <div key={label} className="text-sm flex flex-wrap items-baseline gap-x-2">
              <span className="text-[10px] uppercase tracking-widest text-accent whitespace-nowrap">
                ↔ {label}
              </span>
              <span className="capitalize text-muted">
                {titles.join(", ")}
              </span>
            </div>
          ))}
          {!open && (
            <p className="pt-1 text-xs text-muted">
              Open to add more or unlink.
            </p>
          )}
        </div>
      )}

      {open && (
        <div className="mt-5">
          <p className="text-xs text-muted">
            Tick the projects that go together (e.g. a wedding and its
            engagement session), name the bundle, and link them.
          </p>

          <div className="mt-4 space-y-2">
            {projects.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 py-1"
              >
                <label className="flex items-center gap-3 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  <span className="capitalize">{p.title}</span>
                  {p.bundleLabel && (
                    <span className="text-[10px] uppercase tracking-widest text-accent">
                      ↔ {p.bundleLabel}
                    </span>
                  )}
                </label>
                {p.bundleLabel && (
                  <Button
                    variant="text"
                    disabled={busy}
                    onClick={() =>
                      post({ action: "unlink", projectId: p.id }, "Unlinked.")
                    }
                  >
                    Unlink
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              list="bundle-suggestions"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Bundle name (e.g. Wedding + Engagement)"
              className="flex-1 min-w-[220px] px-4 py-2.5 rounded border border-border bg-white focus:outline-none focus:border-foreground transition text-sm"
            />
            <datalist id="bundle-suggestions">
              {SUGGESTED.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <Button
              disabled={!canLink}
              loading={busy}
              loadingLabel="Saving…"
              onClick={() =>
                post({ action: "link", projectIds: selected, label }, "Linked.")
              }
            >
              Link selected
            </Button>
          </div>
          <FormStatus
            state={error ? "error" : done ? "ok" : "idle"}
            ok={done}
            error="Couldn’t update. Try again."
            className="mt-3 block"
          />
        </div>
      )}
    </Panel>
  );
}
