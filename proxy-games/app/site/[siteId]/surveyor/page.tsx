import { notFound } from "next/navigation";
import { getSite } from "@/lib/sites";
import { SurveyorScreen } from "../_mining/SurveyorScreen";

// Extraction-only — mineral licences and ore trading.
export default async function SiteSurveyorPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await getSite(siteId);
  if (!site || site.activity_type !== "extraction") notFound();

  return <SurveyorScreen />;
}
