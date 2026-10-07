import { notFound } from "next/navigation";
import { getSite } from "@/lib/sites";
import { MiningRunScreen } from "./_mining/MiningRunScreen";
import { RefineBatchScreen } from "./_refine/RefineBatchScreen";

// The site's primary screen — which engine renders is determined by
// activity_type, not hardcoded per route (see the Smashies rebuild
// foundation doc's Routing section). Each activity_type's screen is still
// its own component (not a rewrite into one shared minigame) — extraction
// and refining are structurally different games.
export default async function SitePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await getSite(siteId);
  if (!site) notFound();

  if (site.activity_type === "extraction")
    return <MiningRunScreen siteId={siteId} />;
  if (site.activity_type === "refining")
    return <RefineBatchScreen siteId={siteId} />;
  notFound();
}
