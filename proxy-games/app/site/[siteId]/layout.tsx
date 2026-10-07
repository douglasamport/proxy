import { notFound } from "next/navigation";
import { getSite } from "@/lib/sites";
import { SiteShell } from "@/components/game-shell/SiteShell";

// Server component: resolves the site by its id from the URL and hands
// plain data down to the client shell (see SiteShell) — replaces the old
// per-game MiningLayout/RefineLayout, which each hardcoded their own game
// slug and nav links instead of reading them from a real site.
export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await getSite(siteId);
  if (!site) notFound();

  return (
    <SiteShell
      siteId={site.id}
      siteName={site.name}
      activityType={site.activity_type}
    >
      {children}
    </SiteShell>
  );
}
