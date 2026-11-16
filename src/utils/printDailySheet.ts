import type { Guest } from '../types';
import { formatCompanionsList } from './companion';
import { formatAppointmentDisplay, formatPersonName, getTodayISO } from './cpf';
import { companionCount, compareTimeStr } from './labels';

function escapeHtml(text?: string | null): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Gera uma folha limpa A4 e dispara impressão direta via iframe oculto (sem pop-ups).
 */
export function printDailySheet(guests: Guest[]) {
  const today = getTodayISO();
  const inHouse = guests.filter(g => g.status === 'presente');
  const arrivingToday = guests
    .filter(g => g.status === 'agendado' && g.appointmentDate === today)
    .sort((a, b) => compareTimeStr(a.appointmentTime, b.appointmentTime));

  const compCount = inHouse.reduce((acc, g) => acc + companionCount(g), 0);
  const totalPeople = inHouse.length + compCount;
  const generatedAt = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  const arrivingRows = arrivingToday.length
    ? arrivingToday
        .map((g, i) => {
          const comps = g.hasCompanion ? formatCompanionsList(g.companions) || 'Sim (não nominado)' : '-';
          const consulta = formatAppointmentDisplay(g.appointmentDate, g.appointmentTime) || 'Hoje';
          const obs = [g.notes, g.socialNotes].filter(Boolean).join(' • ');
          return `
            <tr>
              <td class="num">${i + 1}</td>
              <td>
                <strong>${escapeHtml(formatPersonName(g.name))}</strong>
                <div class="sub">${escapeHtml(g.phone || '-')} • CPF ${escapeHtml(g.cpf)}</div>
                ${obs ? `<div class="obs">Obs: ${escapeHtml(obs)}</div>` : ''}
              </td>
              <td class="nowrap">${escapeHtml(consulta)}</td>
              <td>${escapeHtml(comps)}</td>
              <td>${escapeHtml(g.medicalNotes || g.reason || '-')}</td>
            </tr>
          `;
        })
        .join('')
    : `<tr><td colspan="5" class="empty">Nenhuma chegada prevista para hoje.</td></tr>`;

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Lista do Dia - Casa de Apoio</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Inter, Arial, sans-serif; color: #0f172a; font-size: 11px; line-height: 1.35; margin: 0; }
    header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
    h1 { font-size: 16px; margin: 0; }
    .meta { font-size: 10px; color: #475569; text-align: right; }
    .summary { display: flex; gap: 12px; margin-bottom: 14px; }
    .box { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; background: #f8fafc; }
    .box-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; }
    .box-val { font-size: 15px; font-weight: 700; margin-top: 2px; }
    h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; margin: 14px 0 6px; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-size: 10px; font-weight: 700; }
    .num { width: 26px; text-align: center; color: #475569; }
    .nowrap { white-space: nowrap; }
    .sub { font-size: 9.5px; color: #475569; margin-top: 1px; }
    .obs { font-size: 9.5px; color: #9a3412; margin-top: 2px; font-weight: 600; }
    .empty { text-align: center; color: #64748b; padding: 12px; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Casa de Apoio — Quirinópolis • Lista do Dia</h1>
      <div style="font-size:10.5px;color:#475569;margin-top:2px;">Controle diário de hospedagem, refeições e chegadas</div>
    </div>
    <div class="meta">Emitido em ${escapeHtml(generatedAt)}</div>
  </header>

  <section class="summary">
    <div class="box">
      <div class="box-label">Total na Casa (Refeições)</div>
      <div class="box-val">${totalPeople} ${totalPeople === 1 ? 'pessoa' : 'pessoas'} <span style="font-size:10px;font-weight:400;color:#475569;">(${inHouse.length} ${inHouse.length === 1 ? 'hóspede' : 'hóspedes'} + ${compCount} ${compCount === 1 ? 'acompanhante' : 'acompanhantes'})</span></div>
    </div>
    <div class="box">
      <div class="box-label">Chegadas Previstas Hoje</div>
      <div class="box-val">${arrivingToday.length} hóspedes</div>
    </div>
  </section>

  <h2>Chegadas Previstas Hoje (${arrivingToday.length})</h2>
  <table>
    <thead>
      <tr>
        <th class="num">#</th>
        <th>Hóspede / Contato</th>
        <th>Consulta</th>
        <th>Acompanhante(s)</th>
        <th>Local / Procedimento</th>
      </tr>
    </thead>
    <tbody>${arrivingRows}</tbody>
  </table>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    window.setTimeout(() => iframe.remove(), 1500);
  };
  window.setTimeout(triggerPrint, 120);
}
