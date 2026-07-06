import "./charts.css";

export default function ChartsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="hmi">
      <div className="hmi__wrap">{children}</div>
    </div>
  );
}
