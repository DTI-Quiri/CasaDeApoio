import { onlyDigits } from './cpf';

export function getWhatsAppUrl(phone?: string): string | null {
  if (!phone) return null;
  const digits = onlyDigits(phone);
  if (digits.length < 10) return null;
  // If already starts with 55 and has 12 or 13 digits, keep it; otherwise prepend 55 (Brazil)
  const fullNumber = digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`;
  return `https://wa.me/${fullNumber}`;
}

