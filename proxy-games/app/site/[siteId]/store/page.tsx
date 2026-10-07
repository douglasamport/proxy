import { notFound } from "next/navigation";
import { getSite } from "@/lib/sites";
import { MiningStoreScreen } from "../_mining/MiningStoreScreen";
import { RefineStoreScreen } from "../_refine/RefineStoreScreen";

// The one route name both activity_types share — both are already thin
// wrappers around the same shared CatalogScreen component, just with
// different category filters (see the two Screen components).
export default async function SiteStorePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await getSite(siteId);
  if (!site) notFound();

  if (site.activity_type === "extraction") return <MiningStoreScreen />;
  if (site.activity_type === "refining") return <RefineStoreScreen />;
  notFound();
}
