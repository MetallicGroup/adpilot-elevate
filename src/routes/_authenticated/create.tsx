import { createFileRoute } from "@tanstack/react-router";
import { CampaignLauncher } from "@/components/wizard/CampaignLauncher";

export const Route = createFileRoute("/_authenticated/create")({
  component: CreatePage,
});

function CreatePage() {
  return <CampaignLauncher />;
}
