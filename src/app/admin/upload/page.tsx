import { UploadForm } from "@/components/UploadForm";
import { getLocale } from "@/lib/i18n.server";

export default async function UploadPage() {
  const locale = await getLocale();
  return <UploadForm locale={locale} />;
}
