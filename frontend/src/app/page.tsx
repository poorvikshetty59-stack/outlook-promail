'use client';

import { useEffect, useState } from 'react';
import { ComposeModal } from '@/components/ComposeModal';
import {
  QueueStatus,
  SendingOverview,
  StatCard
} from '@/components/DashboardParts';
import { Logo } from '@/components/Logo';
import { ScheduledEmails } from '@/components/ScheduledEmails';
import { SentEmails } from '@/components/SentEmails';
import { Preferences } from '@/components/Preferences';
import { API, api } from '@/lib/api';
import type { DashboardData, User } from '@/types/dashboard';

type View = 'dashboard' | 'scheduled' | 'sent' | 'preferences';

const navigation = [
  { label: 'Dashboard', icon: '⌂', view: 'dashboard' as View },
  { label: 'Scheduled', icon: '◷', view: 'scheduled' as View },
  { label: 'Sent', icon: '↗', view: 'sent' as View },
  { label: 'Preferences', icon: '⚙', view: 'preferences' as View }
];

function applyTheme() {
  const stored = window.localStorage.getItem('promail-preferences');

  let appearance = 'system';

  try {
    appearance =
      (JSON.parse(stored ?? '{}') as { appearance?: string }).appearance ??
      'system';
  } catch {
    appearance = 'system';
  }

  const dark =
    appearance === 'dark' ||
    (appearance === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

function Login() {
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const script = document.createElement('script');

    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;

    script.onload = () => {
      const google = (
        window as unknown as {
          google?: {
            accounts: {
              id: {
                initialize: (options: object) => void;
                renderButton: (
                  element: HTMLElement,
                  options: object
                ) => void;
              };
            };
          };
        }
      ).google;

      const target = document.getElementById('google-button');

      if (!google || !target) {
        console.error('Google Identity Services failed to load.');
        return;
      }

      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

      if (!clientId) {
        console.error(
          'NEXT_PUBLIC_GOOGLE_CLIENT_ID is missing.'
        );
        setLoginError(
          'Google login is not configured. Please check the frontend environment variables.'
        );
        return;
      }

      google.accounts.id.initialize({
        client_id: clientId,

        callback: async (response: { credential: string }) => {
          try {
            setLoginError('');

            console.log('Google credential received.');

            const result = await fetch(`${API}/auth/google`, {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                credential: response.credential
              })
            });

            console.log(
              'Google authentication response:',
              result.status
            );

            if (!result.ok) {
              const errorText = await result.text();

              console.error(
                'Google authentication failed:',
                result.status,
                errorText
              );

              setLoginError(
                `Google authentication failed (${result.status}). Please try again.`
              );

              return;
            }

            console.log(
              'Google authentication successful.'
            );

            window.location.reload();
          } catch (error) {
            console.error(
              'Google authentication request failed:',
              error
            );

            setLoginError(
              'Unable to connect to the backend. Please try again.'
            );
          }
        }
      });

      google.accounts.id.renderButton(target, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        width: 280
      });
    };

    script.onerror = () => {
      console.error(
        'Unable to load Google Identity Services.'
      );

      setLoginError(
        'Unable to load Google login. Please refresh the page.'
      );
    };

    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return (
    <main className="login-page">
      <div className="login-copy">
        <Logo />

        <div className="login-message">
          <p className="kicker">
            Personal outreach, simplified
          </p>

          <h1>
            Send with
            <br />
            <em>intention.</em>
          </h1>

          <p>
            Promail gives every campaign a clear path
            from draft to delivery.
          </p>
        </div>
      </div>

      <div className="login-card">
        <div className="login-card-inner">
          <div className="login-symbol">@</div>

          <p className="kicker">Welcome back</p>

          <h2>Sign in to Promail</h2>

          <p className="login-muted">
            Use your Google account to continue to your
            workspace.
          </p>

          {loginError && (
            <div className="error-banner">
              <span>{loginError}</span>
            </div>
          )}

          <div
            id="google-button"
            className="google-button"
          />
        </div>
      </div>
    </main>
  );
}

