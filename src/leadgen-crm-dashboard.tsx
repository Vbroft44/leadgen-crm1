import React, { useEffect, useMemo, useState } from 'react';
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
  Info,
  FileText,
  MessageCircle,
  Quote,
  ClipboardList,
  Stethoscope,
  DollarSign,
  Wrench,
  RefreshCcw,
  PauseCircle,
  FileWarning,
  HandCoins,
  FlagTriangleRight,
} from 'lucide-react';

import {
  fetchLeads,
  addLead,
  updateLead,
  deleteLead,
  fetchTechnicians,
} from './data';

/** ────────────────────────────────────────────────────────────────────────────
 *  1) NEW STATUS SET (order = chronological, “Sold” last)
 *  Each item has: value, label, color, textColor
 *  You can tweak colors any time.
 *  ───────────────────────────────────────────────────────────────────────── */
export const statusOptions = [
  { value: 'new', label: 'New Lead', color: 'bg-blue-600', textColor: 'text-white' },

  { value: 'waiting-more-details', label: 'Waiting for More Details from Customer', color: 'bg-yellow-600', textColor: 'text-white' },
  { value: 'waiting-new-tech', label: 'Waiting for New Tech', color: 'bg-amber-600', textColor: 'text-white' },
  { value: 'waiting-customer-response', label: 'Waiting for customer response', color: 'bg-yellow-500', textColor: 'text-white' },
  { value: 'quote-sent-waiting-response', label: 'Quote Sent / Waiting for customer Response', color: 'bg-indigo-600', textColor: 'text-white' },

  { value: 'free-estimate-scheduled', label: 'Free Estimate Scheduled', color: 'bg-cyan-600', textColor: 'text-white' },
  { value: 'service-diagnostic-scheduled', label: 'Service / Diagnostic Call Scheduled', color: 'bg-teal-600', textColor: 'text-white' },
  { value: 'visiting-charges-scheduled', label: 'Visiting Charges Scheduled', color: 'bg-sky-600', textColor: 'text-white' },

  { value: 'in-progress', label: 'In Progress', color: 'bg-orange-600', textColor: 'text-white' },

  { value: 'follow-up-customer', label: 'Follow Up with customer', color: 'bg-purple-600', textColor: 'text-white' },
  { value: 'job-too-small', label: 'Job Too Small', color: 'bg-gray-500', textColor: 'text-white' },
  { value: 'too-expensive', label: 'Too expensive for customer', color: 'bg-gray-600', textColor: 'text-white' },

  { value: 'rescheduled', label: 'Reschedule', color: 'bg-fuchsia-600', textColor: 'text-white' },
  { value: 'canceled-no-tech', label: 'Cancelled due to no tech available / show up', color: 'bg-red-500', textColor: 'text-white' },
  { value: 'canceled', label: 'Cancelled', color: 'bg-red-600', textColor: 'text-white' },

  // ALWAYS LAST
  { value: 'sold', label: 'Sold', color: 'bg-green-600', textColor: 'text-white' },
] as const;

type StatusValue = typeof statusOptions[number]['value'];
type StatusOption = typeof statusOptions[number];

/** Optional: map a small icon to some statuses (purely visual) */
const statusIcon: Partial<Record<StatusValue, React.ElementType>> = {
  'new': AlertCircle,
  'waiting-more-details': Info,
  'waiting-new-tech': Users,
  'waiting-customer-response': MessageCircle,
  'quote-sent-waiting-response': Quote,

  'free-estimate-scheduled': ClipboardList,
  'service-diagnostic-scheduled': Stethoscope,
  'visiting-charges-scheduled': DollarSign,

  'in-progress': Wrench,

  'follow-up-customer': RefreshCcw,
  'job-too-small': FileWarning,
  'too-expensive': HandCoins,

  'rescheduled': RotateCcw,
  'canceled-no-tech': XCircle,
  'canceled': XCircle,

  'sold': CheckCircle,
};

/** Statuses considered “closed” (don’t count as active) */
const CLOSED_STATUSES: StatusValue[] = [
  'sold',
  'canceled',
  'canceled-no-tech',
  'job-too-small',
  'too-expensive',
];

/** ────────────────────────────────────────────────────────────────────────────
 *  Lead Type used inside the component
 *  (mapping from DB happens in useEffect)
 *  ───────────────────────────────────────────────────────────────────────── */
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

  // from OpenPhone sync:
  lineName: string;
  openphoneUrl: string;
};

