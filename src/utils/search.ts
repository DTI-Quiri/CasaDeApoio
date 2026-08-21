import type { Guest } from '../types';

import { parseCompanions } from './companion';

export function normalizeText(text?: string | null): string {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Busca inteligente multicritério para hóspedes:
 * - Nome do Hóspede
 * - CPF (com ou sem pontuação)
 * - Celular / Telefone (com ou sem DDD e máscara)
 * - Cartão SUS / CNS
 * - Endereço Completo (Rua, Bairro, Cidade, Estado, CEP, Complemento, Número)
 * - Acompanhantes (Nome e CPF)
 * - Responsável Legal
 * - Hospital / Clínica
 * - Procedimento / Motivo do atendimento
 * - Tipo de Atendimento e Status Médico
 * - Observações gerais e sociais
 */
export function matchGuest(guest: Guest, query: string): boolean {
  const cleanQuery = normalizeText(query);
  if (!cleanQuery) return true;

  const terms = cleanQuery.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const companionsList = parseCompanions(guest.companions);
  const companionNames = companionsList.map(c => c.name).join(' ');
  const companionCpfs = companionsList.map(c => c.cpf || '').join(' ');
  const companionCpfDigits = companionCpfs.replace(/\D/g, '');

  // Montar texto consolidado de todos os campos textuais
  const searchableText = normalizeText([
    guest.name,
    guest.cpf,
    guest.phone,
    guest.susCard,
    guest.responsible,
    guest.reason,
    guest.medicalNotes,
    guest.medicalType,
    guest.medicalStatus,
    guest.notes,
    guest.socialNotes,
    guest.addressStreet,
    guest.addressNumber,
    guest.addressNeighborhood,
    guest.addressCity,
    guest.addressState,
    guest.addressZip,
    guest.addressComplement,
    companionNames,
    companionCpfs,
  ].filter(Boolean).join(' '));

  // Dígitos numéricos isolados para busca precisa de CPF, telefone, SUS, CEP, CPF de acompanhante
  const cpfDigits = (guest.cpf || '').replace(/\D/g, '');
  const phoneDigits = (guest.phone || '').replace(/\D/g, '');
  const susDigits = (guest.susCard || '').replace(/\D/g, '');
  const zipDigits = (guest.addressZip || '').replace(/\D/g, '');

  return terms.every(term => {
    // 1. Busca textual direta no texto composto
    if (searchableText.includes(term)) return true;

    // 2. Busca por dígitos (caso o usuário digite parte de CPF, celular, SUS, CEP ou CPF do acompanhante)
    const termDigits = term.replace(/\D/g, '');
    if (termDigits.length >= 2) {
      if (cpfDigits.includes(termDigits)) return true;
      if (companionCpfDigits.includes(termDigits)) return true;
      if (phoneDigits.includes(termDigits)) return true;
      if (susDigits.includes(termDigits)) return true;
      if (zipDigits.includes(termDigits)) return true;
    }

    return false;
  });
}

