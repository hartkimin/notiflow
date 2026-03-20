import { getCompanySettings } from "@/lib/queries/company-settings";
import CompanySettingsForm from "@/components/company-settings-form";

export default async function CompanySettingsPage() {
  const settings = await getCompanySettings();
  return <CompanySettingsForm initialSettings={settings} />;
}
