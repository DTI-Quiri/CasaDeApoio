export type Status = 'presente' | 'finalizado';

export interface AuditEntry {
  id: string;
  guestId: string;
  fromStatus?: Status;
  toStatus: Status;
  at: string; // ISO timestamp
  byUser: string; // username
  note?: string;
}

export interface Companion {
  name: string;
  cpf?: string;
}

export interface Guest {
  id: string;
  name: string;
  dateOfBirth: string; // ISO date (yyyy-mm-dd)
  phone: string;
  cpf: string;
  susCard?: string; // Cartão Nacional de Saúde (CNS / SUS)
  hasCompanion?: boolean;
  companions?: Companion[];
  reason?: string;
  responsible?: string;
  // Observações
  notes?: string;
  socialNotes?: string;
  medicalNotes?: string;
  medicalType?: 'consulta' | 'exame' | 'cirurgia' | 'outro';
  medicalStatus?: 'aguardando' | 'concluida';
  // Endereço
  addressZip?: string;
  addressState?: string;
  addressCity?: string;
  addressNeighborhood?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  status: Status;
  checkInAt?: string;
  checkOutAt?: string;
}

export type Role = 'admin' | 'funcionario';

export interface User {
  id: string;
  username: string;
  role: Role;
  createdAt?: string;
  mustChangePassword?: boolean;
}

export interface Settings {
  alertDays: number;
}