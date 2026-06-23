"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";

export default function TrackingPage() {
  const [origin, setOrigin] = useState("https://nukava.vercel.app");

  useEffect(() => {
    const env = process.env.NEXT_PUBLIC_APP_URL;
    setOrigin((env && env.replace(/\/$/, "")) || window.location.origin);
  }, []);

  const scriptTag = `<script src="${origin}/api/track/snippet" async></script>`;
  const identifyExample = `<!-- Call this when a form is submitted -->
<script>
  nukava.identify({
    email: "lead@example.com",
    name: "Jordan Lee",
    instagram: "@jordan"
  });
</script>`;
  const trackExample = `// Track a custom signal anywhere on the site
nukava.track("page_view", { title: "Pricing" });`;

  return (
    <div>
      <PageHeader
        title="Website Tracking"
        subtitle="Capture visitors before they're contacts"
      />

      <div className="space-y-5 px-4 py-5 sm:px-6">
        <div className="card p-5">
          <h2 className="text-base font-semibold">How it works</h2>
          <p className="mt-1 text-sm text-taupe-500">
            Drop one snippet on the NuKava website. From then on, every visit is
            captured against an anonymous device. The moment someone fills out a
            form, we create their contact and stitch all of their earlier visits
            onto the record — then the engagement score keeps updating with every
            new signal.
          </p>
          <ol className="mt-3 space-y-1.5 text-sm text-taupe-600">
            <li>1. Add the snippet below to your site (before <code className="rounded bg-night-900/[0.05] px-1">{"</body>"}</code>).</li>
            <li>2. Call <code className="rounded bg-night-900/[0.05] px-1">nukava.identify(&#123;...&#125;)</code> on form submit.</li>
            <li>3. Watch leads light up on the dashboard &amp; contact profiles.</li>
          </ol>
        </div>

        <Snippet title="1 · Install snippet" code={scriptTag} />
        <Snippet title="2 · Identify on form submit" code={identifyExample} />
        <Snippet title="3 · (Optional) Track custom signals" code={trackExample} />

        <div className="card border-l-4 border-gold-400 p-5">
          <h2 className="text-base font-semibold">⚙️ One-time setup</h2>
          <p className="mt-1 text-sm text-taupe-500">
            The tracking endpoint writes on behalf of logged-out visitors, so it
            needs the Supabase <strong>service-role key</strong>. In your Vercel
            project → Settings → Environment Variables, add{" "}
            <code className="rounded bg-night-900/[0.05] px-1">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
            (from Supabase → Project Settings → API). Keep it server-side only —
            never paste it anywhere public. Until it's set, the snippet loads but
            signals won't save.
          </p>
        </div>
      </div>
    </div>
  );
}

function Snippet({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-gold-600/80">
          {title}
        </h3>
        <button onClick={copy} className="btn-subtle px-2 py-1 text-xs">
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-xl bg-night-900 p-3 text-xs leading-relaxed text-cream-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}
