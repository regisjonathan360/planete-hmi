/**
 * Page d'administration de la radio Planète HMI
 * Gestion complète des playlists, pistes, et configuration
 */
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { 
  getAllPlaylists, 
  getAllRadioTracks, 
  getRadioConfig,
  getRadioStats 
} from "@/lib/radio/queries";
import { RadioAdminDashboard } from "@/components/admin/radio/RadioAdminDashboard";
import { AdminHeader } from "../AdminHeader";

export const dynamic = "force-dynamic";

export default async function RadioAdminPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login?next=/admin/radio");

  const [playlists, tracks, config, stats] = await Promise.all([
    getAllPlaylists(),
    getAllRadioTracks(200),
    getRadioConfig(),
    getRadioStats(),
  ]);

  return (
    <>
      <AdminHeader email={admin.email} active="radio" />
      <main className="admin__main">
        <h1 className="admin__title">Administration de la radio</h1>
        <p className="admin__subtitle">Gérez les playlists, les pistes et la diffusion continue de Planète HMI.</p>

        <RadioAdminDashboard
          initialPlaylists={playlists}
          initialTracks={tracks}
          initialConfig={config}
          initialStats={stats}
          adminEmail={admin.email ?? ""}
        />
      </main>
    </>
  );
}
