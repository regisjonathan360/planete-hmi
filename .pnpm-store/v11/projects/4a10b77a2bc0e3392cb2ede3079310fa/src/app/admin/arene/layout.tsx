import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { AdminHeader } from "../AdminHeader";
import { AreneAdminNav } from "./AreneAdminNav";

export const dynamic = "force-dynamic";

export default async function AdminAreneLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login?next=/admin/arene");

  return (
    <>
      <AdminHeader email={user.email} active="arene" />
      <div className="admin__main" style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
        <AreneAdminNav />
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </div>
    </>
  );
}
