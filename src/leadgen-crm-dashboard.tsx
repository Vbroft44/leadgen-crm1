import React, { useEffect, useState } from "react";
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

import {
  fetchLeads,
  addLead,
  updateLead,
  deleteLead,
  fetchTechnicians,
} from "./data";

/** ---------------------------
 *  Status catalog (ordered)
 *  ---------------------------
 *  You asked for these, in chronological order, with “Sold” last.
 */
const STATUS_OPTIONS = [
  { value: "new", label: "New Lead", color: "bg-blue-600" },
  { value: "waiting_more_details", label: "Waiting for More Details from Customer", color: "bg-indigo-600" },
  { value: "waiting_new_tech", label: "Waiting for New Tech", color: "bg-violet-600" },
  { value: "waiting_customer_response", label: "Waiting for customer response", color: "bg-amber-600" },
  { value: "quote_sent_waiting_response", label: "Quote Sent / Waiting for customer Response", color: "bg-teal-600" },
  { value: "reschedule", label: "Reschedule", color: "bg-purple-600" },
  { value: "free_estimate_scheduled", label: "Free Estimate Scheduled", color: "bg-sky-600" },
  { value: "service_diag_scheduled", label: "Service / Diagnostic Call Scheduled", color: "bg-green-600" },
  { value: "visiting_charges_scheduled", label: "Visiting Charges Scheduled", color: "bg-emerald-600" },
  { value: "in_progress", label: "In Progress", color: "bg-cyan-700" },
  { value: "follow_up", label: "Follow Up with customer", color: "bg-yellow-700" },
  { value: "job_too_small", label: "Job Too Small", color: "bg-slate-600" },
  { value: "too_expensive", label: "Too expensive for customer", color: "bg-stone-600" },
  { value: "cancel_no_tech", label: "Cancelled: no tech available / show up", color: "bg-rose-600" },
  { value: "canceled", label: "Cancelled", color: "bg-red-600" },
  { value: "sold", label: "Sold", color: "bg-zinc-800" }, // keep last
] as const;

type StatusValue = (typeof STATUS_OPTIONS)[number]["value"];

type LeadRow = {
  id: number;
  customer_name: string | null;
  phone: string | null;
  phone_e164?: string | null;
  email: string | null;
  address: string | null;
  service_needed: string | null;
  status: StatusValue | null;
  created_at: string;
  first_contact_at?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  technician?: string | null;
  notes?: string | null;
  updated_at?: string | null;

  // from DB view:
  inbound_line_name?: string | null;
  openphone_conversation_url?: string | null;
};

type Lead = {
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

  // UI extras
  lineName: string;
  openphoneUrl: string;
};

const statusInfo = (v: StatusValue | string) =>
  STATUS_OPTIONS.find((s) => s.value === v) || STATUS_OPTIONS[0];

