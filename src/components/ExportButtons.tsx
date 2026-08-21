import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Guest } from '../types';
import { parseCompanions, formatCompanionsList } from '../utils/companion';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'sonner';

function toCSV(rows: string[][]) {
  return rows.map(r => r.map(v => `"${(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
}

function formatDate(iso?: string) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
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
      'Status',
      'Check-in',
      'Check-out',
      'Tipo Atendimento',
      'Status Atendimento',
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
        b.status,
        formatDate(b.checkInAt),
        formatDate(b.checkOutAt),
        b.medicalType ?? '-',
        b.medicalStatus ?? '-',
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

export function exportGuestsToPDF(guests: Guest[]) {
  try {
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
        'Status',
        'Check-in',
        'Check-out',
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
        d.status.toUpperCase(),
        formatDate(d.checkInAt),
        formatDate(d.checkOutAt),
        d.medicalNotes ?? '-',
        `${d.medicalType ?? '-'} (${d.medicalStatus ?? '-'})`,
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
        className="btn-secondary py-2 px-3 text-xs sm:text-sm font-medium"
        onClick={() => exportGuestsToCSV(guests)}
        title="Exportar dados filtrados para planilha CSV"
      >
        <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <span className="hidden sm:inline">Exportar CSV</span>
      </button>
      <button
        className="btn-secondary py-2 px-3 text-xs sm:text-sm font-medium"
        onClick={() => exportGuestsToPDF(guests)}
        title="Exportar dados filtrados para documento PDF"
      >
        <FileText className="h-4 w-4 text-brand-600 dark:text-brand-400" />
        <span className="hidden sm:inline">Exportar PDF</span>
      </button>
    </div>
  );
}