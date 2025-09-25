import React from 'react';
import ReactDOM from 'react-dom/client';

// IMPORTANT: keep your styles!
import './index.css';

import LeadGenCRM from './leadgen-crm-dashboard';
import AdminPage from './AdminPage';

// Use hash-based routing so we don't need server rewrites
const isAdminRoute = () => window.location.hash.startsWith('#/admin');

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

function render() {
  root.render(
    <React.StrictMode>
      {isAdminRoute() ? <AdminPage /> : <LeadGenCRM />}
    </React.StrictMode>
  );
}

render();

// Re-render when URL changes (back/forward or hash update)
window.addEventListener('hashchange', render);
window.addEventListener('popstate', render);
