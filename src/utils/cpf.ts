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

export function formatSUS(sus: string): string {
  const s = onlyDigits(sus).slice(0, 15);
  if (s.length <= 3) return s;
  if (s.length <= 7) return `${s.slice(0, 3)} ${s.slice(3)}`;
  if (s.length <= 11) return `${s.slice(0, 3)} ${s.slice(3, 7)} ${s.slice(7)}`;
  return `${s.slice(0, 3)} ${s.slice(3, 7)} ${s.slice(7, 11)} ${s.slice(11)}`;
}

export function calculateAge(isoDate: string): number {
  if (!isoDate) return 0;
  const dob = new Date(isoDate);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}