import { useAuth } from '../lib/auth';

export function DashboardPage() {
  const { user, memberships, activeOrgId } = useAuth();
  const activeOrg = memberships.find((m) => m.orgId === activeOrgId);

  return (
    <div className="stack">
      <div>
        <h1 style={{ margin: 0 }}>Welcome, {user?.name ?? user?.email}</h1>
        <p className="muted" style={{ marginTop: '0.35rem' }}>
          {activeOrg ? `You're in ${activeOrg.orgName} as ${activeOrg.role}.` : 'No workspace yet.'}
        </p>
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Sandbox inboxes</h2>
        <p className="muted" style={{ margin: 0 }}>
          Coming next session — Phase 1. You'll get an SMTP endpoint that catches test emails
          from any app and shows them here.
        </p>
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Sending domains</h2>
        <p className="muted" style={{ margin: 0 }}>
          Coming Phase 2 — verify a domain, we sign with DKIM, you send real mail through the relay.
        </p>
      </div>
    </div>
  );
}
