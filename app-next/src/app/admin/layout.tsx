import Link from "next/link";
import "./admin.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin">
      <div className="admin__wrap">
        <nav className="admin__nav">
          <span className="admin__brand">HMI · Admin</span>
          <Link href="/admin/charts">Tableau de bord</Link>
          <Link href="/admin/charts/import">Import</Link>
          <Link href="/admin/charts/review">Correspondances</Link>
          <Link href="/admin/charts/artists">Artistes</Link>
          <Link href="/admin/charts/sources">Sources</Link>
          <Link href="/admin/charts/history">Historique</Link>
          <span className="admin__spacer" />
          <Link href="/charts">Voir le site ↗</Link>
        </nav>
        {children}
      </div>
    </div>
  );
}
