import type { AuditEntry, Companion, Guest } from '../types';
import { formatAppointmentDisplay } from './cpf.ts';
import { classifyAuditEvent } from './labels.ts';

export type StayGroup = {
  id: string;
  status: 'agendada' | 'em_andamento' | 'finalizada' | 'avulso';
  noShow?: boolean;
  start?: string;
  end?: string;
  durationText?: string;
  procedure?: string;
  hospital?: string;
  appointmentText?: string;
  companions?: Companion[];
  events: AuditEntry[];
};

export function cleanAuditNote(note?: string): string {
  if (!note) return '';
  return note
    .replace(/"true"/gi, '"Sim"')
    .replace(/"false"/gi, '"Não"');
}

export function formatDuration(startDate?: string, endDate?: string): string {
  if (!startDate) return '';
  const start = new Date(startDate).getTime();
  const end = endDate ? new Date(endDate).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return '';

  const diffHours = Math.floor((end - start) / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays === 0) {
    if (diffHours === 0) return 'Menos de 1 hora';
    return `${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  }
  const remainingHours = diffHours % 24;
  if (remainingHours === 0) {
    return `${diffDays} dia${diffDays > 1 ? 's' : ''}`;
  }
  return `${diffDays} dia${diffDays > 1 ? 's' : ''} e ${remainingHours}h`;
}

function extractAppointmentFromNote(note?: string): string | undefined {
  if (!note) return undefined;
  const fullMatch = note.match(/\(Consulta:\s*([^)]+)\)/i);
  if (fullMatch?.[1]) return fullMatch[1].trim();
  const newStayMatch = note.match(/consulta em\s+(\d{2}\/\d{2}\/\d{4})/i);
  if (newStayMatch?.[1]) return newStayMatch[1].trim();
  return undefined;
}

export function organizeStays(guest: Guest | undefined, entries: AuditEntry[]): StayGroup[] {
  if (!guest) return [];

  const sorted = [...entries].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );

  const stays: StayGroup[] = [];
  let currentStay: StayGroup | null = null;
  let stayIndex = 1;

  const createStay = (
    status: StayGroup['status'],
    firstEvent: AuditEntry,
    start?: string
  ): StayGroup => ({
    id: `stay-${stayIndex++}`,
    status,
    start,
    appointmentText: extractAppointmentFromNote(firstEvent.note),
    events: [firstEvent],
  });

  for (const entry of sorted) {
    const ev = classifyAuditEvent(entry);
    const noteLower = (entry.note || '').toLowerCase();

    if (ev.kind === 'edit') {
      if (currentStay) {
        currentStay.events.push(entry);
      } else {
        const fallbackStatus: StayGroup['status'] =
          guest.status === 'presente'
            ? 'em_andamento'
            : guest.status === 'agendado'
              ? 'agendada'
              : 'finalizada';
        currentStay = createStay(fallbackStatus, entry);
      }
      continue;
    }

    if (ev.kind === 'referral') {
      const explicitNew =
        noteLower.includes('novo encaminhamento') ||
        noteLower.includes('nova estadia') ||
        entry.fromStatus === 'finalizado';

      if (currentStay) {
        if (currentStay.status === 'em_andamento' || explicitNew) {
          if (currentStay.status === 'em_andamento' && !currentStay.end) {
            currentStay.end = entry.at;
          }
          currentStay.status = 'finalizada';
          stays.push(currentStay);
          currentStay = createStay(
            entry.toStatus === 'presente' ? 'em_andamento' : 'agendada',
            entry,
            entry.toStatus === 'presente' ? entry.at : undefined
          );
        } else {
          currentStay.status = 'agendada';
          currentStay.appointmentText =
            extractAppointmentFromNote(entry.note) || currentStay.appointmentText;
          currentStay.events.push(entry);
        }
      } else {
        currentStay = createStay(
          entry.toStatus === 'presente' ? 'em_andamento' : 'agendada',
          entry,
          entry.toStatus === 'presente' ? entry.at : undefined
        );
      }
      continue;
    }

    if (ev.kind === 'checkin') {
      if (currentStay && currentStay.status !== 'finalizada') {
        currentStay.status = 'em_andamento';
        if (!currentStay.start) currentStay.start = entry.at;
        currentStay.noShow = false;
        currentStay.events.push(entry);
      } else {
        currentStay = createStay('em_andamento', entry, entry.at);
      }
      continue;
    }

    if (ev.kind === 'undo_checkin') {
      if (currentStay) {
        currentStay.status = 'agendada';
        currentStay.start = undefined;
        currentStay.end = undefined;
        currentStay.noShow = false;
        currentStay.events.push(entry);
      } else {
        currentStay = createStay('agendada', entry);
      }
      continue;
    }

    if (ev.kind === 'checkout' || ev.kind === 'noshow') {
      const isNoShow = ev.kind === 'noshow';
      if (!currentStay) {
        const inferredStart =
          !isNoShow &&
          guest.checkInAt &&
          new Date(guest.checkInAt).getTime() <= new Date(entry.at).getTime()
            ? guest.checkInAt
            : undefined;
        currentStay = createStay('finalizada', entry, inferredStart);
      } else {
        currentStay.status = 'finalizada';
        currentStay.events.push(entry);
      }
      currentStay.end = entry.at;
      currentStay.noShow = isNoShow;
      if (isNoShow) currentStay.start = undefined;
      stays.push(currentStay);
      currentStay = null;
      continue;
    }

    if (ev.kind === 'undo_checkout') {
      if (currentStay) {
        currentStay.status = 'em_andamento';
        currentStay.end = undefined;
        currentStay.noShow = false;
        currentStay.events.push(entry);
      } else if (stays.length > 0) {
        const reopened = stays.pop()!;
        reopened.status = 'em_andamento';
        reopened.end = undefined;
        reopened.noShow = false;
        reopened.durationText = undefined;
        reopened.events.push(entry);
        currentStay = reopened;
      } else {
        const inferredStart =
          guest.checkInAt && new Date(guest.checkInAt).getTime() <= new Date(entry.at).getTime()
            ? guest.checkInAt
            : entry.at;
        currentStay = createStay('em_andamento', entry, inferredStart);
      }
      continue;
    }

    // Fallback for generic/legacy notes
    if (currentStay) {
      if (entry.toStatus === 'presente') {
        currentStay.status = 'em_andamento';
        if (!currentStay.start) currentStay.start = entry.at;
      } else if (entry.toStatus === 'agendado') {
        currentStay.status = 'agendada';
      }
      currentStay.events.push(entry);
    } else {
      const status: StayGroup['status'] =
        entry.toStatus === 'presente'
          ? 'em_andamento'
          : entry.toStatus === 'agendado'
            ? 'agendada'
            : 'finalizada';
      currentStay = createStay(
        status,
        entry,
        status === 'em_andamento' ? entry.at : undefined
      );
    }
  }

  if (currentStay) {
    if (guest.status === 'finalizado') {
      currentStay.status = 'finalizada';
      if (!currentStay.end && guest.checkOutAt) {
        currentStay.end = guest.checkOutAt;
      }
    } else if (guest.status === 'agendado') {
      currentStay.status = 'agendada';
      currentStay.start = undefined;
      currentStay.end = undefined;
    } else if (guest.status === 'presente') {
      currentStay.status = 'em_andamento';
      currentStay.end = undefined;
      if (!currentStay.start && guest.checkInAt) {
        currentStay.start = guest.checkInAt;
      }
    }
    stays.push(currentStay);
  }

  // Fallback when no audit entries exist at all
  if (stays.length === 0 && (guest.checkInAt || guest.status === 'agendado' || guest.status === 'finalizado')) {
    stays.push({
      id: 'stay-current',
      status:
        guest.status === 'agendado'
          ? 'agendada'
          : guest.status === 'presente'
            ? 'em_andamento'
            : 'finalizada',
      start: guest.status === 'agendado' ? undefined : guest.checkInAt,
      end: guest.status === 'finalizado' ? guest.checkOutAt : undefined,
      procedure: guest.reason,
      hospital: guest.medicalNotes,
      appointmentText: formatAppointmentDisplay(guest.appointmentDate, guest.appointmentTime),
      companions: guest.companions,
      events: [
        {
          id: 'initial-checkin',
          guestId: guest.id,
          toStatus: guest.status,
          at: guest.checkInAt || guest.checkOutAt || new Date().toISOString(),
          byUser: 'Sistema',
          note:
            guest.status === 'agendado'
              ? 'Encaminhado pela Secretaria de Saúde (Aguardando chegada)'
              : guest.status === 'presente'
                ? 'Estadia ativa na Casa de Apoio'
                : 'Estadia finalizada',
        },
      ],
    });
  }

  // Enrich the latest stay with current guest metadata & calculate durations cleanly
  const currentAppointment = formatAppointmentDisplay(guest.appointmentDate, guest.appointmentTime);
  stays.forEach((stay, idx) => {
    const isLatest = idx === stays.length - 1;
    if (isLatest) {
      stay.procedure = guest.reason;
      stay.hospital = guest.medicalNotes;
      stay.appointmentText = currentAppointment || stay.appointmentText;
      stay.companions = guest.companions;
    }
    stay.durationText = stay.noShow
      ? 'Não compareceu'
      : formatDuration(stay.start, stay.end);
  });

  return stays.reverse();
}
