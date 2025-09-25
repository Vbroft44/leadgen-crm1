import React from 'react';
import ReactDOM from 'react-dom/client';
import LeadGenCRM from './leadgen-crm-dashboard';
import AdminPage from './AdminPage';

const isAdminRoute = () => window.location.pathname.startsWith('/admin');

const rootEl = document.getElementById('root') as HTMLElement;
const root = ReactDOM.createRoot(rootEl);

function renderApp() {
  root.render(
    <React.StrictMode>
      {isAdminRoute() ? <AdminPage /> : <LeadGenCRM />}
    </React.StrictMode>
  );
}

renderApp();

// Re-render if the URL path changes via back/forward
window.addEventListener('popstate', renderApp);
