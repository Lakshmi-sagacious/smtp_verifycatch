import { Link, Outlet } from 'react-router-dom';
import { useAuth } from './lib/auth';

export function Shell() {
  const { user, memberships, activeOrgId, setActiveOrg, logout } = useAuth();
  const activeOrg = memberships.find((m) => m.orgId === activeOrgId);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo">SMTP Platform</div>

        {activeOrg && (
          <div className="org">
            {memberships.length > 1 ? (
              <select
                value={activeOrgId ?? ''}
                onChange={(e) => setActiveOrg(e.target.value)}
                style={{ background: 'transparent', border: 'none', padding: 0, fontSize: '0.9rem' }}
              >
                {memberships.map((m) => (
                  <option key={m.orgId} value={m.orgId}>
                    {m.orgName}
                  </option>
                ))}
              </select>
            ) : (
              <div>{activeOrg.orgName}</div>
            )}
            <small>{activeOrg.role.toLowerCase()}</small>
          </div>
        )}

        <nav>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/logs">Logs</Link>
          <div className="muted" style={{ padding: '0.75rem 0.75rem 0.25rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sandbox</div>
          <Link to="/inboxes">Inboxes</Link>
          <div className="muted" style={{ padding: '0.75rem 0.75rem 0.25rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Relay</div>
          <Link to="/domains">Domains</Link>
          <Link to="/api-keys">API keys</Link>
          <Link to="/smtp-credentials">SMTP credentials</Link>
          <Link to="/webhooks">Webhooks</Link>
        </nav>

        <div className="foot">
          <div>{user?.email}</div>
          <button
            onClick={() => logout()}
            style={{ marginTop: '0.5rem', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
