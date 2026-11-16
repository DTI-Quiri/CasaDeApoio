/* eslint-disable react-refresh/only-export-components */
import type { Guest } from '../types';
import { parseCompanions, formatCompanionsList } from '../utils/companion';
import { formatAppointmentDisplay } from '../utils/cpf';
import { STATUS_LABEL } from '../utils/labels';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'sonner';

function sanitizeCsvCell(val: string): string {
  const str = (val || '').replace(/"/g, '""');
  if (/^[=+\-@]/.test(str)) {
    return `"'${str}"`;
  }
  return `"${str}"`;
}

function toCSV(rows: string[][]) {
  return rows.map(r => r.map(sanitizeCsvCell).join(',')).join('\n');
}

function formatDate(iso?: string) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatStatusLabel(status: Guest['status']) {
  return STATUS_LABEL[status];
}

function getTimestamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${min}`;
}

export function exportGuestsToCSV(guests: Guest[]) {
  try {
    const headers = [
      'Nome',
      'CPF',
      'Celular',
      'Situação',
      'Consulta (Dia/Hora)',
      'Entrada',
      'Saída',
      'Tipo Atendimento',
      'Hospital/Clínica',
      'Qtde Acompanhantes',
      'Acompanhantes',
      'Motivo',
      'Responsável',
    ];
    const rows = guests.map(b => {
      const comps = parseCompanions(b.companions);
      const companionCount = comps.length > 0 ? comps.length : b.hasCompanion ? 1 : 0;
      const companionsStr = formatCompanionsList(comps);
      return [
        b.name,
        b.cpf,
        b.phone,
        formatStatusLabel(b.status),
        formatAppointmentDisplay(b.appointmentDate, b.appointmentTime),
        formatDate(b.checkInAt),
        formatDate(b.checkOutAt),
        b.medicalType ?? '-',
        b.medicalNotes ?? '-',
        String(companionCount),
        companionsStr,
        b.reason ?? '-',
        b.responsible ?? '-',
      ];
    });
    const csvContent = '\uFEFF' + toCSV([headers, ...rows]);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hospedes_${getTimestamp()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório CSV exportado com sucesso!');
  } catch {
    toast.error('Erro ao exportar CSV.');
  }
}

export async function exportGuestsToPDF(guests: Guest[]) {
  try {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF({ orientation: 'landscape' });
    const now = new Date().toLocaleString('pt-BR');
    doc.setFontSize(18);
    doc.setTextColor(37, 99, 235);
    doc.text('Relatório de Hóspedes - Casa de Apoio', 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Prefeitura Municipal de Quirinópolis • Gerado em: ${now}`, 14, 27);

    const head = [
      [
        'Nome',
        'CPF',
        'Celular',
        'Situação',
        'Consulta',
        'Entrada',
        'Saída',
        'Hospital / Clínica',
        'Procedimento',
        'Acomp.',
      ],
    ];
    const body = guests.map(d => {
      const comps = parseCompanions(d.companions);
      const count = comps.length > 0 ? comps.length : d.hasCompanion ? 1 : 0;
      return [
        d.name,
        d.cpf,
        d.phone,
        formatStatusLabel(d.status),
        formatAppointmentDisplay(d.appointmentDate, d.appointmentTime),
        formatDate(d.checkInAt),
        formatDate(d.checkOutAt),
        d.medicalNotes ?? '-',
        d.reason || d.medicalType || '-',
        String(count),
      ];
    });

    autoTable(doc, {
      head,
      body,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak', font: 'helvetica' },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      startY: 32,
    });
    doc.save(`hospedes_${getTimestamp()}.pdf`);
    toast.success('Relatório PDF exportado com sucesso!');
  } catch {
    toast.error('Erro ao exportar PDF.');
  }
}

export default function ExportButtons({ guests }: { guests: Guest[] }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="btn-secondary cursor-pointer"
        onClick={() => exportGuestsToCSV(guests)}
        title="Exportar dados filtrados para planilha CSV"
      >
        <FileSpreadsheet className="h-3.5 w-3.5 text-slate-500" />
        <span>Exportar CSV</span>
      </button>
      <button
        type="button"
        className="btn-secondary cursor-pointer"
        onClick={() => exportGuestsToPDF(guests)}
        title="Exportar dados filtrados para documento PDF"
      >
        <FileText className="h-3.5 w-3.5 text-slate-500" />
        <span>Exportar PDF</span>
      </button>
    </div>
  );
}