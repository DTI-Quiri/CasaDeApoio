// Validação de CPF brasileiro
export function onlyDigits(v: string) {
  return (v || '').replace(/\D+/g, '');
}

export function validateCPF(cpf: string): boolean {
  const s = onlyDigits(cpf);
  if (s.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(s)) return false; // todos iguais

  const calc = (base: string, factor: number) => {
    let total = 0;
    for (let i = 0; i < base.length; i++) {
      total += parseInt(base[i], 10) * (factor - i);
    }
    const mod = total % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const d1 = calc(s.substring(0, 9), 10);
  const d2 = calc(s.substring(0, 10), 11);
  return d1 === parseInt(s[9], 10) && d2 === parseInt(s[10], 10);
}

export function formatCPF(cpf: string): string {
  const s = onlyDigits(cpf).slice(0, 11);
  return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function formatPhone(v: string): string {
  const s = onlyDigits(v).slice(0, 11);
  if (!s) return '';
  if (s.length <= 2) return `(${s}`;
  if (s.length <= 6) return `(${s.slice(0, 2)}) ${s.slice(2)}`;
  if (s.length <= 10) return `(${s.slice(0, 2)}) ${s.slice(2, 6)}-${s.slice(6)}`;
  return `(${s.slice(0, 2)}) ${s.slice(2, 7)}-${s.slice(7, 11)}`;
}

export function formatCEP(v: string): string {
  const s = onlyDigits(v).slice(0, 8);
  if (s.length <= 5) return s;
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

export function formatSUS(sus: string): string {
  const s = onlyDigits(sus).slice(0, 15);
  if (s.length <= 3) return s;
  if (s.length <= 7) return `${s.slice(0, 3)} ${s.slice(3)}`;
  if (s.length <= 11) return `${s.slice(0, 3)} ${s.slice(3, 7)} ${s.slice(7)}`;
  return `${s.slice(0, 3)} ${s.slice(3, 7)} ${s.slice(7, 11)} ${s.slice(11)}`;
}

export function calculateAge(isoDate: string): number {
  if (!isoDate) return 0;
  const parts = isoDate.split('-');
  if (parts.length !== 3) return 0;
  const birthYear = parseInt(parts[0], 10);
  const birthMonth = parseInt(parts[1], 10) - 1;
  const birthDay = parseInt(parts[2], 10);
  if (isNaN(birthYear) || isNaN(birthMonth) || isNaN(birthDay)) return 0;

  const today = new Date();
  let age = today.getFullYear() - birthYear;
  const m = today.getMonth() - birthMonth;
  if (m < 0 || (m === 0 && today.getDate() < birthDay)) {
    age--;
  }
  return Math.max(0, age);
}

export function formatDateBR(input: string): string {
  const digits = onlyDigits(input).slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function isoToBrDate(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return '';
  const [y, m, d] = parts;
  if (!y || !m || !d) return '';
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
}

export function brDateToIso(brDate: string): string {
  if (!brDate) return '';
  const digits = onlyDigits(brDate);
  if (digits.length !== 8) return '';
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  return `${year}-${month}-${day}`;
}

export function isValidDateBR(brDate: string): boolean {
  const digits = onlyDigits(brDate);
  if (digits.length !== 8) return false;
  const day = parseInt(digits.slice(0, 2), 10);
  const month = parseInt(digits.slice(2, 4), 10);
  const year = parseInt(digits.slice(4, 8), 10);

  if (month < 1 || month > 12) return false;
  if (year < 1900 || year > new Date().getFullYear() + 5) return false;

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return false;

  return true;
}

export function formatTimeBR(input: string): string {
  const digits = onlyDigits(input).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, -2)}:${digits.slice(-2)}`;
}

export function isValidTimeBR(time: string): boolean {
  if (!time) return true;
  const digits = onlyDigits(time);
  if (digits.length < 3 || digits.length > 4) return false;
  const hh = parseInt(digits.slice(0, -2), 10);
  const mm = parseInt(digits.slice(-2), 10);
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

export function formatAppointmentDisplay(dateIso?: string, time?: string): string {
  const d = dateIso ? isoToBrDate(dateIso) : '';
  const t = (time || '').trim();
  if (d && t) return `${d} às ${t}`;
  if (d) return d;
  if (t) return `às ${t}`;
  return '';
}

export function getTodayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const LOWERCASE_PARTICLES = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

/**
 * Padroniza nomes próprios (ex: converte "WELINGTON FAUSTINO DA SILVA" para "Welington Faustino da Silva")
 */
export function formatPersonName(name?: string): string {
  if (!name) return '';
  return name
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && LOWERCASE_PARTICLES.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/**
 * Retorna data e hora separadas sem vírgula para exibição alinhada em tabelas
 */
export function formatDateTimeParts(iso?: string): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return { date, time };
}