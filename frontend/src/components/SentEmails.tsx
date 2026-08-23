'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { ActivityEmail } from '@/types/dashboard';

export function SentEmails() {
  const [emails, setEmails] = useState<ActivityEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setEmails(await api.emails('sent'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load sent emails');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => void load());
    const timer = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(timer);
  }, []);

  return <section className="scheduled-view">
    <div className="view-heading">
      <div><p className="kicker">Delivery history</p><h2>Sent emails</h2><p className="subtitle">Successful and failed delivery attempts from your campaigns.</p></div>
      <span className="view-count">{loading ? 'Loading...' : `${emails.length} records`}</span>
    </div>
    {error ? <div className="error-banner"><span>{error}</span><button onClick={() => void load()}>Retry</button></div> : loading ? <div className="scheduled-table"><div className="table-skeleton" /><div className="table-skeleton" /><div className="table-skeleton" /></div> : emails.length === 0 ? <div className="scheduled-empty"><span>↗</span><h3>No sent emails</h3><p>Completed delivery attempts will appear here.</p></div> : <div className="scheduled-table"><div className="scheduled-row scheduled-header"><span>Recipient</span><span>Subject</span><span>Sent time</span><span>Status</span></div>{emails.map(email => <div className="scheduled-row" key={email.id}><div className="recipient-cell"><span className="activity-avatar">{email.recipient.charAt(0).toUpperCase()}</span><strong>{email.recipient}</strong></div><span>{email.campaign.subject}</span><time>{new Date(email.sentAt ?? email.failedAt ?? email.scheduledTime).toLocaleString()}</time><span className={`status ${email.status}`}><i />{email.status === 'sent' ? 'Delivered' : email.status}</span></div>)}</div>}
  </section>;
}
