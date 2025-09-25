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

import {
  fetchLeads,
  addLead,
  updateLead,
  deleteLead,
  fetchTechnicians, // still used to prefill modal helper, but the Technician field is free text now
} from "./data";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
type Lead = {
  id: number;
  customerName: string;
  phone: string;
  email: string;
  address: string;
  serviceNeeded: string;
  status: string;

  appointmentDate: string | null;
  appointmentTime: string;

  technician: string;
  notes: string;

  dateAdded: Date;
  lastUpdated: Date;

  lineName: string; // inbound line name from OpenPhone
  openphoneUrl: string; // link to OpenPhone conversation
};

/* ------------------------------------------------------------------ */
/* Statuses (ordered chronologically, “Sold” last)                     */
/* ------------------------------------------------------------------ */
const STATUS_OPTIONS = [
  { value: "new", label: "New Lead" },

  { value: "waiting-more-details", label: "Waiting for More Details from Customer" },
  { value: "waiting-new-tech", label: "Waiting for New Tech" },
  { value: "waiting-customer-response", label: "Waiting for customer response" },
  { value: "quote-sent", label: "Quote Sent / Waiting for customer Response" },

  { value: "reschedule", label: "Reschedule" },
  { value: "free-estimate-scheduled", label: "Free Estimate Scheduled" },
  { value: "service-diagnostic-scheduled", label: "Service / Diagnostic Call Scheduled" },
  { value: "visiting-charges-scheduled", label: "Visiting Charges Scheduled" },
  { value: "in-progress", label: "In Progress" },

  { value: "follow-up", label: "Follow Up with customer" },
  { value: "job-too-small", label: "Job Too Small" },
  { value: "no-tech-available", label: "Cancelled: no tech available / show up" },
  { value: "too-expensive", label: "Too expensive for customer" },
  { value: "canceled", label: "Cancelled" },

  { value: "sold", label: "Sold" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  "new": "bg-blue-600 text-white",
  "waiting-more-details": "bg-yellow-500 text-white",
  "waiting-new-tech": "bg-orange-500 text-white",
  "waiting-customer-response": "bg-amber-500 text-white",
  "quote-sent": "bg-indigo-500 text-white",

  "reschedule": "bg-purple-500 text-white",
  "free-estimate-scheduled": "bg-teal-600 text-white",
  "service-diagnostic-scheduled": "bg-emerald-600 text-white",
  "visiting-charges-scheduled": "bg-cyan-600 text-white",
  "in-progress": "bg-sky-600 text-white",

  "follow-up": "bg-fuchsia-600 text-white",
  "job-too-small": "bg-gray-500 text-white",
  "no-tech-available": "bg-stone-600 text-white",
  "too-expensive": "bg-zinc-600 text-white",
  "canceled": "bg-red-600 text-white",

  "sold": "bg-green-600 text-white",
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */
const LeadGenCRM: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [showAddLead, setShowAddLead] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const [technicians, setTechnicians] = useState<string[]>([]); // optional helper list for you
  const [leads, setLeads] = useState<Lead[]>([]);

  /* ------------------------- Fetch initial data ------------------------- */
  useEffect(() => {
    (async () => {
      try {
        const techs = await fetchTechnicians().catch(() => []);
        if (Array.isArray(techs)) {
          setTechnicians(techs.map((t: any) => `${t.name} - ${t.trade}`));
        }
      } catch {}
      const data = await fetchLeads();

      const mapped: Lead[] = data.map((d: any) => ({
        id: d.id,
        customerName: d.customer_name || "",
        phone: d.phone || d.phone_e164 || "",
        email: d.email || "",
        address: d.address || "",
        serviceNeeded: d.service_needed || "",
        status: d.status || "new",

        dateAdded: new Date(d.first_contact_at || d.created_at),
        lastUpdated: new Date(d.updated_at),

        appointmentDate: d.appointment_date || null,
        appointmentTime: d.appointment_time || "",

        technician: d.technician || "",
        notes: d.notes || "",

        lineName: d.inbound_line_name || "",
        openphoneUrl: d.openphone_conversation_url || "",
      }));

      setLeads(mapped);
    })();
  }, []);

  /* ------------------------------ New lead ------------------------------ */
  const [newLead, setNewLead] = useState({
    customerName: "",
    phone: "",
    email: "",
    address: "",
    serviceNeeded: "",
    technician: "",
    notes: "",
  });

  /* ------------------------------ Helpers ------------------------------- */
  const needsReminder = (lead: Lead) => {
    if (lead.status === "canceled" || lead.status === "sold") return false;
    const hoursOld =
      (Date.now() - new Date(lead.lastUpdated).getTime()) / (1000 * 60 * 60);
    return hoursOld > 2;
  };

  const getLeadsByStatus = (status: string) =>
    leads.filter((l) => l.status === status);

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
        (l) => !["sold", "canceled"].includes(l.status)
      ).length,
    };
  }, [leads]);

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

  const handleLeadUpdate = async (leadId: number, updates: Partial<Lead>) => {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId ? { ...l, ...updates, lastUpdated: new Date() } : l
      )
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

    const copy = [...leads];
    setLeads((prev) => prev.filter((l) => l.id !== leadId));

    try {
      await deleteLead(leadId);
    } catch (e) {
      console.error(e);
      setLeads(copy);
      alert("Delete failed. Please try again.");
    }
  };

  const handleAddLead = async () => {
    if (!newLead.customerName || !newLead.phone || !newLead.serviceNeeded) {
      alert("Name, Phone and Service Needed are required.");
      return;
    }
    const draft: Partial<Lead> = {
      customerName: newLead.customerName,
      phone: newLead.phone,
      email: newLead.email,
      address: newLead.address,
      serviceNeeded: newLead.serviceNeeded,
      technician: newLead.technician,
      notes: newLead.notes,
      status: "new",
      dateAdded: new Date(),
      lastUpdated: new Date(),
      appointmentDate: null,
      appointmentTime: "",
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
        technician: draft.technician || null,
        notes: draft.notes || null,
      });

      const full: Lead = {
        ...(draft as Lead),
        id: created.id,
      };

      setLeads((prev) => [full, ...prev]);
      setShowAddLead(false);
      setNewLead({
        customerName: "",
        phone: "",
        email: "",
        address: "",
        serviceNeeded: "",
        technician: "",
        notes: "",
      });
    } catch (e) {
      console.error(e);
    }
  };

  /* ------------------------------------------------------------------ */
  /* UI Components                                                      */
  /* ------------------------------------------------------------------ */

  const StatusPill: React.FC<{ status: string; leadId: number }> = ({
    status,
    leadId,
  }) => {
    const color = STATUS_COLORS[status] ?? "bg-blue-600 text-white";
    return (
      <select
        value={status}
        onChange={(e) => handleStatusChange(leadId, e.target.value)}
        className={`w-40 px-3 py-2 rounded-full text-sm font-medium border-none ${color} cursor-pointer focus:outline-none`}
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value} className="text-gray-900">
            {opt.label}
          </option>
        ))}
      </select>
    );
  };

  const LeadCard: React.FC<{ lead: Lead }> = ({ lead }) => {
    const hasReminder = needsReminder(lead);
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition relative">
        {/* Reminder bell */}
        {hasReminder && (
          <div className="absolute top-2 right-2">
            <Bell className="w-4 h-4 text-red-500 animate-pulse" />
          </div>
        )}

        <div className="space-y-3">
          {/* 1) Customer Name (top line, bold) */}
          {lead.customerName && (
            <h3 className="text-base font-semibold text-gray-900 break-words">
              {lead.customerName}
            </h3>
          )}

          {/* 2) Phone + line name + (Open chat icon) */}
          <div className="flex justify-between items-start gap-2">
            <div className="text-sm text-gray-700 space-y-1">
              {/* Phone */}
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-gray-500" />
                <span className="font-medium">{lead.phone || "—"}</span>
              </div>

              {/* Line name */}
              {lead.lineName && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-500">Line:</span>
                  <span className="font-medium truncate inline-block max-w-[240px] align-bottom">
                    {lead.lineName}
                  </span>
                </div>
              )}
            </div>

            {/* Action Icons: open chat, edit, delete */}
            <div className="flex items-center gap-2">
              {lead.openphoneUrl ? (
                <a
                  href={lead.openphoneUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Open chat in OpenPhone"
                  className="p-1.5 rounded hover:bg-gray-100"
                >
                  <ExternalLink className="w-4.5 h-4.5 text-blue-600" />
                </a>
              ) : null}

              <button
                onClick={() => setSelectedLead(lead)}
                title="Edit"
                className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-blue-600"
              >
                <Edit3 className="w-4.5 h-4.5" />
              </button>

              <button
                onClick={() => handleDeleteLead(lead.id)}
                title="Delete"
                className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-red-600"
              >
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* 3) Service Needed */}
          {lead.serviceNeeded && (
            <p className="text-sm text-gray-900">
              <span className="font-semibold">Service Needed:</span>{" "}
              <span className="break-words">{lead.serviceNeeded}</span>
            </p>
          )}

          {/* 4) Address */}
          {lead.address && (
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <MapPin className="w-3.5 h-3.5 mt-0.5 text-gray-500 shrink-0" />
              <span className="break-words">{lead.address}</span>
            </div>
          )}

          {/* 5) Technician */}
          {lead.technician && (
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Technician:</span>{" "}
              <span className="break-words">{lead.technician}</span>
            </p>
          )}

          {/* 6) Appointment */}
          {(lead.appointmentDate || lead.appointmentTime) && (
            <div className="bg-green-50 border border-green-100 rounded p-2 text-sm text-green-900 space-y-1">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {lead.appointmentDate || "—"}
                  {lead.appointmentTime ? ` at ${lead.appointmentTime}` : ""}
                </span>
              </div>
            </div>
          )}

          {/* 7) Notes */}
          {lead.notes && (
            <p className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded p-2">
              {lead.notes}
            </p>
          )}

          {/* 8) Status (compact dropdown) */}
          <div className="pt-1">
            <StatusPill status={lead.status} leadId={lead.id} />
          </div>

          {/* 9) Timestamp */}
          <div className="text-xs text-gray-400 flex items-center gap-1 pt-1">
            <Clock className="w-3 h-3" />
            <span>Added {new Date(lead.dateAdded).toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  };

  /* ------------------------------- Nav list ------------------------------ */
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "new", label: "New Lead", icon: AlertCircle, count: getLeadsByStatus("new").length },

    { id: "waiting-more-details", label: "Waiting for More Details …", icon: Phone, count: getLeadsByStatus("waiting-more-details").length },
    { id: "waiting-new-tech", label: "Waiting for New Tech", icon: Users, count: getLeadsByStatus("waiting-new-tech").length },
    { id: "waiting-customer-response", label: "Waiting for customer res…", icon: Mail, count: getLeadsByStatus("waiting-customer-response").length },
    { id: "quote-sent", label: "Quote Sent / Waiting …", icon: Mail, count: getLeadsByStatus("quote-sent").length },

    { id: "reschedule", label: "Reschedule", icon: RotateCcw, count: getLeadsByStatus("reschedule").length },
    { id: "free-estimate-scheduled", label: "Free Estimate Scheduled", icon: Calendar, count: getLeadsByStatus("free-estimate-scheduled").length },
    { id: "service-diagnostic-scheduled", label: "Service / Diagnostic Call …", icon: Calendar, count: getLeadsByStatus("service-diagnostic-scheduled").length },
    { id: "visiting-charges-scheduled", label: "Visiting Charges Scheduled", icon: Calendar, count: getLeadsByStatus("visiting-charges-scheduled").length },
    { id: "in-progress", label: "In Progress", icon: Users, count: getLeadsByStatus("in-progress").length },

    { id: "follow-up", label: "Follow Up with customer", icon: Phone, count: getLeadsByStatus("follow-up").length },
    { id: "job-too-small", label: "Job Too Small", icon: XCircle, count: getLeadsByStatus("job-too-small").length },
    { id: "no-tech-available", label: "Cancelled: no tech avail …", icon: XCircle, count: getLeadsByStatus("no-tech-available").length },
    { id: "too-expensive", label: "Too expensive for custom…", icon: XCircle, count: getLeadsByStatus("too-expensive").length },
    { id: "canceled", label: "Cancelled", icon: XCircle, count: getLeadsByStatus("canceled").length },

    { id: "sold", label: "Sold", icon: CheckCircle, count: getLeadsByStatus("sold").length },

    { id: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */
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
              <h1 className="text-xl font-bold text-gray-900">
                Lead Generation CRM
              </h1>
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
          <aside className="w-64 shrink-0">
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
                            ? "bg-blue-50 text-blue-700 border border-blue-100"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          <span className="truncate max-w-[180px] text-left">
                            {item.label}
                          </span>
                        </div>

                        {typeof item.count === "number" && item.count > 0 && (
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              activeTab === item.id
                                ? "bg-blue-200 text-blue-800"
                                : "bg-gray-200 text-gray-700"
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
          <main className="flex-1 space-y-6">
            {/* Dashboard cards */}
            {activeTab === "dashboard" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                  <div className="bg-white p-4 rounded-lg shadow-sm border col-span-2">
                    <div className="text-2xl font-bold text-orange-600">
                      {analytics.activeLeads}
                    </div>
                    <div className="text-sm text-gray-600">Active Leads</div>
                  </div>
                </div>

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
            )}

            {/* Status pages */}
            {activeTab !== "dashboard" && activeTab !== "analytics" && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {STATUS_OPTIONS.find((s) => s.value === activeTab)?.label ??
                      "Leads"}
                  </h2>
                  <div className="text-sm text-gray-500">
                    {getLeadsByStatus(activeTab).length} leads
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getLeadsByStatus(activeTab).map((lead) => (
                    <LeadCard key={lead.id} lead={lead} />
                  ))}
                </div>
              </section>
            )}

            {/* Analytics stub */}
            {activeTab === "analytics" && (
              <section className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Analytics
                </h2>
                <p className="text-gray-600">
                  (Add charts here later if you’d like.)
                </p>
              </section>
            )}
          </main>
        </div>
      </div>

      {/* Add Lead Modal */}
      {showAddLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add New Lead
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={newLead.customerName}
                  onChange={(e) =>
                    setNewLead({ ...newLead, customerName: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone *
                </label>
                <input
                  type="tel"
                  value={newLead.phone}
                  onChange={(e) =>
                    setNewLead({ ...newLead, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newLead.email}
                  onChange={(e) =>
                    setNewLead({ ...newLead, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Needed *
                </label>
                <input
                  type="text"
                  value={newLead.serviceNeeded}
                  onChange={(e) =>
                    setNewLead({ ...newLead, serviceNeeded: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={newLead.address}
                  onChange={(e) =>
                    setNewLead({ ...newLead, address: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Technician
                </label>
                <input
                  type="text"
                  value={newLead.technician}
                  onChange={(e) =>
                    setNewLead({ ...newLead, technician: e.target.value })
                  }
                  placeholder={
                    technicians.length ? `e.g. ${technicians[0]}` : "Type name"
                  }
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={newLead.notes}
                  onChange={(e) =>
                    setNewLead({ ...newLead, notes: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddLead(false)}
                className="px-4 py-2 text-gray-700 border rounded-md hover:bg-gray-50"
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
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[95vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Edit Lead
            </h3>

            <div className="space-y-4">
              {/* Customer Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={selectedLead.customerName}
                  onChange={(e) =>
                    setSelectedLead({
                      ...selectedLead,
                      customerName: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={selectedLead.phone}
                  onChange={(e) =>
                    setSelectedLead({ ...selectedLead, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={selectedLead.email}
                  onChange={(e) =>
                    setSelectedLead({ ...selectedLead, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Service Needed */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Needed
                </label>
                <input
                  type="text"
                  value={selectedLead.serviceNeeded}
                  onChange={(e) =>
                    setSelectedLead({
                      ...selectedLead,
                      serviceNeeded: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={selectedLead.address}
                  onChange={(e) =>
                    setSelectedLead({ ...selectedLead, address: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Technician (free text) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Technician
                </label>
                <input
                  type="text"
                  value={selectedLead.technician}
                  onChange={(e) =>
                    setSelectedLead({
                      ...selectedLead,
                      technician: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Appointment Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Appointment Date
                </label>
                <input
                  type="date"
                  value={selectedLead.appointmentDate || ""}
                  onChange={(e) =>
                    setSelectedLead({
                      ...selectedLead,
                      appointmentDate: e.target.value || null,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Appointment Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Appointment Time
                </label>
                <input
                  type="time"
                  value={selectedLead.appointmentTime || ""}
                  onChange={(e) =>
                    setSelectedLead({
                      ...selectedLead,
                      appointmentTime: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={selectedLead.notes}
                  onChange={(e) =>
                    setSelectedLead({ ...selectedLead, notes: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={selectedLead.status}
                  onChange={(e) =>
                    setSelectedLead({ ...selectedLead, status: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 text-gray-700 border rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  selectedLead &&
                  handleLeadUpdate(selectedLead.id, { ...selectedLead })
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

export default LeadGenCRM;
