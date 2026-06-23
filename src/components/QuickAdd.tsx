"use client";

import { useState } from "react";
import { useData } from "./DataProvider";
import { useEvents } from "./EventsProvider";
import { Modal } from "./Modal";
import { blankContact } from "@/lib/helpers";

// Floating "Quick Add" for capturing people fast at events — minimal fields,
// save in a couple taps, optionally keep adding.
export function QuickAdd() {
  const { create } = useData();
  const { events } = useEvents();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [city, setCity] = useState("");
  const [tags, setTags] = useState("");
  const [eventId, setEventId] = useState(""); // kept across adds for event sessions
  const [saving, setSaving] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  function reset() {
    setName("");
    setHandle("");
    setCity("");
    setTags("");
  }

  async function save(addAnother: boolean) {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const ev = events.find((e) => e.id === eventId);
      await create({
        ...blankContact(),
        name: name.trim(),
        instagram: handle.trim(),
        city: city.trim() || ev?.city || "",
        source: ev ? `Met at ${ev.name}` : "Met at event",
        event_id: eventId || null,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setJustAdded(name.trim());
      reset();
      if (!addAnother) {
        setOpen(false);
        setTimeout(() => setJustAdded(null), 400);
      } else {
        setTimeout(() => setJustAdded(null), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setJustAdded(null);
          setOpen(true);
        }}
        aria-label="Quick add a connection"
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-night-900 text-2xl font-semibold text-cream-100 shadow-lift transition hover:bg-night-800 active:scale-95 md:bottom-6 md:right-6"
      >
        +
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Quick add">
        <div className="space-y-3">
          <p className="-mt-2 text-sm text-taupe-500">
            Just the essentials — you can fill in the rest later.
          </p>
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Who did you meet?"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Instagram / TikTok</label>
              <input
                className="input"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@handle"
              />
            </div>
            <div>
              <label className="label">City</label>
              <input
                className="input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
              />
            </div>
          </div>
          <div>
            <label className="label">Tags (comma separated)</label>
            <input
              className="input"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. event, gym owner"
            />
          </div>
          {events.length > 0 && (
            <div>
              <label className="label">Met at (event)</label>
              <select
                className="input"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
              >
                <option value="">— none —</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {justAdded && (
            <p className="text-sm font-medium text-sage-600">
              ✓ Added {justAdded}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
            <button
              onClick={() => save(true)}
              disabled={saving || !name.trim()}
              className="btn-ghost"
            >
              Save &amp; add another
            </button>
            <button
              onClick={() => save(false)}
              disabled={saving || !name.trim()}
              className="btn-primary"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