const LeadGenCRM: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [showAddLead, setShowAddLead] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [technicians, setTechnicians] = useState<string[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    (async () => {
      const t = await fetchTechnicians();
      setTechnicians(t.map((tt: any) => `${tt.name} - ${tt.trade}`));

      const data: LeadRow[] = await fetchLeads();
      const mapped: Lead[] = data.map((d) => ({
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
        lastUpdated: d.updated_at ? new Date(d.updated_at) : new Date(),

        lineName: d.inbound_line_name || "",
        openphoneUrl: d.openphone_conversation_url || "",
      }));
      setLeads(mapped);
    })();
  }, []);

  // Helpers
  const getLeadsByStatus = (s: StatusValue | string) =>
    leads.filter((l) => l.status === s);

  const needsReminder = (lead: Lead) => {
    // 2+ hours since lastUpdated and not canceled/sold
    if (lead.status === "canceled" || lead.status === "sold") return false;
    const hours =
      (Date.now() - new Date(lead.lastUpdated).getTime()) / (1000 * 60 * 60);
    return hours > 2;
  };

  const handleStatusChange = async (id: number, s: StatusValue) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: s, lastUpdated: new Date() } : l))
    );
    try {
      await updateLead(id, { status: s });
    } catch (e) {
      console.error(e);
    }
  };

  const handleLeadUpdate = async (id: number, updates: Partial<Lead>) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updates, lastUpdated: new Date() } : l))
    );
    try {
      await updateLead(id, {
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

  const handleDeleteLead = async (id: number) => {
    const ok = window.confirm("Delete this lead?");
    if (!ok) return;
    const backup = [...leads];
    setLeads((prev) => prev.filter((l) => l.id !== id));
    try {
      await deleteLead(id);
    } catch (err) {
      console.error(err);
      setLeads(backup);
      alert("Delete failed. Please try again.");
    }
  };

  const handleAddLead = async (nl: {
    customerName: string;
    phone: string;
    email: string;
    address: string;
    serviceNeeded: string;
    notes: string;
  }) => {
    if (!nl.customerName || !nl.phone || !nl.serviceNeeded) return;

    const newLocal: Lead = {
      id: -1,
      customerName: nl.customerName,
      phone: nl.phone,
      email: nl.email || "",
      address: nl.address || "",
      serviceNeeded: nl.serviceNeeded,
      status: "new",
      dateAdded: new Date(),
      appointmentDate: null,
      appointmentTime: "",
      technician: "",
      notes: nl.notes || "",
      lastUpdated: new Date(),
      lineName: "",
      openphoneUrl: "",
    };

    try {
      const created = await addLead({
        customer_name: nl.customerName,
        phone: nl.phone,
        email: nl.email || null,
        address: nl.address || null,
        service_needed: nl.serviceNeeded,
        status: "new",
        appointment_date: null,
        appointment_time: null,
        technician: null,
        notes: nl.notes || null,
      });
      newLocal.id = created.id;
      setLeads((prev) => [newLocal, ...prev]);
      setShowAddLead(false);
    } catch (e) {
      console.error(e);
    }
  };

  // Analytics
  const todayStr = new Date().toDateString();
  const analytics = {
    totalToday: leads.filter((l) => l.dateAdded.toDateString() === todayStr).length,
    soldToday: leads.filter(
      (l) => l.status === "sold" && l.lastUpdated.toDateString() === todayStr
    ).length,
    canceledToday: leads.filter(
      (l) => l.status === "canceled" && l.lastUpdated.toDateString() === todayStr
    ).length,
    activeLeads: leads.filter((l) => l.status !== "canceled" && l.status !== "sold").length,
  };

  /** ---------------------------
   *  Lead Card
   *  ---------------------------
   *  - Status dropdown fixed small width
   *  - Timestamp single line under the dropdown
   *  - Open-chat icon next to pencil
   *  - Shows Line name and Technician (if present)
   */
  const LeadCard: React.FC<{ lead: Lead }> = ({ lead }) => {
    const s = statusInfo(lead.status);
    const reminder = needsReminder(lead);

    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 hover:shadow-lg transition-shadow relative">
        {/* reminder bell */}
        {reminder && (
          <div className="absolute top-2 right-2">
            <Bell className="w-4 h-4 text-red-500 animate-pulse" />
          </div>
        )}

        <div className="space-y-3">
          {/* phone + line */}
          <div className="text-sm text-gray-700 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">—</span>
              <span className="text-gray-900 font-medium">{lead.phone}</span>
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

          {/* status + icons row */}
          <div className="flex items-center justify-between gap-3">
            <select
              value={lead.status}
              onChange={(e) => handleStatusChange(lead.id, e.target.value as StatusValue)}
              className={`w-40 min-w-[10rem] max-w-[10rem] rounded-full px-3 py-1 text-sm font-medium text-white border-none cursor-pointer ${s.color}`}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="text-gray-900">
                  {opt.label}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 text-gray-400">
              <button
                title="Edit"
                onClick={() => setSelectedLead(lead)}
                className="hover:text-blue-600"
              >
                <Edit3 className="w-4 h-4" />
              </button>

              {lead.openphoneUrl && (
                <a
                  title="Open chat"
                  href={lead.openphoneUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              <button
                title="Delete"
                onClick={() => handleDeleteLead(lead.id)}
                className="hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* timestamp under status */}
          <div className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Added {lead.dateAdded.toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  };

  // Side navigation counts
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    ...STATUS_OPTIONS.map((s) => ({
      id: s.value,
      label: s.label,
      icon:
        s.value === "new"
          ? AlertCircle
          : s.value === "in_progress"
          ? Users
          : s.value === "sold"
          ? CheckCircle
          : s.value === "canceled"
          ? XCircle
          : RotateCcw,
      count: getLeadsByStatus(s.value).length,
    })),
    { id: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  const [newLead, setNewLead] = useState({
    customerName: "",
    phone: "",
    email: "",
    address: "",
    serviceNeeded: "",
    notes: "",
  });

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
        <div className="flex space-x-6">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
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
                        <div className="flex items-center space-x-2">
                          <Icon className="w-4 h-4" />
                          <span className="truncate max-w-[170px]">{item.label}</span>
                        </div>
                        {"count" in item && item.count! > 0 && (
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

          {/* Main */}
          <main className="flex-1">
            {/* Dashboard */}
            {activeTab === "dashboard" && (
              <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="bg-white p-4 rounded-lg shadow-sm border">
                    <div className="text-2xl font-bold text-blue-600">{analytics.totalToday}</div>
                    <div className="text-sm text-gray-600">New Today</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border">
                    <div className="text-2xl font-bold text-green-600">{analytics.soldToday}</div>
                    <div className="text-sm text-gray-600">Sold Today</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border">
                    <div className="text-2xl font-bold text-red-600">{analytics.canceledToday}</div>
                    <div className="text-sm text-gray-600">Canceled Today</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border col-span-2">
                    <div className="text-2xl font-bold text-orange-600">{analytics.activeLeads}</div>
                    <div className="text-sm text-gray-600">Active Leads</div>
                  </div>
                </div>

                {/* Recent */}
                <div className="bg-white rounded-lg shadow-sm border">
                  <div className="p-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-900">Recent Leads</h2>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {leads.slice(0, 6).map((lead) => (
                      <LeadCard key={lead.id} lead={lead} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Status pages */}
            {activeTab !== "dashboard" && activeTab !== "analytics" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {statusInfo(activeTab).label}
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
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No leads found</h3>
                    <p className="text-gray-500">There are no leads in this status yet.</p>
                  </div>
                )}
              </div>
            )}

            {/* (Optional) Analytics page */}
            {activeTab === "analytics" && (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-6 border-b">
                  <h2 className="text-xl font-semibold text-gray-900">Analytics</h2>
                </div>
                <div className="p-6 text-gray-600">More analytics coming soon.</div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Add Lead Modal */}
      {showAddLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Lead</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={newLead.customerName}
                  onChange={(e) => setNewLead({ ...newLead, customerName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                <input
                  type="tel"
                  value={newLead.phone}
                  onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newLead.email}
                  onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Needed *</label>
                <input
                  type="text"
                  value={newLead.serviceNeeded}
                  onChange={(e) => setNewLead({ ...newLead, serviceNeeded: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. HVAC Repair, Plumbing, Electrical"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={newLead.address}
                  onChange={(e) => setNewLead({ ...newLead, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={newLead.notes}
                  onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddLead(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddLead(newLead)}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-screen overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Lead</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={selectedLead.customerName}
                  onChange={(e) =>
                    setSelectedLead({ ...selectedLead, customerName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={selectedLead.phone}
                  onChange={(e) =>
                    setSelectedLead({ ...selectedLead, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={selectedLead.email}
                  onChange={(e) =>
                    setSelectedLead({ ...selectedLead, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Needed
                </label>
                <input
                  type="text"
                  value={selectedLead.serviceNeeded}
                  onChange={(e) =>
                    setSelectedLead({ ...selectedLead, serviceNeeded: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={selectedLead.address}
                  onChange={(e) =>
                    setSelectedLead({ ...selectedLead, address: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* free-text technician field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Technician
                </label>
                <input
                  type="text"
                  value={selectedLead.technician || ""}
                  onChange={(e) =>
                    setSelectedLead({ ...selectedLead, technician: e.target.value })
                  }
                  placeholder="Type technician name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Appointment Date
                </label>
                <input
                  type="date"
                  value={selectedLead.appointmentDate || ""}
                  onChange={(e) =>
                    setSelectedLead({ ...selectedLead, appointmentDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Appointment Time
                </label>
                <input
                  type="time"
                  value={selectedLead.appointmentTime || ""}
                  onChange={(e) =>
                    setSelectedLead({ ...selectedLead, appointmentTime: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={selectedLead.notes}
                  onChange={(e) =>
                    setSelectedLead({ ...selectedLead, notes: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={selectedLead.status}
                  onChange={(e) =>
                    setSelectedLead({
                      ...selectedLead,
                      status: e.target.value as StatusValue,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleLeadUpdate(selectedLead.id, selectedLead)}
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

export default LeadGenCRM;
