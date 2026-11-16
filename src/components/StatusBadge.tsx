import type { Status } from '../types';
import { STATUS_LABEL } from '../utils/labels';

const STYLE: Record<Status, { badge: string; dot: string }> = {
  agendado: { badge: 'badge-blue', dot: 'bg-blue-600 dark:bg-blue-400' },
  presente: { badge: 'badge-green', dot: 'bg-emerald-600 dark:bg-emerald-400' },
  finalizado: { badge: 'badge-gray', dot: 'bg-slate-400' },
};

export function StatusBadge({ status }: { status: Status }) {
  const s = STYLE[status];
  return (
    <span className={s.badge}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}
