import { Link, Outlet } from 'react-router-dom';
import { useAuth } from './lib/auth';

export function Shell() {
  const { user, memberships, activeOrgId, setActiveOrg, logout } = useAuth();
  const activeOrg = memberships.find((m) => m.orgId === activeOrgId);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo">
          <span>
            Verif<span className="brand-y">y</span>Cat<span className="brand-c">c</span>h
          </span>
          <small>SMTP</small>
        </div>

        {activeOrg && (
          <div className="org">
            {memberships.length > 1 ? (
              <select
                value={activeOrgId ?? ''}
                onChange={(e) => setActiveOrg(e.target.value)}
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
          <div
            className="muted"
            style={{
              padding: '0.85rem 0.85rem 0.3rem',
              fontSize: '0.68rem',
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              fontWeight: 700,
            }}
          >
            Sandbox
          </div>
          <Link to="/inboxes">Inboxes</Link>
          <div
            className="muted"
            style={{
              padding: '0.85rem 0.85rem 0.3rem',
              fontSize: '0.68rem',
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              fontWeight: 700,
            }}
          >
            Relay
          </div>
          <Link to="/domains">Domains</Link>
          <Link to="/send-test">Send test</Link>
          <Link to="/api-keys">API keys</Link>
          <Link to="/smtp-credentials">SMTP credentials</Link>
          <Link to="/webhooks">Webhooks</Link>
        </nav>

        <div className="foot">
          <div>{user?.email}</div>
          <button
            onClick={() => logout()}
            style={{ marginTop: '0.6rem', padding: '0.4rem 0.85rem', fontSize: '0.82rem', width: '100%' }}
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
