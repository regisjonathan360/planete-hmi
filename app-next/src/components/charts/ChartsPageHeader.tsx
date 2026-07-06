import Link from "next/link";

export function ChartsPageHeader({
  semaine,
  publieLe,
}: {
  semaine?: string;
  publieLe?: string;
}) {
  return (
    <header>
      <h1 className="hmi__title">Classements Planète HMI</h1>
      <p className="hmi__lead">
        Les chansons haïtiennes les plus performantes sur les principales
        plateformes musicales.
      </p>
      <div className="hmi__meta">
        {semaine && <span>Semaine : {semaine}</span>}
        {publieLe && <span>Publié le {publieLe}</span>}
        <Link className="hmi__link" href="/charts/methodology">
          Méthodologie
        </Link>
      </div>
    </header>
  );
}
