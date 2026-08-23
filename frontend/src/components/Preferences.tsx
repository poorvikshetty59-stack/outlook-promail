'use client';

import { useEffect, useState } from 'react';
import type { User } from '@/types/dashboard';

type PreferencesState = { refreshSeconds: string; timezone: string; appearance: 'system' | 'light' | 'dark'; emailNotifications: boolean };
const defaults: PreferencesState = { refreshSeconds: '10', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, appearance: 'system', emailNotifications: true };
const storageKey = 'promail-preferences';

function applyAppearance(appearance: PreferencesState['appearance']) {
  const dark = appearance === 'dark' || (appearance === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function Preferences({ user }: { user: User }) {
  const [values, setValues] = useState<PreferencesState>(defaults);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) { applyAppearance(defaults.appearance); return; }
      try { const next = { ...defaults, ...JSON.parse(stored) as Partial<PreferencesState> }; setValues(next); applyAppearance(next.appearance); } catch { window.localStorage.removeItem(storageKey); applyAppearance(defaults.appearance); }
    });
  }, []);

  function update<K extends keyof PreferencesState>(key: K, value: PreferencesState[K]) {
    setSaved(false);
    setValues(current => ({ ...current, [key]: value }));
    if (key === 'appearance') applyAppearance(value as PreferencesState['appearance']);
  }

  function save() {
    window.localStorage.setItem(storageKey, JSON.stringify(values));
    applyAppearance(values.appearance);
    window.dispatchEvent(new Event('promail-preferences-changed'));
    setSaved(true);
  }

  function reset() { setValues(defaults); window.localStorage.setItem(storageKey, JSON.stringify(defaults)); applyAppearance(defaults.appearance); window.dispatchEvent(new Event('promail-preferences-changed')); setSaved(true); }

  return <section className="preferences-view">
    <div className="view-heading"><div><p className="kicker">Workspace controls</p><h2>Preferences</h2><p className="subtitle">Adjust how Promail looks and keeps you informed.</p></div><div className="preference-actions"><button type="button" className="button-secondary" onClick={reset}>Reset</button><button type="button" className="button-primary" onClick={save}>Save changes</button></div></div>
    {saved && <div className="save-confirmation">Preferences saved on this device.</div>}
    <div className="preferences-grid">
      <section className="preference-card"><div className="preference-card-heading"><div><p className="kicker">Account</p><h3>Profile</h3></div><span className="preference-symbol">◉</span></div><div className="profile-preference"><div className="profile-large">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user.name.charAt(0)}</div><div><strong>{user.name}</strong><span>{user.email}</span><small>Managed through Google</small></div></div></section>
      <section className="preference-card"><div className="preference-card-heading"><div><p className="kicker">Dashboard</p><h3>Display & refresh</h3></div><span className="preference-symbol">◌</span></div><label>Refresh interval<select value={values.refreshSeconds} onChange={event => update('refreshSeconds', event.target.value)}><option value="5">Every 5 seconds</option><option value="10">Every 10 seconds</option><option value="30">Every 30 seconds</option><option value="60">Every minute</option></select></label><label>Timezone<select value={values.timezone} onChange={event => update('timezone', event.target.value)}><option value={values.timezone}>{values.timezone}</option><option value="UTC">UTC</option><option value="America/New_York">Eastern Time</option><option value="America/Los_Angeles">Pacific Time</option><option value="Europe/London">London</option><option value="Asia/Kolkata">India Standard Time</option></select></label><label>Appearance<div className="segmented"><button className={values.appearance === 'system' ? 'selected' : ''} onClick={() => update('appearance', 'system')} type="button">System</button><button className={values.appearance === 'light' ? 'selected' : ''} onClick={() => update('appearance', 'light')} type="button">Light</button><button className={values.appearance === 'dark' ? 'selected' : ''} onClick={() => update('appearance', 'dark')} type="button">Dark</button></div></label></section>
      <section className="preference-card"><div className="preference-card-heading"><div><p className="kicker">Notifications</p><h3>Email updates</h3></div><span className="preference-symbol">✦</span></div><div className="toggle-row"><div><strong>Delivery updates</strong><span>Keep delivery results visible in your workspace.</span></div><button type="button" role="switch" aria-checked={values.emailNotifications} className={`toggle ${values.emailNotifications ? 'on' : ''}`} onClick={() => update('emailNotifications', !values.emailNotifications)}><i /></button></div></section>
    </div>
  </section>;
}
