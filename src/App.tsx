
import AuthGate from './AuthGate'
import LeadGenCRM from './leadgen-crm-dashboard'

export default function App() {
  return (
    <AuthGate>
      <LeadGenCRM />
    </AuthGate>
  )
}