const LeadGenCRM: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [showAddLead, setShowAddLead] = useState(false);
  const [selectedLead, setSelectedLead] = useState<UiLead | null>(null);

  const [technicians, setTechnicians] = useState<string[]>([]);
  const [leads, setLeads] = useState<UiLead[]>([]);

  /** ─ Load data on mount ─ */
  useEffect(() => {
    (async () => {
      const t = await fetchTechnicians();
      setTechnicians(t.map(tt => `${tt.name} - ${tt.trade}`));

      const data = await fetchLeads();
      const mapped: UiLead[] = data.map((d: any) => ({
        id: d.id,
        customerName: d.customer_name,
        phone: d.phone || d.phone_e164 || '',
        email: d.email || '',
        address: d.address || '',
        serviceNeeded: d.service_needed,
        status: (d.status as StatusValue) || 'new',
        dateAdded: new Date(d.first_contact_at || d.created_at),
        appointmentDate: d.appointment_date,
        appointmentTime: d.appointment_time || '',
        technician: d.technician || '',
        notes: d.notes || '',
        lastUpdated: new Date(d.updated_at),

        lineName: d.inbound_line_name || '',
        openphoneUrl: d.openphone_conversation_url || '',
      }));

      setLeads(mapped);
    })();
  }, []);

  /** ─ New lead form state ─ */
  const [newLead, setNewLead] = useState({
    customerName: '',
    phone: '',
    email: '',
    address: '',
    serviceNeeded: '',
    notes: '',
  });

  /** Helpers */
  const getStatusInfo = (status: StatusValue): StatusOption =>
    statusOptions.find(s => s.value === status)!;

  const getLeadsByStatus = (status: StatusValue) =>
    leads.filter(l => l.status === status);

  const isClosed = (status: StatusValue) => CLOSED_STATUSES.includes(status);

  const getActiveLeadsCount = () =>
    leads.filter(l => !isClosed(l.status)).length;

  const needsReminder = (lead: UiLead) => {
    if (isClosed(lead.status)) return false;
    const hoursOld = (Date.now() - new Date(lead.lastUpdated).getTime()) / 36e5;
    return hoursOld > 2;
  };

  /** ─ Status change ─ */
  const handleStatusChange = async (leadId: number, newStatus: StatusValue) => {
    setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, status: newStatus, lastUpdated: new Date() } : l)));
    try {
      await updateLead(leadId, { status: newStatus });
    } catch (e) {
      console.error(e);
    }
  };

  /** ─ Update lead ─ */
  const handleLeadUpdate = async (leadId: number, updates: Partial<UiLead>) => {
    setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, ...updates, lastUpdated: new Date() } : l)));
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

  /** ─ Delete lead ─ */
  const handleDeleteLead = async (leadId: number) => {
    const ok = window.confirm('Delete this lead? (You can re-create it later)');
    if (!ok) return;
    const previous = [...leads];
    setLeads(prev => prev.filter(l => l.id !== leadId));
    try {
      await deleteLead(leadId);
    } catch (err) {
      console.error(err);
      setLeads(previous);
      alert('Delete failed. Please try again.');
    }
  };

  /** ─ Add lead ─ */
  const handleAddLead = async () => {
    if (newLead.customerName && newLead.phone && newLead.serviceNeeded) {
      const optimistic = {
        id: Number(Date.now()), // temp id for UI
        customerName: newLead.customerName,
        phone: newLead.phone,
        email: newLead.email || '',
        address: newLead.address || '',
        serviceNeeded: newLead.serviceNeeded,
        status: 'new' as StatusValue,
        dateAdded: new Date(),
        appointmentDate: null,
        appointmentTime: '',
        technician: '',
        notes: newLead.notes || '',
        lastUpdated: new Date(),
        lineName: '',
        openphoneUrl: '',
      } as UiLead;

      setLeads(prev => [optimistic, ...prev]);

      try {
        const created = await addLead({
          customer_name: newLead.customerName,
          phone: newLead.phone,
          email: newLead.email || null,
          address: newLead.address || null,
          service_needed: newLead.serviceNeeded,
          status: 'new',
          appointment_date: null,
          appointment_time: null,
          technician: null,
          notes: newLead.notes || null,
        });
        // replace temp with real
        setLeads(prev =>
          prev.map(l => (l.id === optimistic.id ? { ...l, id: created.id } : l)),
        );
      } catch (e) {
        console.error(e);
        // rollback
        setLeads(prev => prev.filter(l => l.id !== optimistic.id));
      }

      setNewLead({
        customerName: '',
        phone: '',
        email: '',
        address: '',
        serviceNeeded: '',
        notes: '',
      });
      setShowAddLead(false);
    }
  };

  /** ─ Analytics (Sold + Canceled counts, Active leads) ─ */
  const analytics = useMemo(() => {
    const todayStr = new Date().toDateString();

    const soldToday = leads.filter(
      l => l.status === 'sold' && new Date(l.lastUpdated).toDateString() === todayStr,
    ).length;

    const canceledToday = leads.filter(
      l =>
        (l.status === 'canceled' || l.status === 'canceled-no-tech') &&
        new Date(l.lastUpdated).toDateString() === todayStr,
    ).length;

    const newToday = leads.filter(
      l => new Date(l.dateAdded).toDateString() === todayStr,
    ).length;

    return {
      newToday,
      soldToday,
      canceledToday,
      activeLeads: getActiveLeadsCount(),
    };
  }, [leads]);

  /** ─ Lead Card ─ */
  const LeadCard: React.FC<{ lead: UiLead }> = ({ lead }) => {
    const statusInfo = getStatusInfo(lead.status);
    const Icon = statusIcon[lead.status] || FlagTriangleRight;
    const hasReminder = needsReminder(lead);

    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 hover:shadow-lg transition-shadow relative">
        {hasReminder && (
          <div className="absolute top-2 right-2" title="Stale lead">
            <Bell className="w-4 h-4 text-red-500 animate-pulse" />
          </div>
        )}

        <div className="space-y-3">
          {/* Header / Actions */}
          <div className="flex items-start justify-between">
            <h3 className="font-semibold text-gray-900 text-lg">{lead.customerName || lead.phone}</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedLead(lead)}
                className="text-gray-400 hover:text-blue-600"
                title="Edit"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteLead(lead.id)}
                className="text-gray-400 hover:text-red-600"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Customer contact */}
          <div>
            <div className="flex items-center space-x-1 text-sm text-gray-600">
              <Phone className="w-3 h-3" />
              <span>{lead.phone}</span>
            </div>
            {lead.email && (
              <div className="flex items-center space-x-1 text-sm text-gray-600">
                <Mail className="w-3 h-3" />
                <span>{lead.email}</span>
              </div>
            )}
          </div>

          {/* Service + line name */}
          <div className="space-y-1">
            <p className="font-medium text-gray-800">{lead.serviceNeeded}</p>
            {lead.lineName && (
              <div className="text-xs text-gray-500">Line: {lead.lineName}</div>
            )}
            {lead.address && (
              <div className="flex items-start space-x-1 text-sm text-gray-600">
                <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span className="line-clamp-2">{lead.address}</span>
              </div>
            )}
          </div>

          {/* Appointment hint */}
          {lead.appointmentDate && (
            <div className="bg-green-50 p-2 rounded">
              <div className="flex items-center space-x-1 text-sm text-green-800">
                <Calendar className="w-3 h-3" />
                <span>{lead.appointmentDate} {lead.appointmentTime ? `at ${lead.appointmentTime}` : ''}</span>
              </div>
              {lead.technician && (
                <div className="flex items-center space-x-1 text-sm text-green-800">
                  <User className="w-3 h-3" />
                  <span>{lead.technician}</span>
                </div>
              )}
            </div>
          )}

          {/* Status + dropdown */}
          <div className="flex items-center justify-between pt-1">
            <div
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color} ${statusInfo.textColor}`}
              title={statusInfo.label}
            >
              <Icon className="w-3 h-3" />
              {statusInfo.label}
            </div>

            <select
              value={lead.status}
              onChange={(e) => handleStatusChange(lead.id, e.target.value as StatusValue)}
              className="px-3 py-1 rounded-full text-sm border-gray-300 text-gray-700"
              title="Change status"
            >
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Time info */}
          <div className="text-xs text-gray-400 flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>Added {new Date(lead.dateAdded).toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  };

  /** ─ Sidebar items (built from statusOptions) ─ */
  const navItems = useMemo(() => {
    const items = [
      { id: 'dashboard', label: 'Dashboard', icon: Home as React.ElementType },
      ...statusOptions.map(s => ({
        id: s.value,
        label: s.label,
        icon: (statusIcon[s.value] || FlagTriangleRight) as React.ElementType,
        count: getLeadsByStatus(s.value).length,
      })),
      { id: 'analytics', label: 'Analytics', icon: BarChart3 as React.ElementType },
    ];
    return items;
  }, [leads]);

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
                {navItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </div>
                        {(item as any).count !== undefined && (item as any).count > 0 && (
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            isActive ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {(item as any).count}
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
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-lg shadow-sm border">
                    <div className="text-2xl font-bold text-blue-600">{analytics.newToday}</div>
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
                  <div className="bg-white p-4 rounded-lg shadow-sm border">
                    <div className="text-2xl font-bold text-orange-600">{analytics.activeLeads}</div>
                    <div className="text-sm text-gray-600">Active Leads</div>
                  </div>
                </div>

                {/* Recent Leads */}
                <div className="bg-white rounded-lg shadow-sm border">
                  <div className="p-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-900">Recent Leads</h2>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {leads.slice(0, 6).map(lead => (
                      <LeadCard key={lead.id} lead={lead} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-6 border-b">
                  <h2 className="text-xl font-semibold text-gray-900">Analytics Dashboard</h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">{analytics.newToday}</div>
                      <div className="text-gray-600">New Leads Today</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">{analytics.soldToday}</div>
                      <div className="text-gray-600">Sold Today</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-600">{analytics.canceledToday}</div>
                      <div className="text-gray-600">Canceled Today</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-orange-600">{analytics.activeLeads}</div>
                      <div className="text-gray-600">Active Leads</div>
                    </div>
                  </div>

                  <div className="mt-8">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Pipeline Overview</h3>
                    <div className="space-y-3">
                      {statusOptions
                        .filter(s => !CLOSED_STATUSES.includes(s.value))
                        .map(s => {
                          const count = getLeadsByStatus(s.value).length;
                          return (
                            <div key={s.value} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                              <span className="font-medium">{s.label}</span>
                              <span className={`px-3 py-1 rounded-full text-white text-sm ${s.color}`}>
                                {count} {count === 1 ? 'lead' : 'leads'}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Status-specific pages */}
            {activeTab !== 'dashboard' && activeTab !== 'analytics' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {statusOptions.find(s => s.value === activeTab as StatusValue)?.label || 'Leads'}
                  </h2>
                  <div className="text-sm text-gray-500">
                    {getLeadsByStatus(activeTab as StatusValue).length} leads
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {getLeadsByStatus(activeTab as StatusValue).map(lead => (
                    <LeadCard key={lead.id} lead={lead} />
                  ))}
                </div>

                {getLeadsByStatus(activeTab as StatusValue).length === 0 && (
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
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
                  placeholder="e.g. HVAC Repair, Plumbing, Electrical"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
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
                  value={newLead.notes}
                  onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                  rows={3}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-screen overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Lead</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={selectedLead.customerName}
                  onChange={(e) => setSelectedLead({ ...selectedLead, customerName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={selectedLead.phone}
                  onChange={(e) => setSelectedLead({ ...selectedLead, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={selectedLead.email}
                  onChange={(e) => setSelectedLead({ ...selectedLead, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Needed</label>
                <input
                  type="text"
                  value={selectedLead.serviceNeeded}
                  onChange={(e) => setSelectedLead({ ...selectedLead, serviceNeeded: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={selectedLead.address}
                  onChange={(e) => setSelectedLead({ ...selectedLead, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Technician is a free-text input (your last change) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Technician</label>
                <input
                  type="text"
                  value={selectedLead.technician || ''}
                  onChange={(e) => setSelectedLead({ ...selectedLead, technician: e.target.value })}
                  placeholder="Type technician name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Appointment Date</label>
                <input
                  type="date"
                  value={selectedLead.appointmentDate || ''}
                  onChange={(e) => setSelectedLead({ ...selectedLead, appointmentDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Appointment Time</label>
                <input
                  type="time"
                  value={selectedLead.appointmentTime}
                  onChange={(e) => setSelectedLead({ ...selectedLead, appointmentTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={selectedLead.notes}
                  onChange={(e) => setSelectedLead({ ...selectedLead, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={selectedLead.status}
                  onChange={(e) => setSelectedLead({ ...selectedLead, status: e.target.value as StatusValue })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  {statusOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* OpenPhone conversation link */}
              {selectedLead.openphoneUrl && (
                <div className="text-sm">
                  <a
                    href={selectedLead.openphoneUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open conversation in OpenPhone
                  </a>
                  {selectedLead.lineName && (
                    <div className="text-gray-500 mt-1">Line: {selectedLead.lineName}</div>
                  )}
                </div>
              )}
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
