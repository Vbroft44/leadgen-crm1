import React, { useEffect, useMemo, useState } from 'react';

type Line = {
  op_line_id: string;
  phone_e164: string | null;
  display_name: string | null;
  status: 'active' | 'inactive';
  is_enabled_for_crm: boolean;
  last_seen_at: string | null;
};

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState('');

  async function checkAuth() {
    const r = await fetch('/api/admin-me');
    setAuthed(r.ok);
    if (r.ok) await loadLines();
  }

  useEffect(() => { checkAuth(); }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const r = await fetch('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    setLoading(false);
    if (r.ok) {
      setPassword('');
      setAuthed(true);
      await loadLines();
    } else {
      alert('Wrong passcode');
    }
  }

  async function logout() {
    await fetch('/api/admin-logout');
    setAuthed(false);
    setLines([]);
  }

  async function loadLines() {
    const r = await fetch('/api/admin-lines-list');
    if (!r.ok) return alert('Failed to load lines');
    const j = await r.json();
    setLines(j.lines || []);
  }

  async function toggle(line: Line, enabled: boolean) {
    const prev = [...lines];
    setLines(ls => ls.map(l => l.op_line_id === line.op_line_id ? { ...l, is_enabled_for_crm: enabled } : l));
    const r = await fetch('/api/admin-lines-toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op_line_id: line.op_line_id, enabled })
    });
    if (!r.ok) {
      setLines(prev);
      alert('Failed to update toggle');
    }
  }

  async function syncNow() {
    setLoading(true);
    const r = await fetch('/api/admin-sync-lines');
    setLoading(false);
    if (!r.ok) {
      const t = await r.text();
      alert('Sync failed: ' + t);
    } else {
      await loadLines();
      alert('Synced numbers');
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter(l =>
      (l.display_name || '').toLowerCase().includes(q) ||
      (l.phone_e164 || '').toLowerCase().includes(q) ||
      (l.op_line_id || '').toLowerCase().includes(q)
    );
  }, [lines, query]);

  // --- Login screen ---
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white w-full max-w-sm p-6 rounded-xl shadow border">
          <h1 className="text-xl font-semibold mb-2">Admin Login</h1>
          <p className="text-gray-500 mb-4">Enter the passcode to manage lines.</p>
          <form onSubmit={login} className="space-y-3">
            <input
              type="password"
              className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Passcode"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Admin page ---
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Admin · Numbers</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={syncNow}
              disabled={loading}
              className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Syncing…' : 'Sync from OpenPhone'}
            </button>
            <button
              onClick={logout}
              className="px-3 py-1.5 rounded-md border hover:bg-gray-50"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-3 flex items-center gap-2">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name / phone / id"
            className="w-80 px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
          <span className="text-sm text-gray-500">
            {filtered.length} of {lines.length}
          </span>
        </div>

        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-3 py-2">Display Name</th>
                <th className="text-left px-3 py-2">Phone</th>
                <th className="text-left px-3 py-2">Line ID</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Enabled for CRM</th>
                <th className="text-left px-3 py-2">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.op_line_id} className="border-t">
                  <td className="px-3 py-2">{l.display_name || <span className="text-gray-400">—</span>}</td>
                  <td className="px-3 py-2">{l.phone_e164 || <span className="text-gray-400">—</span>}</td>
                  <td className="px-3 py-2 text-gray-500">{l.op_line_id}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${l.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={l.is_enabled_for_crm}
                        onChange={e => toggle(l, e.target.checked)}
                      />
                      <span>{l.is_enabled_for_crm ? 'Enabled' : 'Disabled'}</span>
                    </label>
                  </td>
                  <td className="px-3 py-2 text-gray-500">{l.last_seen_at ? new Date(l.last_seen_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500">No numbers found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          New numbers default to <b>Disabled</b> so they can’t create leads until you enable them.
        </p>
      </main>
    </div>
  );
}
