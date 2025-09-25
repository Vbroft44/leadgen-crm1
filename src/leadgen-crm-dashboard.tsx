import React, { useEffect, useMemo, useState } from "react";
import {
  Phone,
  Mail,
  Calendar,
  Clock,
  Plus,
  Bell,
  User,
  MapPin,
  Edit3,
  BarChart3,
  Home,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  RotateCcw,
  ExternalLink,
  Trash2,
} from "lucide-react";

// Your existing data helpers (unchanged)
import {
  fetchLeads,
  addLead,
  updateLead,
  fetchTechnicians,
  deleteLead,
} from "./data";

/* ------------------------------------------------------------
   Status options (unchanged from your working version)
------------------------------------------------------------- */
const STATUS_OPTIONS = [
  { value: "new", label: "New Lead", color: "bg-blue-600", textColor: "text-white" },

  { value: "waiting-more-details", label: "Waiting for More Details from Customer", color: "bg-amber-600", textColor: "text-white" },
  { value: "waiting-new-tech", label: "Waiting for New Tech", color: "bg-amber-600", textColor: "text-white" },
  { value: "waiting-customer-response", label: "Waiting for customer response", color: "bg-yellow-600", textColor: "text-white" },
  { value: "quote-sent", label: "Quote Sent / Waiting for customer Response", color: "bg-sky-700", textColor: "text-white" },

  { value: "rescheduled", label: "Reschedule", color: "bg-purple-600", textColor: "text-white" },
  { value: "free-estimate-scheduled", label: "Free Estimate Scheduled", color: "bg-emerald-600", textColor: "text-white" },
  { value: "service-diagnostic-scheduled", label: "Service / Diagnostic Call Scheduled", color: "bg-emerald-700", textColor: "text-white" },
  { value: "visiting-charges-scheduled", label: "Visiting Charges Scheduled", color: "bg-green-700", textColor: "text-white" },
  { value: "in-progress", label: "In Progress", color: "bg-indigo-600", textColor: "text-white" },

  { value: "follow-up", label: "Follow Up with customer", color: "bg-violet-600", textColor: "text-white" },
  { value: "job-too-small", label: "Job Too Small", color: "bg-gray-600", textColor: "text-white" },
  { value: "too-expensive", label: "Too expensive for customer", color: "bg-zinc-700", textColor: "text-white" },
  { value: "cancelled-no-tech", label: "Cancelled due to no tech available / show up", color: "bg-rose-700", textColor: "text-white" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-600", textColor: "text-white" },

  { value: "sold", label: "Sold", color: "bg-teal-700", textColor: "text-white" },
] as const;

type StatusValue = (typeof STATUS_OPTIONS)[number]["value"];

const TERMINAL_STATUSES: StatusValue[] = [
  "cancelled",
  "sold",
  "too-expensive",
  "job-too-small",
  "cancelled-no-tech",
];

/* ------------------------------------------------------------
   Types (UI shape)
------------------------------------------------------------- */
type UiLead = {
  id: number;
  customerName: string;
  phone: string;
  email: string;
  address: string;
  serviceNeeded: string;
  status: StatusValue;
  dateAdded: Date;
  appointmentDate: string | null;
  appointmentTime: string;
  technician: string;
  notes: string;
  lastUpdated: Date;
  lineName: string;
  openphoneUrl: string;
};

/* ------------------------------------------------------------
   Utils
------------------------------------------------------------- */
const fmtDate = (d: Date) =>
  d.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" });

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const today = () => new Date();

/* ------------------------------------------------------------
   Component
------------------------------------------------------------- */
const LeadGenCRM: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [showAddLead, setShowAddLead] = useState(false);
  const [selectedLead, setSelectedLead] = useState<UiLead | null>(null);

  const [technicians, setTechnicians] = useState<string[]>([]);
  const [leads, setLeads] = useState<UiLead[]>([]);

  /* -------------------- Fetch bootstrap data -------------------- */
  useEffect(() => {
    (async () => {
      const techs = await fetchTechnicians();
      setTechnicians(techs.map((t: any) => `${t.name} - ${t.trade}`));

      const data = await fetchLeads();

      const mapped: UiLead[] = data.map((d: any) => ({
        id: d.id,
        customerName: d.customer_name || "",
        phone: d.phone || d.phone_e164 || "",
        email: d.email || "",
        address: d.address || "",
        serviceNeeded: d.service_needed || "",
        status: (d.status || "new") as StatusValue,
        dateAdded: new Date(d.first_contact_at || d.created_at),
        appointmentDate: d.appointment_date || null,
        appointmentTime: d.appointment_time || "",
        technician: d.technician || "",
        notes: d.notes || "",
        lastUpdated: new Date(d.updated_at),
        lineName: d.inbound_line_name || "",
        openphoneUrl: d.openphone_conversation_url || "",
      }));

      setLeads(mapped);
    })();
  }, []);

  /* -------------------- Derived helpers -------------------- */
  const getLeadsByStatus = (status: StatusValue) =>
    leads.filter((l) => l.status === status);

  const needsReminder = (lead: UiLead) => {
    if (TERMINAL_STATUSES.includes(lead.status)) return false;
    const hours = (Date.now() - lead.lastUpdated.getTime()) / 36e5;
    return hours > 2;
  };

  const getStatusInfo = (status: StatusValue) =>
    STATUS_OPTIONS.find((s) => s.value === status)!;

  const handleStatusChange = async (leadId: number, newStatus: StatusValue) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus, lastUpdated: new Date() } : l))
    );
    try {
      await updateLead(leadId, { status: newStatus });
    } catch (e) {
      console.error(e);
    }
  };

  const handleLeadUpdate = async (leadId: number, updates: Partial<UiLead>) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, ...updates, lastUpdated: new Date() } : l))
    );
    try {
      await updateLead(leadId, {
        customer_name: updates.customerName,
        phone: updates.phone,
        email: updates.email,
        address: updates.address,
        service_needed: updates.serviceNeeded,
        status: updates.status,
        appointment_date: updates.appointmentDate,
        appointment_time: updates.appointmentTime,
        technician: updates.technician,
        notes: updates.notes,
      });
    } catch (e) {
      console.error(e);
    }
    setSelectedLead(null);
  };

  const handleDeleteLead = async (leadId: number) => {
    const ok = window.confirm("Delete this lead?");
    if (!ok) return;

    const previous = [...leads];
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    try {
      await deleteLead(leadId);
    } catch (e) {
      console.error(e);
      setLeads(previous);
      alert("Delete failed. Please try again.");
    }
  };

  const [newLead, setNewLead] = useState({
    customerName: "",
    phone: "",
    email: "",
    address: "",
    serviceNeeded: "",
    notes: "",
  });

  const handleAddLead = async () => {
    if (!newLead.customerName || !newLead.phone || !newLead.serviceNeeded) return;
    const draft: UiLead = {
      id: -1,
      customerName: newLead.customerName,
      phone: newLead.phone,
      email: newLead.email || "",
      address: newLead.address || "",
      serviceNeeded: newLead.serviceNeeded,
      status: "new",
      dateAdded: new Date(),
      lastUpdated: new Date(),
      appointmentDate: null,
      appointmentTime: "",
      technician: "",
      notes: newLead.notes || "",
      lineName: "",
      openphoneUrl: "",
    };
    try {
      const created = await addLead({
        customer_name: newLead.customerName,
        phone: newLead.phone,
        email: newLead.email || null,
        address: newLead.address || null,
        service_needed: newLead.serviceNeeded,
        status: "new",
        appointment_date: null,
        appointment_time: null,
        technician: null,
        notes: newLead.notes || null,
      });
      draft.id = created.id;
      setLeads((prev) => [draft, ...prev]);
      setShowAddLead(false);
      setNewLead({ customerName: "", phone: "", email: "", address: "", serviceNeeded: "", notes: "" });
    } catch (e) {
      console.error(e);
    }
  };

  /* -------------------- Analytics (memoized) -------------------- */
  const analytics = useMemo(() => {
    const now = today();

    // last 14 days buckets
    const N = 14;
    const buckets: { key: string; label: string; date: Date; count: number }[] = [];
    for (let i = N - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const label = d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      buckets.push({ key, label, date: d, count: 0 });
    }
    leads.forEach((l) => {
      for (const b of buckets) {
        if (sameDay(l.dateAdded, b.date)) {
          b.count++;
          break;
        }
      }
    });

    const leadsLast14 = buckets.reduce((a, b) => a + b.count, 0);

    // pipeline = not terminal
    const inPipeline = leads.filter((l) => !TERMINAL_STATUSES.includes(l.status)).length;

    // by line
    const perLine: Record<string, number> = {};
    for (const l of leads) {
      const key = l.lineName?.trim() || "(no line)";
      perLine[key] = (perLine[key] ?? 0) + 1;
    }
    const perLineArr = Object.entries(perLine)
      .map(([line, count]) => ({ line, count }))
      .sort((a, b) => b.count - a.count);

    const uniqueLines = perLineArr.filter((x) => x.line !== "(no line)").length;

    return {
      last14Bars: buckets,
      leadsLast14,
      inPipeline,
      perLineArr,
      uniqueLines,
      totalLeads: leads.length,
    };
  }, [leads]);

  /* -------------------- Lead Card -------------------- */
  const LeadCard: React.FC<{ lead: UiLead }> = ({ lead }) => {
    const statusInfo = getStatusInfo(lead.status);
    const reminder = needsReminder(lead);

    return (
      <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow transition">
        {/* bell */}
        {reminder && (
          <div className="absolute top-3 left-3">
            <Bell className="w-4 h-4 text-red-500 animate-pulse" />
          </div>
        )}

        {/* Top content */}
        <div className="pr-24 space-y-3">
          {/* Name */}
          {!!lead.customerName && (
            <h3 className="text-base font-semibold text-gray-900">{lead.customerName}</h3>
          )}

          {/* Phone */}
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Phone className="w-4 h-4 text-gray-400" />
            <span className="font-medium">{lead.phone || "—"}</span>
          </div>

          {/* Line + Open chat small icon just after title row (but we keep the bottom icon too) */}
          {lead.lineName && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span className="text-gray-500">Line:</span>
              <span className="font-semibold truncate">{lead.lineName}</span>
            </div>
          )}

          {/* Service */}
          {lead.serviceNeeded && (
            <div className="text-sm">
              <span className="text-gray-500">Service Needed: </span>
              <span className="font-medium text-gray-800">{lead.serviceNeeded}</span>
            </div>
          )}

          {/* Address */}
          {lead.address && (
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <MapPin className="w-4 h-4 mt-0.5 text-gray-400 flex-none" />
              <span className="leading-snug">{lead.address}</span>
            </div>
          )}

          {/* Technician */}
          {lead.technician && (
            <div className="text-sm">
              <span className="text-gray-500">Technician: </span>
              <span className="font-medium text-gray-800">{lead.technician}</span>
            </div>
          )}

          {/* Appointment */}
          {!!lead.appointmentDate && (
            <div className="bg-emerald-50 text-emerald-800 text-sm rounded-md px-3 py-2 inline-flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>
                {lead.appointmentDate} {lead.appointmentTime ? `at ${lead.appointmentTime}` : ""}
              </span>
            </div>
          )}

          {/* Notes */}
          {!!lead.notes && (
            <div className="text-sm text-gray-700 bg-gray-50 rounded-md px-3 py-2">
              {lead.notes}
            </div>
          )}

          {/* Status + timestamp */}
          <div className="mt-1 flex items-center gap-3">
            <select
              value={lead.status}
              onChange={(e) => handleStatusChange(lead.id, e.target.value as StatusValue)}
              className={`w-44 px-3 py-2 rounded-full text-sm font-medium border-0 ${statusInfo.color} ${statusInfo.textColor} cursor-pointer`}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value} className="text-gray-900">
                  {s.label}
                </option>
              ))}
            </select>

            <div className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Added {lead.dateAdded.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Bottom-right icon cluster */}
        <div className="absolute bottom-3 right-3 flex items-center gap-4">
          {lead.openphoneUrl && (
            <a
              href={lead.openphoneUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800"
              title="Open chat in OpenPhone"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
          )}
          <button
            onClick={() => setSelectedLead(lead)}
            className="text-gray-500 hover:text-blue-600"
            title="Edit lead"
          >
            <Edit3 className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleDeleteLead(lead.id)}
            className="text-gray-500 hover:text-red-600"
            title="Delete lead"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  };

  /* -------------------- Sidebar nav -------------------- */
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "new", label: "New Lead", icon: AlertCircle, count: getLeadsByStatus("new").length },

    { id: "waiting-more-details", label: "Waiting for More Details ...", icon: Phone, count: getLeadsByStatus("waiting-more-details").length },
    { id: "waiting-new-tech", label: "Waiting for New Tech", icon: Users, count: getLeadsByStatus("waiting-new-tech").length },
    { id: "waiting-customer-response", label: "Waiting for customer res...", icon: Users, count: getLeadsByStatus("waiting-customer-response").length },
    { id: "quote-sent", label: "Quote Sent / Waiting ...", icon: Users, count: getLeadsByStatus("quote-sent").length },

    { id: "free-estimate-scheduled", label: "Free Estimate Scheduled", icon: Calendar, count: getLeadsByStatus("free-estimate-scheduled").length },
    { id: "service-diagnostic-scheduled", label: "Service / Diagnostic Call ...", icon: Calendar, count: getLeadsByStatus("service-diagnostic-scheduled").length },
    { id: "visiting-charges-scheduled", label: "Visiting Charges Scheduled", icon: Calendar, count: getLeadsByStatus("visiting-charges-scheduled").length },
    { id: "in-progress", label: "In Progress", icon: RotateCcw, count: getLeadsByStatus("in-progress").length },
    { id: "follow-up", label: "Follow Up with customer", icon: CheckCircle, count: getLeadsByStatus("follow-up").length },

    { id: "job-too-small", label: "Job Too Small", icon: XCircle, count: getLeadsByStatus("job-too-small").length },
    { id: "too-expensive", label: "Too expensive for custom...", icon: XCircle, count: getLeadsByStatus("too-expensive").length },
    { id: "cancelled-no-tech", label: "Cancelled: no tech avail ...", icon: XCircle, count: getLeadsByStatus("cancelled-no-tech").length },
    { id: "cancelled", label: "Cancelled", icon: XCircle, count: getLeadsByStatus("cancelled").length },

    { id: "sold", label: "Sold", icon: CheckCircle, count: getLeadsByStatus("sold").length },

    { id: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  /* -------------------- Layout -------------------- */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <Phone className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Lead Generation CRM</h1>
            </div>

            <button
              onClick={() => setShowAddLead(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Lead
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <nav className="bg-white border rounded-lg shadow-sm p-4">
              <ul className="space-y-2">
                {navItems.map((n) => {
                  const Icon = n.icon;
                  const active = activeTab === n.id;
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => setActiveTab(n.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm ${
                          active ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          <span className="truncate">{n.label}</span>
                        </span>
                        {!!n.count && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              active ? "bg-blue-200 text-blue-800" : "bg-gray-200 text-gray-700"
                            }`}
                          >
                            {n.count}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>

          {/* Main */}
          <main className="flex-1">
            {/* Dashboard showing quick cards + recent leads */}
            {activeTab === "dashboard" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <StatCard title="New Today" value={
                    leads.filter((l) => sameDay(l.dateAdded, today())).length
                  } />
                  <StatCard title="Sold Today" value={
                    leads.filter((l) => l.status === "sold" && sameDay(l.lastUpdated, today())).length
                  } />
                  <StatCard title="Canceled Today" value={
                    leads.filter((l) => (l.status === "cancelled" || l.status === "cancelled-no-tech") && sameDay(l.lastUpdated, today())).length
                  } />
                  <StatCard title="Active Leads" value={
                    leads.filter((l) => !TERMINAL_STATUSES.includes(l.status)).length
                  } />
                  <StatCard title="Total Leads" value={leads.length} />
                </div>

                <section className="bg-white border rounded-lg shadow-sm">
                  <header className="border-b p-4">
                    <h2 className="text-lg font-semibold text-gray-900">Recent Leads</h2>
                  </header>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {leads.slice(0, 6).map((l) => (
                      <LeadCard key={l.id} lead={l} />
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* Status pages */}
            {activeTab !== "dashboard" && activeTab !== "analytics" && (
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {STATUS_OPTIONS.find((s) => s.value === activeTab)?.label || "Leads"}
                  </h2>
                  <span className="text-sm text-gray-500">
                    {getLeadsByStatus(activeTab as StatusValue).length} leads
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {getLeadsByStatus(activeTab as StatusValue).map((l) => (
                    <LeadCard key={l.id} lead={l} />
                  ))}
                </div>
              </section>
            )}

            {/* Analytics page */}
            {activeTab === "analytics" && (
              <section className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <StatCard title="Leads (last 14 days)" value={analytics.leadsLast14} />
                  <StatCard title="In Pipeline" value={analytics.inPipeline} />
                  <StatCard title="Unique Lines" value={analytics.uniqueLines} />
                  <StatCard title="Total Leads" value={analytics.totalLeads} />
                </div>

                {/* Skinny 14-day bar chart */}
                <div className="bg-white border rounded-lg shadow-sm p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Leads per day (last 14 days)</h3>
                  </div>
                  <div className="h-32 flex items-end gap-2">
                    {analytics.last14Bars.map((b) => {
                      const max = Math.max(1, ...analytics.last14Bars.map((x) => x.count));
                      const hPct = (b.count / max) * 100;
                      return (
                        <div key={b.key} className="flex-1 flex flex-col items-center">
                          <div
                            className="w-full max-w-[18px] bg-blue-500 rounded-t"
                            style={{ height: `${hPct}%` }}
                            title={`${b.label}: ${b.count}`}
                          />
                          <div className="text-[10px] text-gray-500 mt-1">{b.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Calls per line (table) */}
                <div className="bg-white border rounded-lg shadow-sm">
                  <header className="border-b p-4">
                    <h3 className="text-lg font-semibold text-gray-900">Calls per line</h3>
                  </header>
                  <div className="p-4 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500">
                          <th className="py-2 pr-4">Line</th>
                          <th className="py-2 pr-4">Leads</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.perLineArr.map((row, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="py-2 pr-4">{row.line}</td>
                            <td className="py-2 pr-4 font-semibold">{row.count}</td>
                          </tr>
                        ))}
                        {analytics.perLineArr.length === 0 && (
                          <tr>
                            <td colSpan={2} className="text-gray-500 py-6 text-center">
                              No data yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}
          </main>
        </div>
      </div>

      {/* Add Lead Modal */}
      {showAddLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Lead</h3>
            <div className="space-y-4">
              <LabeledInput
                label="Customer Name *"
                value={newLead.customerName}
                onChange={(v) => setNewLead((p) => ({ ...p, customerName: v }))}
              />
              <LabeledInput
                label="Phone *"
                value={newLead.phone}
                onChange={(v) => setNewLead((p) => ({ ...p, phone: v }))}
              />
              <LabeledInput
                label="Email"
                value={newLead.email}
                onChange={(v) => setNewLead((p) => ({ ...p, email: v }))}
              />
              <LabeledInput
                label="Service Needed *"
                placeholder="e.g. HVAC Repair, Plumbing, Electrical"
                value={newLead.serviceNeeded}
                onChange={(v) => setNewLead((p) => ({ ...p, serviceNeeded: v }))}
              />
              <LabeledInput
                label="Address"
                value={newLead.address}
                onChange={(v) => setNewLead((p) => ({ ...p, address: v }))}
              />
              <LabeledTextArea
                label="Notes"
                value={newLead.notes}
                onChange={(v) => setNewLead((p) => ({ ...p, notes: v }))}
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button className="px-4 py-2 text-gray-700 border rounded-md" onClick={() => setShowAddLead(false)}>
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md" onClick={handleAddLead}>
                Add Lead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Lead</h3>
            <div className="space-y-4">
              <LabeledInput
                label="Customer Name"
                value={selectedLead.customerName}
                onChange={(v) => setSelectedLead({ ...selectedLead, customerName: v })}
              />
              <LabeledInput
                label="Phone"
                value={selectedLead.phone}
                onChange={(v) => setSelectedLead({ ...selectedLead, phone: v })}
              />
              <LabeledInput
                label="Email"
                value={selectedLead.email}
                onChange={(v) => setSelectedLead({ ...selectedLead, email: v })}
              />
              <LabeledInput
                label="Service Needed"
                value={selectedLead.serviceNeeded}
                onChange={(v) => setSelectedLead({ ...selectedLead, serviceNeeded: v })}
              />
              <LabeledInput
                label="Address"
                value={selectedLead.address}
                onChange={(v) => setSelectedLead({ ...selectedLead, address: v })}
              />
              <LabeledInput
                label="Technician"
                value={selectedLead.technician}
                onChange={(v) => setSelectedLead({ ...selectedLead, technician: v })}
                placeholder="Type technician name"
              />
              <LabeledInput
                type="date"
                label="Appointment Date"
                value={selectedLead.appointmentDate || ""}
                onChange={(v) => setSelectedLead({ ...selectedLead, appointmentDate: v })}
              />
              <LabeledInput
                type="time"
                label="Appointment Time"
                value={selectedLead.appointmentTime || ""}
                onChange={(v) => setSelectedLead({ ...selectedLead, appointmentTime: v })}
              />
              <LabeledTextArea
                label="Notes"
                value={selectedLead.notes}
                onChange={(v) => setSelectedLead({ ...selectedLead, notes: v })}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={selectedLead.status}
                  onChange={(e) => setSelectedLead({ ...selectedLead, status: e.target.value as StatusValue })}
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button className="px-4 py-2 text-gray-700 border rounded-md" onClick={() => setSelectedLead(null)}>
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-md"
                onClick={() => handleLeadUpdate(selectedLead.id, selectedLead)}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------
   Small UI helpers
------------------------------------------------------------- */
const StatCard: React.FC<{ title: string; value: number | string }> = ({ title, value }) => (
  <div className="bg-white border rounded-lg shadow-sm p-4">
    <div className="text-2xl font-bold text-gray-900">{value}</div>
    <div className="text-sm text-gray-600">{title}</div>
  </div>
);

const LabeledInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}> = ({ label, value, onChange, type = "text", placeholder }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
    />
  </div>
);

const LabeledTextArea: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
    />
  </div>
);

export default LeadGenCRM;
