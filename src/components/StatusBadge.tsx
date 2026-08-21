import type { Status } from '../types';

export function StatusBadge({ status }: { status: Status }) {
  if (status === 'presente') {
    return (
      <span className="badge-green inline-flex items-center">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
        Presente
      </span>
    );
  }
  return (
    <span className="badge-gray inline-flex items-center">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 mr-1.5" />
      Finalizado
    </span>
  );
}