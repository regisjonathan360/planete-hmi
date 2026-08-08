import { redirect } from "next/navigation";

export default async function SupportSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const { reference } = await searchParams;
  redirect(reference ? `/support/status/${encodeURIComponent(reference)}` : "/support");
}
