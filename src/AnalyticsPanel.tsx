// src/AnalyticsPanel.tsx
import React, { useMemo } from "react";
import { BarChart3, Activity, TrendingUp, Phone } from "lucide-react";

type Lead = {
  id: number | string;
  status: string;
  dateAdded: Date | string;
  lineName?: string;
};

type Props = {
  leads: Lead[];
  timezone?: string; // optional, default browser tz
};

const TERMINAL_STATUSES = new Set<string>([
  "Cancelled",
  "Cancelled due to no tech available / show up",
  "Too expensive for customer",
  "Job Too Small",
  "Sold",
]);

function isToday(d: Date, tz?: string) {
  const today = new Date();
  const toLocalDateString = (x: Date) =>
    x.toLocaleDateString(undefined, tz ? { timeZone: tz } : undefined);
  return toLocalDateString(d) === toLocalDateString(today);
}

function startOfDay(date: Date, tz?: string) {
  // We’ll bucket by local date-string to avoid TZ headaches
  return date.toLocaleDateString(undefined, tz ? { timeZone: tz } : undefined);
}

function lastNDates(n: number, tz?: string) {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(d.toLocaleDateString(undefined, tz ? { timeZone: tz } : undefined));
  }
  return out;
}

const AnalyticsPanel: React.FC<Props> = ({ leads, timezone }) => {
  // Normalize dates to Date
  const normLeads = useMemo(
    () =>
      leads.map((l) => ({
        ...l,
        date: l.dateAdded instanceof Date ? l.dateAdded : new Date(l.dateAdded),
        line: l.lineName || "(Unknown)",
      })),
    [leads]
  );

  // KPI: today
  const newToday = useMemo(
    () => normLeads.filter((l) => isToday(l.date, timezone)).length,
    [normLeads, timezone]
  );

  const soldToday = useMemo(
    () =>
      normLeads.filter(
        (l) => l.status === "Sold" && isToday(l.date, timezone)
      ).length,
    [normLeads, timezone]
  );

  const canceledToday = useMemo(
    () =>
      normLeads.filter(
        (l) =>
          (l.status === "Cancelled" ||
            l.status === "Cancelled due to no tech available / show up") &&
          isToday(l.date, timezone)
      ).length,
    [normLeads, timezone]
  );

  // Active pipeline (not in terminal statuses)
  const activePipeline = useMemo(
    () => normLeads.filter((l) => !TERMINAL_STATUSES.has(l.status)).length,
    [normLeads]
  );

  // Last 14 days buckets
  const days = useMemo(() => lastNDates(14, timezone), [timezone]);

  const dayCounts = useMemo(() => {
    const map = new Map<string, number>();
    days.forEach((d) => map.set(d, 0));
    normLeads.forEach((l) => {
      const key = startOfDay(l.date, timezone);
      if (map.has(key)) map.set(key, (map.get(key) || 0) + 1);
    });
    return days.map((d) => ({ day: d, count: map.get(d) || 0 }));
  }, [normLeads, days, timezone]);

  const maxDay = Math.max(1, ...dayCounts.map((d) => d.count));

  const last14Total = dayCounts.reduce((a, b) => a + b.count, 0);
  const last14Avg = +(last14Total / 14).toFixed(1);

  // Aging: active leads older than 3 days
  const activeOlder3d = useMemo(() => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    return normLeads.filter(
      (l) => !TERMINAL_STATUSES.has(l.status) && l.date < threeDaysAgo
    ).length;
  }, [normLeads]);

  // By line (last 14 days)
  const lineCounts = useMemo(() => {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 13); // inclusive
    const counts = new Map<string, number>();
    normLeads.forEach((l) => {
      if (l.date >= sinceDate) {
        counts.set(l.line, (counts.get(l.line) || 0) + 1);
      }
    });
    const arr = Array.from(counts.entries())
      .map(([line, count]) => ({ line, count }))
      .sort((a, b) => b.count - a.count);
    const total = arr.reduce((a, b) => a + b.count, 0) || 1;
    return { rows: arr, total };
  }, [normLeads]);

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<Phone className="w-4 h-4" />} label="New Today" value={newToday} />
        <KpiCard icon={<Activity className="w-4 h-4" />} label="Active Pipeline" value={activePipeline} />
        <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="Sold Today" value={soldToday} />
        <KpiCard icon={<BarChart3 className="w-4 h-4" />} label="Canceled Today" value={canceledToday} />
      </div>

      {/* 14-day skinny bar */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Calls / Leads per Day (last 14 days)</h3>
          <div className="text-sm text-gray-500">
            Total: <span className="font-medium text-gray-700">{last14Total}</span> • Avg/day:{" "}
            <span className="font-medium text-gray-700">{last14Avg}</span>
          </div>
        </div>
        <div className="flex items-end gap-2 h-28">
          {dayCounts.map((d, i) => {
            const h = Math.round((d.count / maxDay) * 100);
            return (
              <div key={i} className="flex flex-col items-center justify-end">
                <div
                  className="w-3 rounded-md bg-blue-500 transition-all"
                  style={{ height: `${Math.max(6, h)}%` }}
                  title={`${d.day} • ${d.count}`}
                />
                <div className="mt-1 text-[10px] text-gray-500">
                  {new Date(d.day).toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leads by line (last 14 days) */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Leads by Line (last 14 days)</h3>
          <div className="text-sm text-gray-500">
            Total: <span className="font-medium text-gray-700">{lineCounts.total}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2 pr-4">Line</th>
                <th className="py-2 pr-4">Leads</th>
                <th className="py-2">Share</th>
              </tr>
            </thead>
            <tbody>
              {lineCounts.rows.map((row) => (
                <tr key={row.line} className="border-t">
                  <td className="py-2 pr-4 whitespace-nowrap max-w-[280px] truncate">{row.line}</td>
                  <td className="py-2 pr-4">{row.count}</td>
                  <td className="py-2">
                    {Math.round((row.count / (lineCounts.total || 1)) * 100)}%
                  </td>
                </tr>
              ))}
              {lineCounts.rows.length === 0 && (
                <tr>
                  <td className="py-4 text-gray-500" colSpan={3}>
                    No data in the last 14 days.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick stats (numbers only) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SimpleStat label="Leads last 14 days" value={last14Total} />
        <SimpleStat label="Avg leads/day (14d)" value={last14Avg} />
        <SimpleStat label="Active leads older than 3 days" value={activeOlder3d} />
      </div>
    </div>
  );
};

const KpiCard: React.FC<{ icon: React.ReactNode; label: string; value: number | string }> = ({
  icon,
  label,
  value,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-gray-600 text-sm">
          {icon}
          {label}
        </span>
        <span className="text-2xl font-bold text-gray-900">{value}</span>
      </div>
    </div>
  );
};

const SimpleStat: React.FC<{ label: string; value: number | string }> = ({ label, value }) => (
  <div className="bg-white rounded-lg shadow-sm border p-4">
    <div className="text-sm text-gray-500">{label}</div>
    <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
  </div>
);

export default AnalyticsPanel;
