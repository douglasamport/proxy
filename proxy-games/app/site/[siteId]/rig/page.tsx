import { notFound } from "next/navigation";
import { getSite } from "@/lib/sites";
import { RigScreen } from "../_refine/RigScreen";

// Refining-only — pick which owned furnace/vat/cooler part is active.
export default async function SiteRigPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await getSite(siteId);
  if (!site || site.activity_type !== "refining") notFound();

  return <RigScreen />;
}
