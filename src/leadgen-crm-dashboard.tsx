import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import {
  fetchLeads,
  addLead,
  updateLead,
  fetchTechnicians,
  deleteLead,
} from './data';

/**
 * STATUS DEFS
 */
type StatusValue =
  | 'new'
  | 'waiting-more-details'
  | 'waiting-new-tech'
  | 'waiting-customer-response'
  | 'quote-sent-waiting-response'
  | 'free-estimate-scheduled'
  | 'service-diagnostic-scheduled'
  | 'visiting-charges-scheduled'
  | 'in-progress'
  | 'follow-up'
  | 'job-too-small'
  | 'cancelled-no-tech'
  | 'too-expensive'
  | 'reschedule'
  | 'cancelled'
  | 'sold';

const STATUS_ORDER: StatusValue[] = [
  'new',
  'waiting-more-details',
  'waiting-new-tech',
  'waiting-customer-response',
  'quote-sent-waiting-response',
  'free-estimate-scheduled',
  'service-diagnostic-scheduled',
  'visiting-charges-scheduled',
  'in-progress',
  'follow-up',
  'job-too-small',
  'cancelled-no-tech',
  'too-expensive',
  'reschedule',
  'cancelled',
  'sold',
];

const STATUS_META: Record<
  StatusValue,
  { label: string; color: string; textColor: string }
> = {
  new: { label: 'New Lead', color: 'bg-blue-600', textColor: 'text-white' },
  'waiting-more-details': {
    label: 'Waiting for More Details from Customer',
    color: 'bg-indigo-500',
    textColor: 'text-white',
  },
  'waiting-new-tech': {
    label: 'Waiting for New Tech',
    color: 'bg-purple-500',
    textColor: 'text-white',
  },
  'waiting-customer-response': {
    label: 'Waiting for customer response',
    color: 'bg-yellow-500',
    textColor: 'text-white',
  },
  'quote-sent-waiting-response': {
    label: 'Quote Sent / Waiting for customer Response',
    color: 'bg-amber-600',
    textColor: 'text-white',
  },
  'free-estimate-scheduled': {
    label: 'Free Estimate Scheduled',
    color: 'bg-sky-500',
    textColor: 'text-white',
  },
  'service-diagnostic-scheduled': {
    label: 'Service / Diagnostic Call Scheduled',
    color: 'bg-teal-600',
    textColor: 'text-white',
  },
  'visiting-charges-scheduled': {
    label: 'Visiting Charges Scheduled',
    color: 'bg-cyan-600',
    textColor: 'text-white',
  },
  'in-progress': {
    label: 'In Progress',
    color: 'bg-orange-500',
    textColor: 'text-white',
  },
  'follow-up': {
    label: 'Follow Up with customer',
    color: 'bg-violet-600',
    textColor: 'text-white',
  },
  'job-too-small': {
    label: 'Job Too Small',
    color: 'bg-zinc-500',
    textColor: 'text-white',
  },
  'cancelled-no-tech': {
    label: 'Cancelled due to no tech available / show up',
    color: 'bg-rose-500',
    textColor: 'text-white',
  },
  'too-expensive': {
    label: 'Too expensive for customer',
    color: 'bg-stone-500',
    textColor: 'text-white',
  },
  reschedule: {
    label: 'Reschedule',
    color: 'bg-fuchsia-600',
    textColor: 'text-white',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-600',
    textColor: 'text-white',
  },
  sold: {
    label: 'Sold',
    color: 'bg-emerald-600',
    textColor: 'text-white',
  },
};

