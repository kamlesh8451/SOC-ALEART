import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const CHART_HEIGHT = 300;

type ChartPoint = { name: string; open: number; closed: number };

export function IncidentVelocityChart({ data }: { data: ChartPoint[] }) {
  return (
    <div className="w-full h-[300px] min-w-0" style={{ minHeight: CHART_HEIGHT, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0} minHeight={CHART_HEIGHT}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.05} vertical={false} />
          <XAxis dataKey="name" stroke="currentColor" strokeOpacity={0.15} fontSize={10} axisLine={false} tickLine={false} />
          <YAxis stroke="currentColor" strokeOpacity={0.15} fontSize={10} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: 'var(--card-bg, #1a1a1a)',
              border: '1px solid var(--card-border, #333)',
              fontSize: '10px',
              color: 'var(--foreground, #fff)',
            }}
          />
          <Area type="monotone" dataKey="open" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.1} />
          <Area type="monotone" dataKey="closed" stroke="#22c55e" fill="#22c55e" fillOpacity={0.05} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
