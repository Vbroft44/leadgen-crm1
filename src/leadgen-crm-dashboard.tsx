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

// NOTE: these are your existing data helpers
import {
  fetchLeads,
  addLead,
  updateLead,
  fetchTechnicians,
  deleteLead,
} from "./data";

/** ---------- Statuses (ordered pipeline) ---------- */
const statusOptions = [
  { value: "new", label: "New Lead", color: "bg-blue-600", textColor: "text-white" },

  { value: "waiting-more-details", label: "Waiting for More Details from Customer", color: "bg-sky-600", textColor: "text-white" },
  { value: "waiting-new-tech", label: "Waiting for New Tech", color: "bg-indigo-600", textColor: "text-white" },
  { value: "waiting-customer-response", label: "Waiting for customer response", color: "bg-yellow-600", textColor: "text-white" },

  { value: "quote-sent", label: "Quote Sent / Waiting for customer Response", color: "bg-amber-600", textColor: "text-white" },

  { value: "free-estimate-scheduled", label: "Free Estimate Scheduled", color: "bg-emerald-600", textColor: "text-white" },
  { value: "service-diagnostic-scheduled", label: "Service / Diagnostic Call Scheduled", color: "bg-green-600", textColor: "text-white" },
  { value: "visiting-charges-scheduled", label: "Visiting Charges Scheduled", color: "bg-lime-600", textColor: "text-white" },

  { value: "in-progress", label: "In Progress", color: "bg-violet-600", textColor: "text-white" },

  { value: "follow-up", label: "Follow Up with customer", color: "bg-fuchsia-600", textColor: "text-white" },
  { value: "job-too-small", label: "Job Too Small", color: "bg-stone-500", textColor: "text-white" },
  { value: "too-expensive", label: "Too expensive for customer", color: "bg-gray-600", textColor: "text-white" },

  { value: "reschedule", label: "Reschedule", color: "bg-purple-600", textColor: "text-white" },
  { value: "canceled-no-tech", label: "Cancelled due to no tech available / show up", color: "bg-rose-500", textColor: "text-white" },
  { value: "canceled", label: "Cancelled", color: "bg-red-600", textColor: "text-white" },

  // keep Sold LAST
  { value: "sold", label: "Sold", color: "bg-teal-700", textColor: "text-white" },
] as const;

type StatusValue = (typeof statusOptions)[number]["value"];

type LeadUI = {
  id: number;
  customerName: string;
  phone: string;
  email: string;
  address: string;
  serviceNeeded: string;
  status: StatusValue | string;
  dateAdded: Date;
  appointmentDate: string | null;
  appointmentTime: string;
  technician: string;
  notes: string;
  lastUpdated: Date;

  // extras
  lineName: string;
  openphoneUrl: string;
};

