export type User = { name: string; email: string; avatarUrl?: string | null };
export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed';
export type ActivityEmail = { id: string; recipient: string; scheduledTime: string; sentAt?: string | null; failedAt?: string | null; status: EmailStatus; campaign: { subject: string } };
export type CampaignSummary = { id: string; subject: string; createdAt: string; _count: { emails: number }; emails: { status: EmailStatus; scheduledTime: string }[] };
export type DashboardData = { metrics: { queued: number; sentToday: number; sent: number; failed: number; deliveryRate: number }; queue: { queued: number; processing: number; completed: number; failed: number }; activity: ActivityEmail[]; campaigns: CampaignSummary[]; volumeByDay: { date: string; label: string; sent: number; planned: number }[] };
