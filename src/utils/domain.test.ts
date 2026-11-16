import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCPF,
  formatCPF,
  isValidDateBR,
  brDateToIso,
  isoToBrDate,
  formatTimeBR,
  isValidTimeBR,
  formatPersonName,
} from './cpf.ts';
import { parseCompanions, formatCompanionsList } from './companion.ts';
import { classifyAuditEvent, compareTimeStr } from './labels.ts';
import { cleanAuditNote, formatDuration, organizeStays } from './history.ts';
import { matchGuest } from './search.ts';
import { getWhatsAppUrl } from './whatsapp.ts';
import type { AuditEntry, Guest } from '../types.ts';

describe('Validação de CPF e Datas (cpf.ts)', () => {
  it('rejeita CPFs com dígitos repetidos ou inválidos', () => {
    assert.equal(validateCPF('111.111.111-11'), false);
    assert.equal(validateCPF('000.000.000-00'), false);
    assert.equal(validateCPF('123.456.789-00'), false);
    assert.equal(validateCPF('123.456'), false);
  });

  it('aceita CPFs válidos com ou sem máscara', () => {
    assert.equal(validateCPF('52998224725'), true);
    assert.equal(validateCPF(formatCPF('52998224725')), true);
  });

  it('valida datas reais do calendário brasileiro (rejeitando 31/02)', () => {
    assert.equal(isValidDateBR('28/02/2026'), true);
    assert.equal(isValidDateBR('29/02/2024'), true);
    assert.equal(isValidDateBR('29/02/2026'), false);
    assert.equal(isValidDateBR('31/02/2026'), false);
    assert.equal(isValidDateBR('32/01/2026'), false);
  });

  it('valida horários HH:MM no formato 24h', () => {
    assert.equal(formatTimeBR('820'), '8:20');
    assert.equal(formatTimeBR('1420'), '14:20');
    assert.equal(isValidTimeBR('8:20'), true);
    assert.equal(isValidTimeBR('08:30'), true);
    assert.equal(isValidTimeBR('23:59'), true);
    assert.equal(isValidTimeBR('24:00'), false);
    assert.equal(isValidTimeBR('12:60'), false);
    assert.equal(isValidTimeBR('8:60'), false);
  });

  it('formata nomes próprios preservando preposições em minúsculo', () => {
    assert.equal(
      formatPersonName('MARIA DAS DORES DE SOUZA E SILVA'),
      'Maria das Dores de Souza e Silva'
    );
  });
});

describe('Serialização e Parsing de Acompanhantes (companion.ts)', () => {
  it('converte lista mista de strings e objetos e preserva celular e parentesco', () => {
    const raw = [
      { name: 'Ana Paula', phone: '(64) 99999-1234', relationship: 'Mãe' },
      { name: '   ', phone: '', relationship: '' },
      'João Carlos (111.222.333-44)',
    ];
    const parsed = parseCompanions(raw, true);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].name, 'Ana Paula');
    assert.equal(parsed[0].phone, '(64) 99999-1234');
    assert.equal(parsed[0].relationship, 'Mãe');
    assert.equal(parsed[1].name, 'João Carlos');
    assert.equal(parsed[1].cpf, '111.222.333-44');
    const formatted = formatCompanionsList(parsed);
    assert.ok(formatted.includes('Ana Paula (Mãe • (64) 99999-1234)'));
  });
});

describe('Classificação de auditoria e ordenação de horários (labels.ts)', () => {
  it('ordena horários curtos (8:20) antes de horários vespertinos (14:00)', () => {
    assert.ok(compareTimeStr('8:20', '14:00') < 0);
    assert.ok(compareTimeStr('14:00', '8:20') > 0);
    assert.equal(compareTimeStr('8:20', '08:20'), 0);
  });

  it('classifica edições cadastrais como edit mesmo com toStatus presente ou agendado', () => {
    const editLog = {
      id: 'a1',
      guestId: 'g1',
      toStatus: 'presente' as const,
      at: '2026-11-16T12:00:00.000Z',
      byUser: 'admin',
      note: 'Alterou Celular de "(64) 99999-0000" para "(64) 99999-1111"',
    };
    assert.equal(classifyAuditEvent(editLog).kind, 'edit');

    const checkinLog = {
      id: 'a2',
      guestId: 'g1',
      fromStatus: 'agendado' as const,
      toStatus: 'presente' as const,
      at: '2026-11-16T12:05:00.000Z',
      byUser: 'admin',
      note: 'Chegada confirmada na Casa de Apoio',
    };
    assert.equal(classifyAuditEvent(checkinLog).kind, 'checkin');
  });
});

