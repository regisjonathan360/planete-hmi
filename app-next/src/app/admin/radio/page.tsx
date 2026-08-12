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
    <div className="admin-container">
      <div className="admin-header">
        <h1>🎵 Administration de la Radio</h1>
        <p>
          Gérez la radio Planète HMI : playlists, pistes, et configuration
        </p>
      </div>

      <RadioAdminDashboard
        initialPlaylists={playlists}
        initialTracks={tracks}
        initialConfig={config}
        initialStats={stats}
        adminEmail={admin.email ?? ""}
      />
    </div>
  );
}
