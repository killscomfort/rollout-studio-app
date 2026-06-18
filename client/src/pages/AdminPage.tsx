import { useEffect, useState } from "react";
import { fetchAdminStats } from "../data/supabase-store";
import { isAdminEmail } from "../lib/admin-access";
import { getSession } from "../lib/supabase";

interface AdminUserRow {
  email: string;
  last_platform: string;
  last_seen_at: string;
  profile_created: string;
  projects: number;
  tasks_completed: number;
  events_7d: number;
}

interface AdminEventRow {
  event: string;
  total: number;
}

interface AdminPageProps {
  onBack: () => void;
}

export function AdminPage({ onBack }: AdminPageProps) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [events, setEvents] = useState<AdminEventRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const session = await getSession();
        const email = session?.user.email ?? null;
        if (!isAdminEmail(email)) {
          setAuthorized(false);
          return;
        }

        setAuthorized(true);
        const stats = await fetchAdminStats();
        setUsers(stats.users);
        setEvents(stats.events);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load admin stats");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="empty-state">Loading admin…</div>;
  }

  if (!authorized) {
    return (
      <div className="panel-card">
        <h1 className="page-title">Admin</h1>
        <p className="page-subtitle">This page is restricted to the site owner.</p>
        <div className="toolbar">
          <button type="button" className="button" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin</h1>
          <p className="page-subtitle">Cloud user activity (latest 50 users)</p>
        </div>
        <button type="button" className="button" onClick={onBack}>
          Back to projects
        </button>
      </div>

      {error ? <div className="callout">{error}</div> : null}

      <div className="panel-card" style={{ marginBottom: 20 }}>
        <h2 className="section-title">Users</h2>
        {users.length === 0 ? (
          <p className="page-subtitle">No users yet.</p>
        ) : (
          <div className="task-table-wrap">
            <table className="task-table growth-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Platform</th>
                  <th>Last seen</th>
                  <th>Projects</th>
                  <th>Tasks done</th>
                  <th>Events (7d)</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <tr key={row.email}>
                    <td>{row.email}</td>
                    <td>{row.last_platform}</td>
                    <td>{new Date(row.last_seen_at).toLocaleString()}</td>
                    <td>{row.projects}</td>
                    <td>{row.tasks_completed}</td>
                    <td>{row.events_7d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel-card">
        <h2 className="section-title">Events (last 30 days)</h2>
        {events.length === 0 ? (
          <p className="page-subtitle">No events logged yet.</p>
        ) : (
          <div className="task-table-wrap">
            <table className="task-table growth-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {events.map((row) => (
                  <tr key={row.event}>
                    <td>{row.event}</td>
                    <td>{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