const LeadGenCRM: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [showAddLead, setShowAddLead] = useState<boolean>(false);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  const [technicians, setTechnicians] = useState<string[]>([]);
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const techs = await fetchTechnicians();
      setTechnicians(techs.map((t: any) => `${t.name} - ${t.trade}`));

      const data = await fetchLeads();
      const mapped = data.map((d: any) => ({
        id: d.id,
        customerName: d.customer_name,
        phone: d.phone || d.phone_e164 || '',
        email: d.email || '',
        address: d.address || '',
        serviceNeeded: d.service_needed,
        status: (d.status || 'new') as StatusValue,
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

  const [newLead, setNewLead] = useState({
    customerName: '',
    phone: '',
    email: '',
    address: '',
    serviceNeeded: '',
    notes: '',
  });

  // helpers
  const getLeadsByStatus = (status: StatusValue) =>
    leads.filter(l => l.status === status);

  const getStatusInfo = (status: StatusValue) => STATUS_META[status];

  const needsReminder = (lead: any) => {
    if (lead.status === 'sold' || lead.status === 'cancelled') return false;
    const hoursOld =
      (new Date().getTime() - new Date(lead.lastUpdated).getTime()) /
      (1000 * 60 * 60);
    return hoursOld > 2;
  };

  const getActiveLeadsCount = () =>
    leads.filter(l => l.status !== 'sold' && l.status !== 'cancelled').length;

  // CRUD
  const handleStatusChange = async (leadId: number, s: StatusValue) => {
    setLeads(prev =>
      prev.map(l =>
        l.id === leadId ? { ...l, status: s, lastUpdated: new Date() } : l
      )
    );
    try {
      await updateLead(leadId, { status: s });
    } catch (e) {
      console.error(e);
    }
  };

  const handleLeadUpdate = async (leadId: number, updates: any) => {
    setLeads(prev =>
      prev.map(l =>
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

  const handleAddLead = async () => {
    if (newLead.customerName && newLead.phone && newLead.serviceNeeded) {
      const leadLocal = {
        ...newLead,
        status: 'new' as StatusValue,
        dateAdded: new Date(),
        lastUpdated: new Date(),
        appointmentDate: null,
        appointmentTime: '',
        technician: '',
      };

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
        (leadLocal as any).id = created.id;
        setLeads(prev => [leadLocal as any, ...prev]);
      } catch (e) {
        console.error(e);
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

  // analytics
  const analytics = (() => {
    const today = new Date().toDateString();
    const todayLeads = leads.filter(
      l => new Date(l.dateAdded).toDateString() === today
    );
    return {
      totalToday: todayLeads.length,
      soldToday: todayLeads.filter(l => l.status === 'sold').length,
      cancelledToday: todayLeads.filter(l => l.status === 'cancelled').length,
      activeLeads: getActiveLeadsCount(),
    };
  })();

  // Lead card
  const LeadCard: React.FC<{ lead: any }> = ({ lead }) => {
    const statusInfo = getStatusInfo(lead.status);
    const remind = needsReminder(lead);

    return (
      <div className="relative rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
        {/* Reminder pulse */}
        {remind && (
          <div className="absolute right-2 top-2">
            <Bell className="h-4 w-4 animate-pulse text-red-500" />
          </div>
        )}

        {/* Top actions */}
        <div className="mb-2 flex items-center justify-end gap-2">
          {lead.openphoneUrl && (
            <a
              href={lead.openphoneUrl}
              target="_blank"
              rel="noreferrer"
              title="Open conversation in OpenPhone"
              className="text-gray-400 transition-colors hover:text-blue-600"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <button
            onClick={() => setSelectedLead(lead)}
            className="text-gray-400 transition-colors hover:text-blue-600"
            title="Edit lead"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDeleteLead(lead.id)}
            className="text-gray-400 transition-colors hover:text-red-600"
            title="Delete lead"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Customer */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">
            {lead.customerName || '—'}
          </h3>
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <Phone className="h-3 w-3" />
            <span>{lead.phone || '—'}</span>
          </div>
          {lead.email && (
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <Mail className="h-3 w-3" />
              <span>{lead.email}</span>
            </div>
          )}
        </div>

        {/* Line name */}
        {lead.lineName && (
          <div className="mt-2 text-xs text-gray-500">
            <span className="font-medium">Line:</span> {lead.lineName}
          </div>
        )}

        {/* Service & Address */}
        <div className="mt-2">
          {lead.serviceNeeded && (
            <p className="font-medium text-gray-800">{lead.serviceNeeded}</p>
          )}
          {lead.address && (
            <div className="mt-1 flex items-start gap-1 text-sm text-gray-600">
              <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
              <span className="line-clamp-2">{lead.address}</span>
            </div>
          )}
        </div>

        {/* Appointment */}
        {lead.appointmentDate && (
          <div className="mt-2 rounded bg-green-50 p-2">
            <div className="flex items-center gap-1 text-sm text-green-800">
              <Calendar className="h-3 w-3" />
              <span>
                {lead.appointmentDate} {lead.appointmentTime && `at ${lead.appointmentTime}`}
              </span>
            </div>
            {lead.technician && (
              <div className="flex items-center gap-1 text-sm text-green-800">
                <User className="h-3 w-3" />
                <span>{lead.technician}</span>
              </div>
            )}
          </div>
        )}

        {lead.notes && (
          <p className="mt-2 line-clamp-2 rounded bg-gray-50 p-2 text-sm text-gray-600">
            {lead.notes}
          </p>
        )}

        {/* Status + time */}
        <div className="mt-3 flex items-center justify-between">
          <select
            value={lead.status}
            onChange={e => handleStatusChange(lead.id, e.target.value as StatusValue)}
            className={`w-40 max-w-full cursor-pointer rounded-full px-3 py-1 text-xs font-medium ${statusInfo.color} ${statusInfo.textColor} border-none`}
            title={STATUS_META[lead.status].label}
          >
            {STATUS_ORDER.map(s => (
              <option key={s} value={s} className="text-gray-900">
                {STATUS_META[s].label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="h-3 w-3" />
            <span>Added {new Date(lead.dateAdded).toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  };

  // nav items
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    ...STATUS_ORDER.map(s => ({
      id: s,
      label: STATUS_META[s].label,
      icon:
        s === 'new'
          ? AlertCircle
          : s === 'in-progress'
          ? Users
          : s === 'sold'
          ? CheckCircle
          : s === 'cancelled'
          ? XCircle
          : Calendar,
      count: getLeadsByStatus(s).length,
    })),
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                <Phone className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Lead Generation CRM</h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Bell className="h-4 w-4" />
                <span>{leads.filter(needsReminder).length} reminders</span>
              </div>
              <button
                onClick={() => setShowAddLead(true)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                <span>Add Lead</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <nav className="rounded-lg border bg-white p-4 shadow-sm">
              <ul className="space-y-2">
                {navItems.map(item => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => setActiveTab(item.id)}
                        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                          active
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          {/* single-line, clipped label */}
                          <span className="truncate">
                            {item.label}
                          </span>
                        </span>
                        {'count' in item && item.count > 0 && (
                          <span
                            className={`ml-2 shrink-0 rounded-full px-2 py-1 text-xs ${
                              active
                                ? 'bg-blue-200 text-blue-800'
                                : 'bg-gray-200 text-gray-700'
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
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div className="rounded-lg border bg-white p-4 shadow-sm">
                    <div className="text-2xl font-bold text-blue-600">
                      {analytics.totalToday}
                    </div>
                    <div className="text-sm text-gray-600">New Today</div>
                  </div>
                  <div className="rounded-lg border bg-white p-4 shadow-sm">
                    <div className="text-2xl font-bold text-emerald-600">
                      {analytics.soldToday}
                    </div>
                    <div className="text-sm text-gray-600">Sold Today</div>
                  </div>
                  <div className="rounded-lg border bg-white p-4 shadow-sm">
                    <div className="text-2xl font-bold text-red-600">
                      {analytics.cancelledToday}
                    </div>
                    <div className="text-sm text-gray-600">Canceled Today</div>
                  </div>
                  <div className="rounded-lg border bg-white p-4 shadow-sm">
                    <div className="text-2xl font-bold text-orange-600">
                      {analytics.activeLeads}
                    </div>
                    <div className="text-sm text-gray-600">Active Leads</div>
                  </div>
                </div>

                {/* Recent */}
                <div className="rounded-lg border bg-white shadow-sm">
                  <div className="border-b p-4">
                    <h2 className="text-lg font-semibold text-gray-900">Recent Leads</h2>
                  </div>
                  <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
                    {leads.slice(0, 6).map(lead => (
                      <LeadCard key={lead.id} lead={lead} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Analytics */}
            {activeTab === 'analytics' && (
              <div className="rounded-lg border bg-white shadow-sm">
                <div className="border-b p-6">
                  <h2 className="text-xl font-semibold text-gray-900">Analytics Dashboard</h2>
                </div>

                <div className="space-y-8 p-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">
                        {analytics.totalToday}
                      </div>
                      <div className="text-gray-600">New Leads Today</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-emerald-600">
                        {analytics.soldToday}
                      </div>
                      <div className="text-gray-600">Sold Today</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-600">
                        {analytics.cancelledToday}
                      </div>
                      <div className="text-gray-600">Canceled Today</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-orange-600">
                        {analytics.activeLeads}
                      </div>
                      <div className="text-gray-600">Active Leads</div>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-4 text-lg font-medium text-gray-900">Pipeline Overview</h3>
                    <div className="space-y-3">
                      {STATUS_ORDER.map(s => {
                        const count = getLeadsByStatus(s).length;
                        const meta = STATUS_META[s];
                        return (
                          <div
                            key={s}
                            className="flex items-center justify-between rounded bg-gray-50 p-3"
                          >
                            <span className="truncate">{meta.label}</span>
                            <span
                              className={`rounded-full px-3 py-1 text-sm text-white ${meta.color}`}
                            >
                              {count} leads
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Status pages */}
            {activeTab !== 'dashboard' && activeTab !== 'analytics' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="truncate text-2xl font-bold text-gray-900">
                    {STATUS_META[activeTab as StatusValue]?.label || 'Leads'}
                  </h2>
                  <div className="text-sm text-gray-500">
                    {getLeadsByStatus(activeTab as StatusValue).length} leads
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {getLeadsByStatus(activeTab as StatusValue).map(lead => (
                    <LeadCard key={lead.id} lead={lead} />
                  ))}
                </div>

                {getLeadsByStatus(activeTab as StatusValue).length === 0 && (
                  <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
                    <div className="mb-4 text-gray-400">
                      <AlertCircle className="mx-auto h-12 w-12" />
                    </div>
                    <h3 className="mb-2 text-lg font-medium text-gray-900">No leads found</h3>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Add New Lead</h3>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={newLead.customerName}
                  onChange={e =>
                    setNewLead(prev => ({ ...prev, customerName: e.target.value }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Phone *
                </label>
                <input
                  type="tel"
                  value={newLead.phone}
                  onChange={e =>
                    setNewLead(prev => ({ ...prev, phone: e.target.value }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  value={newLead.email}
                  onChange={e =>
                    setNewLead(prev => ({ ...prev, email: e.target.value }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Service Needed *
                </label>
                <input
                  type="text"
                  value={newLead.serviceNeeded}
                  onChange={e =>
                    setNewLead(prev => ({
                      ...prev,
                      serviceNeeded: e.target.value,
                    }))
                  }
                  placeholder="e.g. HVAC Repair, Plumbing, Electrical"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Address
                </label>
                <input
                  type="text"
                  value={newLead.address}
                  onChange={e =>
                    setNewLead(prev => ({ ...prev, address: e.target.value }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={newLead.notes}
                  onChange={e =>
                    setNewLead(prev => ({ ...prev, notes: e.target.value }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowAddLead(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddLead}
                className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Add Lead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-screen w-full max-w-md overflow-y-auto rounded-lg bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Edit Lead</h3>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={selectedLead.customerName || ''}
                  onChange={e =>
                    setSelectedLead((prev: any) => ({
                      ...prev,
                      customerName: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Phone
                </label>
                <input
                  type="tel"
                  value={selectedLead.phone || ''}
                  onChange={e =>
                    setSelectedLead((prev: any) => ({
                      ...prev,
                      phone: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  value={selectedLead.email || ''}
                  onChange={e =>
                    setSelectedLead((prev: any) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Service Needed
                </label>
                <input
                  type="text"
                  value={selectedLead.serviceNeeded || ''}
                  onChange={e =>
                    setSelectedLead((prev: any) => ({
                      ...prev,
                      serviceNeeded: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Address
                </label>
                <input
                  type="text"
                  value={selectedLead.address || ''}
                  onChange={e =>
                    setSelectedLead((prev: any) => ({
                      ...prev,
                      address: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* Manual technician text input */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Technician
                </label>
                <input
                  type="text"
                  value={selectedLead.technician || ''}
                  onChange={e =>
                    setSelectedLead((prev: any) => ({
                      ...prev,
                      technician: e.target.value,
                    }))
                  }
                  placeholder="Type technician name"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Appointment Date
                </label>
                <input
                  type="date"
                  value={selectedLead.appointmentDate || ''}
                  onChange={e =>
                    setSelectedLead((prev: any) => ({
                      ...prev,
                      appointmentDate: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Appointment Time
                </label>
                <input
                  type="time"
                  value={selectedLead.appointmentTime || ''}
                  onChange={e =>
                    setSelectedLead((prev: any) => ({
                      ...prev,
                      appointmentTime: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={selectedLead.notes || ''}
                  onChange={e =>
                    setSelectedLead((prev: any) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  value={selectedLead.status}
                  onChange={e =>
                    setSelectedLead((prev: any) => ({
                      ...prev,
                      status: e.target.value as StatusValue,
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                >
                  {STATUS_ORDER.map(s => (
                    <option key={s} value={s}>
                      {STATUS_META[s].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setSelectedLead(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleLeadUpdate(selectedLead.id, selectedLead)}
                className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
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
