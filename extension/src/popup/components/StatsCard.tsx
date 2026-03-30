type StatsCardProps = {
  label: string;
  value: string | number;
};

export const StatsCard = ({ label, value }: StatsCardProps) => (
  <div className="metric">
    <span className="metricValue">{value}</span>
    <span className="metricLabel">{label}</span>
  </div>
);