const LeadGenCRM: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [showAddLead, setShowAddLead] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadUI | null>(null);
  const [technicians, setTechnicians] = useState<string[]>([]);
  const [leads, setLeads] = useState<LeadUI[]>([]);

  /** ---------- Load technicians + leads ---------- */
  useEffect(() => {
    (async () => {
      try {
        const t = await fetchTechnicians();
        setTechnicians(t.map((tt: any) => `${tt.name} - ${tt.trade}`));

        const data = await fetchLeads();
        // Map DB -> UI
        const mapped: LeadUI[] = data.map((d: any) => ({
          id: d.id,
          customerName: d.customer_name || "",
          phone: d.phone || d.phone_e164 || "",
          email: d.email || "",
          address: d.address || "",
          serviceNeeded: d.service_needed || "",
          status: (d.status as StatusValue) || "new",
          dateAdded: new Date(d.first_contact_at || d.created_at),
          appointmentDate: d.appointment_date || null,
          appointmentTime: d.appointment_time || "",
          technician: d.technician || "",
          notes: d.notes || "",
          lastUpdated: new Date(d.updated_at || d.created_at),

          lineName: d.inbound_line_name || "",
          openphoneUrl: d.openphone_conversation_url || "",
        }));

        setLeads(mapped);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  /** ---------- Helpers ---------- */
  const getStatusInfo = (status: string) =>
    statusOptions.find((s) => s.value === status);

  const getLeadsByStatus = (status: string) =>
    leads.filter((l) => l.status === status);

  const needsReminder = (lead: LeadUI) => {
    if (lead.status === "canceled" || lead.status === "sold") return false;
    const hours =
      (Date.now() - new Date(lead.lastUpdated).getTime()) / (1000 * 60 * 60);
    return hours > 2;
    // tweak threshold if you want different reminder timing
  };

  const analytics = useMemo(() => {
    const todayStr = new Date().toDateString();
    const todayLeads = leads.filter(
      (l) => new Date(l.dateAdded).toDateString() === todayStr
    );
    return {
      totalToday: todayLeads.length,
      soldToday: todayLeads.filter((l) => l.status === "sold").length,
      canceledToday: todayLeads.filter((l) => l.status === "canceled").length,
      activeLeads: leads.filter(
        (l) => l.status !== "canceled" && l.status !== "sold"
      ).length,
    };
  }, [leads]);

  /** ---------- Mutations ---------- */
  const handleStatusChange = async (leadId: number, newStatus: string) => {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId ? { ...l, status: newStatus, lastUpdated: new Date() } : l
      )
    );
    try {
      await updateLead(leadId, { status: newStatus });
    } catch (e) {
      console.error(e);
    }
  };

  const handleLeadUpdate = async (leadId: number, updates: Partial<LeadUI>) => {
    // Immediate UI update
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, ...updates } : l))
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
    } finally {
      setSelectedLead(null);
    }
  };

  const handleDeleteLead = async (leadId: number) => {
    const ok = window.confirm("Delete this lead?");
    if (!ok) return;

    const prev = [...leads];
    setLeads((p) => p.filter((l) => l.id !== leadId));
    try {
      await deleteLead(leadId);
    } catch (e) {
      console.error(e);
      setLeads(prev);
      alert("Delete failed. Please try again.");
    }
  };

  const handleAddLead = async () => {
    if (!newLead.customerName || !newLead.phone || !newLead.serviceNeeded) {
      return;
    }
    const draft: LeadUI = {
      id: -1,
      customerName: newLead.customerName,
      phone: newLead.phone,
      email: newLead.email || "",
      address: newLead.address || "",
      serviceNeeded: newLead.serviceNeeded,
      status: "new",
      dateAdded: new Date(),
      appointmentDate: null,
      appointmentTime: "",
      technician: "",
      notes: newLead.notes || "",
      lastUpdated: new Date(),
      lineName: "",
      openphoneUrl: "",
    };

    try {
      const created = await addLead({
        customer_name: draft.customerName,
        phone: draft.phone,
        email: draft.email || null,
        address: draft.address || null,
        service_needed: draft.serviceNeeded,
        status: "new",
        appointment_date: null,
        appointment_time: null,
        technician: null,
        notes: draft.notes || null,
      });
      draft.id = created.id;
      setLeads((p) => [draft, ...p]);
      setShowAddLead(false);
      setNewLead({
        customerName: "",
        phone: "",
        email: "",
        address: "",
        serviceNeeded: "",
        notes: "",
      });
    } catch (e) {
      console.error(e);
    }
  };

  /** ---------- New lead modal state ---------- */
  const [newLead, setNewLead] = useState({
    customerName: "",
    phone: "",
    email: "",
    address: "",
    serviceNeeded: "",
    notes: "",
  });

  /** ---------- Components ---------- */

  /** Single Lead Card */
  const LeadCard: React.FC<{ lead: LeadUI }> = ({ lead }) => {
    const statusInfo = getStatusInfo(lead.status);
    const hasReminder = needsReminder(lead);

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow relative">
        {/* Reminder bell */}
        {hasReminder && (
          <div className="absolute top-2 right-2">
            <Bell className="w-4 h-4 text-red-500 animate-pulse" />
          </div>
        )}

        <div className="space-y-3">
          {/* Phone + Line */}
          <div className="text-sm text-gray-700 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">—</span>
              <span className="font-medium">{lead.phone || "—"}</span>
            </div>

            {lead.lineName && (
              <div className="text-gray-700">
                <span className="font-semibold">Line:</span>{" "}
                <span className="truncate inline-block max-w-[240px] align-bottom">
                  {lead.lineName}
                </span>
              </div>
            )}

            {lead.technician && (
              <div className="text-gray-700">
                <span className="font-semibold">Technician:</span>{" "}
                <span className="truncate inline-block max-w-[240px] align-bottom">
                  {lead.technician}
                </span>
              </div>
            )}
          </div>

          {/* Status + actions row */}
          <div className="flex items-center justify-between gap-2">
            {/* status select */}
            <select
              value={lead.status}
              onChange={(e) => handleStatusChange(lead.id, e.target.value)}
              className={`px-3 py-2 rounded-full text-sm font-medium border-none focus:ring-2 focus:ring-offset-2 ${statusInfo?.color ?? "bg-blue-600"} ${statusInfo?.textColor ?? "text-white"} hover:brightness-110 transition`}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className="text-gray-900">
                  {opt.label}
                </option>
              ))}
            </select>

            {/* action icons */}
            <div className="flex items-center gap-2 text-gray-400">
              {/* Open chat icon (only if URL exists) — sits to the LEFT of the pencil */}
              {lead.openphoneUrl && (
                <a
                  href={lead.openphoneUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open conversation in OpenPhone"
                  className="p-1 rounded hover:text-blue-600 hover:bg-blue-50 transition"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              {/* edit */}
              <button
                onClick={() => setSelectedLead(lead)}
                className="p-1 rounded hover:text-blue-600 hover:bg-blue-50 transition"
                title="Edit lead"
              >
                <Edit3 className="w-4 h-4" />
              </button>

              {/* delete */}
              <button
                onClick={() => handleDeleteLead(lead.id)}
                className="p-1 rounded hover:text-red-600 hover:bg-red-50 transition"
                title="Delete lead"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* timestamp (single line) */}
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>
              Added {new Date(lead.dateAdded).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    );
  };

  /** Sidebar nav */
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "new", label: "New Lead", icon: AlertCircle, count: getLeadsByStatus("new").length },

    { id: "waiting-more-details", label: "Waiting for More Details …", icon: Phone, count: getLeadsByStatus("waiting-more-details").length },
    { id: "waiting-new-tech", label: "Waiting for New Tech", icon: Users, count: getLeadsByStatus("waiting-new-tech").length },
    { id: "waiting-customer-response", label: "Waiting for customer res…", icon: Phone, count: getLeadsByStatus("waiting-customer-response").length },

    { id: "quote-sent", label: "Quote Sent / Waiting …", icon: Mail, count: getLeadsByStatus("quote-sent").length },

    { id: "free-estimate-scheduled", label: "Free Estimate Scheduled", icon: Calendar, count: getLeadsByStatus("free-estimate-scheduled").length },
    { id: "service-diagnostic-scheduled", label: "Service / Diagnostic Call …", icon: Calendar, count: getLeadsByStatus("service-diagnostic-scheduled").length },
    { id: "visiting-charges-scheduled", label: "Visiting Charges Scheduled", icon: Calendar, count: getLeadsByStatus("visiting-charges-scheduled").length },

    { id: "in-progress", label: "In Progress", icon: RotateCcw, count: getLeadsByStatus("in-progress").length },

    { id: "follow-up", label: "Follow Up with customer", icon: Bell, count: getLeadsByStatus("follow-up").length },
    { id: "job-too-small", label: "Job Too Small", icon: XCircle, count: getLeadsByStatus("job-too-small").length },
    { id: "too-expensive", label: "Too expensive for custom…", icon: XCircle, count: getLeadsByStatus("too-expensive").length },

    { id: "reschedule", label: "Reschedule", icon: RotateCcw, count: getLeadsByStatus("reschedule").length },
    { id: "canceled-no-tech", label: "Cancelled: no tech avail …", icon: XCircle, count: getLeadsByStatus("canceled-no-tech").length },
    { id: "canceled", label: "Cancelled", icon: XCircle, count: getLeadsByStatus("canceled").length },

    { id: "sold", label: "Sold", icon: CheckCircle, count: getLeadsByStatus("sold").length },

    { id: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  /** ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Phone className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Lead Generation CRM</h1>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Bell className="w-4 h-4" />
                <span>{leads.filter(needsReminder).length} reminders</span>
              </div>

              <button
                onClick={() => setShowAddLead(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Lead</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-72 flex-shrink-0">
            <nav className="bg-white rounded-lg shadow-sm border p-4">
              <ul className="space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          activeTab === item.id
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                        title={item.label}
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <Icon className="w-4 h-4 flex-none" />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.count !== undefined && item.count > 0 && (
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              activeTab === item.id
                                ? "bg-blue-200 text-blue-800"
                                : "bg-gray-200 text-gray-600"
                            }`}
                          >
                            {item.count}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {activeTab === "dashboard" ? (
              <>
                {/* Top stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white p-4 rounded-lg shadow-sm border">
                    <div className="text-2xl font-bold text-blue-600">
                      {analytics.totalToday}
                    </div>
                    <div className="text-sm text-gray-600">New Today</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border">
                    <div className="text-2xl font-bold text-green-600">
                      {analytics.soldToday}
                    </div>
                    <div className="text-sm text-gray-600">Sold Today</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border">
                    <div className="text-2xl font-bold text-red-600">
                      {analytics.canceledToday}
                    </div>
                    <div className="text-sm text-gray-600">Canceled Today</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border">
                    <div className="text-2xl font-bold text-orange-600">
                      {analytics.activeLeads}
                    </div>
                    <div className="text-sm text-gray-600">Active Leads</div>
                  </div>
                </div>

                {/* Recent leads grid */}
                <section className="bg-white rounded-lg shadow-sm border">
                  <div className="p-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Recent Leads
                    </h2>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {leads.slice(0, 6).map((lead) => (
                      <LeadCard key={lead.id} lead={lead} />
                    ))}
                  </div>
                </section>
              </>
            ) : activeTab === "analytics" ? (
              <section className="bg-white rounded-lg shadow-sm border">
                <div className="p-6 border-b">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Analytics Dashboard
                  </h2>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
                  <StatBlock label="New Leads Today" value={analytics.totalToday} color="text-blue-600" />
                  <StatBlock label="Sold Today" value={analytics.soldToday} color="text-green-600" />
                  <StatBlock label="Canceled Today" value={analytics.canceledToday} color="text-red-600" />
                  <StatBlock label="Active Leads" value={analytics.activeLeads} color="text-orange-600" />
                </div>
              </section>
            ) : (
              // Status view
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {statusOptions.find((s) => s.value === activeTab)?.label || "Leads"}
                  </h2>
                  <div className="text-sm text-gray-500">
                    {getLeadsByStatus(activeTab).length} leads
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {getLeadsByStatus(activeTab).map((lead) => (
                    <LeadCard key={lead.id} lead={lead} />
                  ))}
                </div>

                {getLeadsByStatus(activeTab).length === 0 && (
                  <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
                    <div className="text-gray-400 mb-4">
                      <AlertCircle className="w-12 h-12 mx-auto" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No leads found
                    </h3>
                    <p className="text-gray-500">
                      There are no leads in this status yet.
                    </p>
                  </div>
                )}
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
              <TextField
                label="Customer Name *"
                value={newLead.customerName}
                onChange={(v) => setNewLead({ ...newLead, customerName: v })}
              />
              <TextField
                label="Phone *"
                type="tel"
                value={newLead.phone}
                onChange={(v) => setNewLead({ ...newLead, phone: v })}
              />
              <TextField
                label="Email"
                type="email"
                value={newLead.email}
                onChange={(v) => setNewLead({ ...newLead, email: v })}
              />
              <TextField
                label="Service Needed *"
                value={newLead.serviceNeeded}
                onChange={(v) => setNewLead({ ...newLead, serviceNeeded: v })}
                placeholder="e.g. HVAC Repair, Plumbing, Electrical"
              />
              <TextField
                label="Address"
                value={newLead.address}
                onChange={(v) => setNewLead({ ...newLead, address: v })}
              />
              <TextArea
                label="Notes"
                value={newLead.notes}
                onChange={(v) => setNewLead({ ...newLead, notes: v })}
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddLead(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddLead}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
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
              <TextField
                label="Customer Name"
                value={selectedLead.customerName}
                onChange={(v) =>
                  setSelectedLead({ ...selectedLead, customerName: v } as LeadUI)
                }
              />
              <TextField
                label="Phone"
                type="tel"
                value={selectedLead.phone}
                onChange={(v) =>
                  setSelectedLead({ ...selectedLead, phone: v } as LeadUI)
                }
              />
              <TextField
                label="Email"
                type="email"
                value={selectedLead.email}
                onChange={(v) =>
                  setSelectedLead({ ...selectedLead, email: v } as LeadUI)
                }
              />
              <TextField
                label="Service Needed"
                value={selectedLead.serviceNeeded}
                onChange={(v) =>
                  setSelectedLead({ ...selectedLead, serviceNeeded: v } as LeadUI)
                }
              />
              <TextField
                label="Address"
                value={selectedLead.address}
                onChange={(v) =>
                  setSelectedLead({ ...selectedLead, address: v } as LeadUI)
                }
              />

              {/* Technician — free text */}
              <TextField
                label="Technician"
                placeholder="Type technician name"
                value={selectedLead.technician || ""}
                onChange={(v) =>
                  setSelectedLead({ ...selectedLead, technician: v } as LeadUI)
                }
              />

              <TextField
                label="Appointment Date"
                type="date"
                value={selectedLead.appointmentDate || ""}
                onChange={(v) =>
                  setSelectedLead({ ...selectedLead, appointmentDate: v } as LeadUI)
                }
              />
              <TextField
                label="Appointment Time"
                type="time"
                value={selectedLead.appointmentTime || ""}
                onChange={(v) =>
                  setSelectedLead({ ...selectedLead, appointmentTime: v } as LeadUI)
                }
              />
              <TextArea
                label="Notes"
                value={selectedLead.notes || ""}
                onChange={(v) =>
                  setSelectedLead({ ...selectedLead, notes: v } as LeadUI)
                }
              />

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={selectedLead.status}
                  onChange={(e) =>
                    setSelectedLead({
                      ...selectedLead,
                      status: e.target.value,
                    } as LeadUI)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Line + OpenPhone link (display only) */}
              {selectedLead.lineName && (
                <div className="text-sm">
                  <div className="text-gray-700">
                    <span className="font-medium">Line:</span> {selectedLead.lineName}
                  </div>
                  {selectedLead.openphoneUrl && (
                    <div className="mt-1">
                      <a
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                        href={selectedLead.openphoneUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Open conversation in OpenPhone</span>
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleLeadUpdate(selectedLead.id, {
                    customerName: selectedLead.customerName,
                    phone: selectedLead.phone,
                    email: selectedLead.email,
                    address: selectedLead.address,
                    serviceNeeded: selectedLead.serviceNeeded,
                    status: selectedLead.status,
                    appointmentDate: selectedLead.appointmentDate,
                    appointmentTime: selectedLead.appointmentTime,
                    technician: selectedLead.technician,
                    notes: selectedLead.notes,
                  })
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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

/** ---------- Small helpers ---------- */
const StatBlock: React.FC<{ label: string; value: number; color: string }> = ({
  label,
  value,
  color,
}) => (
  <div className="text-center">
    <div className={`text-3xl font-bold ${color}`}>{value}</div>
    <div className="text-gray-600">{label}</div>
  </div>
);

const TextField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}> = ({ label, value, onChange, placeholder, type = "text" }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
    />
  </div>
);

const TextArea: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}> = ({ label, value, onChange, rows = 3 }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
    <textarea
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
    />
  </div>
);

export default LeadGenCRM;