function makeGuest(overrides: Partial<Guest> = {}): Guest {
  return {
    id: 'guest-1',
    name: 'Maria da Silva',
    dateOfBirth: '1970-05-10',
    phone: '(64) 99999-0000',
    cpf: '529.982.247-25',
    hasCompanion: false,
    companions: [],
    status: 'finalizado',
    reason: 'Consulta Oftalmológica',
    medicalNotes: 'Hospital Araújo Jorge',
    appointmentDate: '2026-11-10',
    appointmentTime: '08:30',
    ...overrides,
  };
}

describe('Histórico e agrupamento de estadias (history.ts)', () => {
  it('agrupa cadastro, edição cadastral, entrada e saída em 1 estadia única', () => {
    const guest = makeGuest({
      status: 'finalizado',
      checkInAt: '2026-11-10T09:00:00.000Z',
      checkOutAt: '2026-11-11T15:00:00.000Z',
    });
    const logs: AuditEntry[] = [
      {
        id: '1',
        guestId: guest.id,
        toStatus: 'agendado',
        at: '2026-11-09T14:00:00.000Z',
        byUser: 'admin',
        note: 'Cadastro realizado e encaminhado para a Casa de Apoio (Consulta: 10/11/2026 às 08:30)',
      },
      {
        id: '2',
        guestId: guest.id,
        toStatus: 'agendado',
        at: '2026-11-09T16:00:00.000Z',
        byUser: 'admin',
        note: 'Alterou Celular de "(64) 99999-0000" para "(64) 99999-1111"',
      },
      {
        id: '3',
        guestId: guest.id,
        fromStatus: 'agendado',
        toStatus: 'presente',
        at: '2026-11-10T09:00:00.000Z',
        byUser: 'recepcao',
        note: 'Entrada confirmada na Casa de Apoio',
      },
      {
        id: '4',
        guestId: guest.id,
        fromStatus: 'presente',
        toStatus: 'finalizado',
        at: '2026-11-11T15:00:00.000Z',
        byUser: 'recepcao',
        note: 'Saída registrada na Casa de Apoio',
      },
    ];

    const stays = organizeStays(guest, logs);
    assert.equal(stays.length, 1);
    assert.equal(stays[0].status, 'finalizada');
    assert.equal(stays[0].events.length, 4);
    assert.equal(stays[0].durationText, '1 dia e 6h');
  });

  it('mantém estadia única ao desfazer entrada (undoCheckin)', () => {
    const guest = makeGuest({ status: 'agendado', checkInAt: undefined, checkOutAt: undefined });
    const logs: AuditEntry[] = [
      {
        id: '1',
        guestId: guest.id,
        toStatus: 'agendado',
        at: '2026-11-10T08:00:00.000Z',
        byUser: 'admin',
        note: 'Cadastro realizado e encaminhado para a Casa de Apoio',
      },
      {
        id: '2',
        guestId: guest.id,
        fromStatus: 'agendado',
        toStatus: 'presente',
        at: '2026-11-10T09:00:00.000Z',
        byUser: 'recepcao',
        note: 'Entrada confirmada na Casa de Apoio',
      },
      {
        id: '3',
        guestId: guest.id,
        fromStatus: 'presente',
        toStatus: 'agendado',
        at: '2026-11-10T09:02:00.000Z',
        byUser: 'recepcao',
        note: 'Retornado para Aguardando Chegada',
      },
    ];

    const stays = organizeStays(guest, logs);
    assert.equal(stays.length, 1);
    assert.equal(stays[0].status, 'agendada');
    assert.equal(stays[0].start, undefined);
    assert.equal(stays[0].events.length, 3);
  });

  it('reabre a mesma estadia ao desfazer saída (undoCheckout) sem criar duplicata', () => {
    const guest = makeGuest({
      status: 'presente',
      checkInAt: '2026-11-10T09:00:00.000Z',
      checkOutAt: undefined,
    });
    const logs: AuditEntry[] = [
      {
        id: '1',
        guestId: guest.id,
        toStatus: 'agendado',
        at: '2026-11-09T14:00:00.000Z',
        byUser: 'admin',
        note: 'Cadastro realizado e encaminhado',
      },
      {
        id: '2',
        guestId: guest.id,
        fromStatus: 'agendado',
        toStatus: 'presente',
        at: '2026-11-10T09:00:00.000Z',
        byUser: 'recepcao',
        note: 'Entrada confirmada na Casa de Apoio',
      },
      {
        id: '3',
        guestId: guest.id,
        fromStatus: 'presente',
        toStatus: 'finalizado',
        at: '2026-11-11T10:00:00.000Z',
        byUser: 'recepcao',
        note: 'Saída registrada na Casa de Apoio',
      },
      {
        id: '4',
        guestId: guest.id,
        fromStatus: 'finalizado',
        toStatus: 'presente',
        at: '2026-11-11T10:05:00.000Z',
        byUser: 'recepcao',
        note: 'Finalização desfeita (estadia reaberta por engano)',
      },
    ];

    const stays = organizeStays(guest, logs);
    assert.equal(stays.length, 1);
    assert.equal(stays[0].status, 'em_andamento');
    assert.equal(stays[0].start, '2026-11-10T09:00:00.000Z');
    assert.equal(stays[0].end, undefined);
    assert.equal(stays[0].events.length, 4);
  });

  it('separa corretamente múltiplas estadias reais em ordem da mais recente para a mais antiga', () => {
    const guest = makeGuest({
      status: 'presente',
      reason: 'Retorno Cardiologia',
      appointmentDate: '2026-11-16',
      appointmentTime: '14:00',
      checkInAt: '2026-11-16T08:00:00.000Z',
      checkOutAt: undefined,
    });
    const logs: AuditEntry[] = [
      {
        id: '1',
        guestId: guest.id,
        toStatus: 'agendado',
        at: '2026-11-01T10:00:00.000Z',
        byUser: 'admin',
        note: 'Cadastro realizado e encaminhado (Consulta: 02/11/2026)',
      },
      {
        id: '2',
        guestId: guest.id,
        fromStatus: 'agendado',
        toStatus: 'presente',
        at: '2026-11-02T07:00:00.000Z',
        byUser: 'recepcao',
        note: 'Entrada confirmada na Casa de Apoio',
      },
      {
        id: '3',
        guestId: guest.id,
        fromStatus: 'presente',
        toStatus: 'finalizado',
        at: '2026-11-03T16:00:00.000Z',
        byUser: 'recepcao',
        note: 'Saída registrada na Casa de Apoio',
      },
      {
        id: '4',
        guestId: guest.id,
        fromStatus: 'finalizado',
        toStatus: 'agendado',
        at: '2026-11-15T09:00:00.000Z',
        byUser: 'admin',
        note: 'Novo encaminhamento iniciado para consulta em 16/11/2026',
      },
      {
        id: '5',
        guestId: guest.id,
        fromStatus: 'agendado',
        toStatus: 'presente',
        at: '2026-11-16T08:00:00.000Z',
        byUser: 'recepcao',
        note: 'Entrada confirmada na Casa de Apoio',
      },
    ];

    const stays = organizeStays(guest, logs);
    assert.equal(stays.length, 2);
    assert.equal(stays[0].status, 'em_andamento');
    assert.equal(stays[0].events.length, 2);
    assert.equal(stays[0].appointmentText, '16/11/2026 às 14:00');
    assert.equal(stays[1].status, 'finalizada');
    assert.equal(stays[1].events.length, 3);
    assert.equal(stays[1].appointmentText, '02/11/2026');
  });

  it('marca ausência (Não veio) sem registrar entrada falsa', () => {
    const guest = makeGuest({
      status: 'finalizado',
      checkInAt: undefined,
      checkOutAt: '2026-11-12T20:00:00.000Z',
    });
    const logs: AuditEntry[] = [
      {
        id: '1',
        guestId: guest.id,
        toStatus: 'agendado',
        at: '2026-11-11T10:00:00.000Z',
        byUser: 'admin',
        note: 'Encaminhado pela Secretaria de Saúde',
      },
      {
        id: '2',
        guestId: guest.id,
        fromStatus: 'agendado',
        toStatus: 'finalizado',
        at: '2026-11-12T20:00:00.000Z',
        byUser: 'recepcao',
        note: 'Não compareceu à Casa de Apoio (Ausência registrada)',
      },
    ];

    const stays = organizeStays(guest, logs);
    assert.equal(stays.length, 1);
    assert.equal(stays[0].status, 'finalizada');
    assert.equal(stays[0].noShow, true);
    assert.equal(stays[0].start, undefined);
    assert.equal(stays[0].durationText, 'Não compareceu');
  });

  it('lida com registros legados sem nota nem checkIn anterior sem gerar duração negativa', () => {
    const guest = makeGuest({
      status: 'finalizado',
      checkInAt: '2026-08-20T00:52:16.010Z',
      checkOutAt: '2026-08-20T00:52:25.249Z',
    });
    const logs: AuditEntry[] = [
      {
        id: '1',
        guestId: guest.id,
        fromStatus: 'presente',
        toStatus: 'finalizado',
        at: '2026-08-20T00:29:17.066Z',
        byUser: 'admin',
      },
      {
        id: '2',
        guestId: guest.id,
        fromStatus: 'finalizado',
        toStatus: 'presente',
        at: '2026-08-20T00:52:16.010Z',
        byUser: 'admin',
      },
      {
        id: '3',
        guestId: guest.id,
        fromStatus: 'presente',
        toStatus: 'finalizado',
        at: '2026-08-20T00:52:25.249Z',
        byUser: 'admin',
      },
    ];

    const stays = organizeStays(guest, logs);
    assert.equal(stays.length, 1);
    assert.equal(stays[0].status, 'finalizada');
    assert.equal(stays[0].end, '2026-08-20T00:52:25.249Z');
    assert.equal(formatDuration('2026-08-20T00:52:25.000Z', '2026-08-20T00:29:17.000Z'), '');
    assert.equal(cleanAuditNote('Alterou Possui Acompanhante de "false" para "true"'), 'Alterou Possui Acompanhante de "Não" para "Sim"');
  });

  it('cria estadia de fallback quando não há registros em audit_logs', () => {
    const guest = makeGuest({ status: 'agendado', checkInAt: undefined, checkOutAt: undefined });
    const stays = organizeStays(guest, []);
    assert.equal(stays.length, 1);
    assert.equal(stays[0].status, 'agendada');
    assert.equal(stays[0].events.length, 1);
  });
});

