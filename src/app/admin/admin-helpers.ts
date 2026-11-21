import { AdminVoter } from '../core/models';

/** يبحث في أسماء الناخبين مع تجاهل المسافات الزائدة حول البحث. */
export function filterVoters(voters: AdminVoter[], query: string): AdminVoter[] {
  const needle = query.trim();
  if (!needle) return voters;
  return voters.filter((voter) => voter.full_name.includes(needle) || voter.channel === needle);
}

/** تسمية عربية لقناة التصويت. */
export function channelLabel(channel: 'qr' | 'tablet'): string {
  return channel === 'qr' ? 'الهاتف' : 'الطاولة';
}

/** تنسيق التاريخ بصيغة عربية قصيرة. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('ar', { dateStyle: 'short', timeStyle: 'short' });
}
