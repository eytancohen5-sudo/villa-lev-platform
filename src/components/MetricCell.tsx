export function MetricCell({
  value,
  label,
  sublabel,
  valueClass,
}: {
  value: string;
  label: string;
  sublabel?: string;
  valueClass?: string;
}) {
  return (
    <div className="text-center px-2">
      <div className={`kpi-value ${valueClass ?? "text-text-primary"}`}>{value}</div>
      <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-secondary mt-2">
        {label}
      </div>
      {sublabel && (
        <div className="text-xs text-text-tertiary mt-0.5">{sublabel}</div>
      )}
    </div>
  );
}