function Sidebar({
  view,
  onViewChange
}: {
  view: View;
  onViewChange: (nextView: View) => void;
}) {
  return (
    <aside className="sidebar">
      <Logo />

      <nav className="side-nav">
        {navigation.map((item) => (
          <button
            type="button"
            className={`side-link ${
              view === item.view ? 'active' : ''
            }`}
            key={item.label}
            onClick={() =>
              onViewChange(item.view)
            }
          >
            <span className="side-icon">
              {item.icon}
            </span>

            {item.label}
          </button>
        ))}
      </nav>

      <div className="side-footer">
        <div className="help-card">
          <span>?</span>

          <div>
            <strong>Need a hand?</strong>
            <small>Read the quick guide</small>
          </div>
        </div>

        <p>
          Promail <span>•</span> v1.0
        </p>
      </div>
    </aside>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="stats-grid">
        {[1, 2, 3].map((item) => (
          <div
            className="skeleton stat-skeleton"
            key={item}
          />
        ))}
      </div>

      <div className="dashboard-grid">
        <div className="skeleton content-skeleton" />
        <div className="skeleton content-skeleton" />
      </div>
    </>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [dashboard, setDashboard] =
    useState<DashboardData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [compose, setCompose] = useState(false);

  const [view, setView] =
    useState<View>('dashboard');

  const [refreshSeconds, setRefreshSeconds] =
    useState(10);

  useEffect(() => {
    applyTheme();

    const handlePreferencesChanged = () =>
      applyTheme();

    window.addEventListener(
      'promail-preferences-changed',
      handlePreferencesChanged
    );

    return () => {
      window.removeEventListener(
        'promail-preferences-changed',
        handlePreferencesChanged
      );
    };
  }, []);

  async function loadDashboard() {
    setError('');

    try {
      setDashboard(await api.dashboard());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to load dashboard'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!user) return;

    const readRefresh = () => {
      try {
        const stored = JSON.parse(
          window.localStorage.getItem(
            'promail-preferences'
          ) ?? '{}'
        ) as {
          refreshSeconds?: string;
        };

        setRefreshSeconds(
          Number(stored.refreshSeconds) || 10
        );
      } catch {
        setRefreshSeconds(10);
      }
    };

    readRefresh();

    window.addEventListener(
      'promail-preferences-changed',
      readRefresh
    );

    return () => {
      window.removeEventListener(
        'promail-preferences-changed',
        readRefresh
      );
    };
  }, [user]);

  useEffect(() => {
    if (!user || view !== 'dashboard') return;

    queueMicrotask(() => void loadDashboard());

    const timer = window.setInterval(
      () => void loadDashboard(),
      refreshSeconds * 1000
    );

    return () => {
      window.clearInterval(timer);
    };
  }, [
    user,
    view,
    refreshSeconds
  ]);

  if (!user) {
    return <Login />;
  }

  return (
    <main className="app-shell">
      <Sidebar
        view={view}
        onViewChange={setView}
      />

      <section className="main-content">
        <header className="topbar">
          <div className="mobile-brand">
            <Logo compact />
          </div>

          <div className="breadcrumbs">
            <span>Workspace</span>
            <b>/</b>

            <strong>
              {view === 'scheduled'
                ? 'Scheduled emails'
                : view === 'sent'
                ? 'Sent emails'
                : view === 'preferences'
                ? 'Preferences'
                : 'Dashboard'}
            </strong>
          </div>

          <div className="user-menu">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
              />
            ) : (
              <span className="avatar-fallback">
                {user.name.charAt(0)}
              </span>
            )}

            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>

            <button
              aria-label="Log out"
              onClick={async () => {
                try {
                  await api.logout();
                  window.location.replace('/');
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : 'Unable to log out');
                }
              }}
            >
              ↪
            </button>
          </div>
        </header>

        <div className="page-body">
          {view === 'scheduled' ? (
            <ScheduledEmails />
          ) : view === 'sent' ? (
            <SentEmails />
          ) : view === 'preferences' ? (
            <Preferences user={user} />
          ) : (
            <>
              <div className="page-title">
                <div>
                  <p className="kicker">
                    Workspace overview
                  </p>

                  <h1>Dashboard</h1>

                  <p className="subtitle">
                    A clear view of everything moving
                    through Promail.
                  </p>
                </div>

                <button
                  className="button-primary"
                  onClick={() =>
                    setCompose(true)
                  }
                >
                  ＋ Compose email
                </button>
              </div>

              {error ? (
                <div className="error-banner">
                  <span>{error}</span>

                  <button
                    onClick={() => {
                      setLoading(true);
                      void loadDashboard();
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : loading || !dashboard ? (
                <DashboardSkeleton />
              ) : (
                <>
                  <div className="stats-grid">
                    <StatCard
                      kind="queue"
                      label="Queued emails"
                      value={dashboard.metrics.queued.toLocaleString()}
                      detail="Waiting to be sent"
                    />

                    <StatCard
                      kind="sent"
                      label="Emails sent today"
                      value={dashboard.metrics.sentToday.toLocaleString()}
                      detail="Successful sends since midnight"
                    />

                    <StatCard
                      kind="rate"
                      label="Delivery rate"
                      value={`${dashboard.metrics.deliveryRate}%`}
                      detail={`${dashboard.metrics.sent} sent / ${
                        dashboard.metrics.sent +
                        dashboard.metrics.failed
                      } attempted`}
                      progress={
                        dashboard.metrics.deliveryRate
                      }
                    />
                  </div>

                  <div className="dashboard-grid">
                    <SendingOverview
                      volume={
                        dashboard.volumeByDay
                      }
                      queuedFallback={
                        dashboard.queue.queued
                      }
                    />

                    <QueueStatus
                      queue={dashboard.queue}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>

      {compose && (
        <ComposeModal
          onClose={() => setCompose(false)}
          onCreated={() =>
            void loadDashboard()
          }
        />
      )}
    </main>
  );
}