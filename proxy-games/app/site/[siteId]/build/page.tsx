import { notFound } from "next/navigation";
import { getSite } from "@/lib/sites";
import { BuildScreen } from "../_mining/BuildScreen";

// Extraction-only sub-screen — a non-extraction site simply doesn't have
// a chassis to build, same as it wouldn't have had this route at all
// under the old /games/mining/build path.
export default async function SiteBuildPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await getSite(siteId);
  if (!site || site.activity_type !== "extraction") notFound();

  return <BuildScreen />;
}