describe('Busca multicritério, datas ISO/BR e WhatsApp (search.ts / cpf.ts / whatsapp.ts)', () => {
  it('converte datas entre BR e ISO com precisão', () => {
    assert.equal(brDateToIso('16/11/2026'), '2026-11-16');
    assert.equal(isoToBrDate('2026-11-16'), '16/11/2026');
  });

  it('localiza hóspede por nome sem acento, CPF sem máscara, hospital, data e acompanhante', () => {
    const guest = makeGuest({
      name: 'José Conceição Araújo',
      cpf: '529.982.247-25',
      phone: '(64) 99145-3210',
      susCard: '700 0012 3456 7890',
      medicalNotes: 'HGG - Hospital Geral de Goiânia',
      appointmentDate: '2026-11-16',
      hasCompanion: true,
      companions: [{ name: 'Marta Oliveira', phone: '(64) 98412-3306', relationship: 'Filho(a)' }],
    });

    assert.equal(matchGuest(guest, 'jose conceicao'), true);
    assert.equal(matchGuest(guest, '52998224725'), true);
    assert.equal(matchGuest(guest, '991453210'), true);
    assert.equal(matchGuest(guest, 'goiania'), true);
    assert.equal(matchGuest(guest, '16/11/2026'), true);
    assert.equal(matchGuest(guest, 'marta oliveira'), true);
    assert.equal(matchGuest(guest, '984123306'), true);
    assert.equal(matchGuest(guest, 'inexistente'), false);
  });

  it('gera URL do WhatsApp apenas para telefones válidos com DDD', () => {
    assert.equal(getWhatsAppUrl('(64) 99145-3210'), 'https://wa.me/5564991453210');
    assert.equal(getWhatsAppUrl('5564991453210'), 'https://wa.me/5564991453210');
    assert.equal(getWhatsAppUrl('12345'), null);
    assert.equal(getWhatsAppUrl(''), null);
  });
});
