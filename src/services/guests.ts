import { turso, hashPassword, compareHash } from '../lib/turso';
import { onlyDigits, formatCPF } from '../utils/cpf';
import { parseCompanions } from '../utils/companion';
import { broadcastDataChange } from '../utils/sync';
import type { AuditEntry, Guest, Settings, Status, User, Role } from '../types';

function fromRow(row: Record<string, unknown>): Guest {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    dateOfBirth: String(row.date_of_birth ?? ''),
    phone: String(row.phone ?? ''),
    cpf: String(row.cpf ?? ''),
    susCard: String(row.sus_card ?? ''),
    hasCompanion: row.has_companion === 1,
    companions: parseCompanions(row.companions),
    reason: String(row.reason ?? ''),
    responsible: String(row.responsible ?? ''),
    notes: String(row.notes ?? ''),
    socialNotes: String(row.social_notes ?? ''),
    medicalNotes: String(row.medical_notes ?? ''),
    medicalType: (row.medical_type as Guest['medicalType']) || undefined,
    medicalStatus: (row.medical_status as Guest['medicalStatus']) || undefined,
    addressZip: String(row.address_zip ?? ''),
    addressState: String(row.address_state ?? ''),
    addressCity: String(row.address_city ?? ''),
    addressNeighborhood: String(row.address_neighborhood ?? ''),
    addressStreet: String(row.address_street ?? ''),
    addressNumber: String(row.address_number ?? ''),
    addressComplement: String(row.address_complement ?? ''),
    status: row.status as Status,
    checkInAt: row.check_in_at ? String(row.check_in_at) : undefined,
    checkOutAt: row.check_out_at ? String(row.check_out_at) : undefined,
  };
}

function toParams(guest: Guest) {
  return [
    guest.id,
    guest.name,
    guest.dateOfBirth || null,
    guest.phone || null,
    guest.cpf || null,
    guest.susCard || null,
    guest.hasCompanion ? 1 : 0,
    JSON.stringify(guest.companions ?? []),
    guest.reason || null,
    guest.responsible || null,
    guest.notes || null,
    guest.socialNotes || null,
    guest.medicalNotes || null,
    guest.medicalType || null,
    guest.medicalStatus || null,
    guest.addressZip || null,
    guest.addressState || null,
    guest.addressCity || null,
    guest.addressNeighborhood || null,
    guest.addressStreet || null,
    guest.addressNumber || null,
    guest.addressComplement || null,
    guest.status,
    guest.checkInAt || null,
    guest.checkOutAt || null,
  ];
}

const UPSERT_GUEST_SQL = `
  INSERT INTO guests (
    id, name, date_of_birth, phone, cpf, sus_card, has_companion, companions, reason, responsible,
    notes, social_notes, medical_notes, medical_type, medical_status, address_zip,
    address_state, address_city, address_neighborhood, address_street, address_number,
    address_complement, status, check_in_at, check_out_at, updated_at
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
  )
  ON CONFLICT(id) DO UPDATE SET
    name=excluded.name, date_of_birth=excluded.date_of_birth, phone=excluded.phone, cpf=excluded.cpf,
    sus_card=excluded.sus_card, has_companion=excluded.has_companion, companions=excluded.companions,
    reason=excluded.reason, responsible=excluded.responsible, notes=excluded.notes, social_notes=excluded.social_notes,
    medical_notes=excluded.medical_notes, medical_type=excluded.medical_type, medical_status=excluded.medical_status,
    address_zip=excluded.address_zip, address_state=excluded.address_state, address_city=excluded.address_city,
    address_neighborhood=excluded.address_neighborhood, address_street=excluded.address_street,
    address_number=excluded.address_number, address_complement=excluded.address_complement,
    status=excluded.status, check_in_at=excluded.check_in_at, check_out_at=excluded.check_out_at,
    updated_at=CURRENT_TIMESTAMP;
`;

function fromAuditRow(row: Record<string, unknown>): AuditEntry {
  return {
    id: String(row.id ?? ''),
    guestId: String(row.guest_id ?? ''),
    fromStatus: (row.from_status as Status) || undefined,
    toStatus: row.to_status as Status,
    at: String(row.changed_at ?? ''),
    byUser: String(row.changed_by ?? ''),
    note: row.note ? String(row.note) : undefined,
  };
}

function toAuditParams(a: AuditEntry) {
  return [
    a.id,
    a.guestId,
    a.fromStatus ?? null,
    a.toStatus,
    a.at,
    a.byUser,
    a.note ?? null,
  ];
}

export async function listGuests(): Promise<Guest[]> {
  const { rows } = await turso.execute('SELECT * FROM guests ORDER BY created_at DESC');
  return rows.map(fromRow);
}

export async function getGuest(id: string): Promise<Guest | undefined> {
  const { rows } = await turso.execute({
    sql: 'SELECT * FROM guests WHERE id = ?',
    args: [id],
  });
  if (rows.length === 0) return undefined;
  return fromRow(rows[0]);
}

export async function findGuestByCPF(cpf: string): Promise<Guest | undefined> {
  const digits = onlyDigits(cpf);
  const formatted = formatCPF(cpf);
  const candidates = Array.from(new Set([digits, formatted]));
  if (candidates.length === 0) return undefined;

  const placeholders = candidates.map(() => '?').join(',');
  const { rows } = await turso.execute({
    sql: `SELECT * FROM guests WHERE cpf IN (${placeholders}) LIMIT 1`,
    args: candidates,
  });
  if (rows.length > 0) return fromRow(rows[0]);
  return undefined;
}

export async function upsertGuest(next: Guest): Promise<void> {
  await turso.execute({
    sql: UPSERT_GUEST_SQL,
    args: toParams(next),
  });
  broadcastDataChange('GUEST_UPDATED');
}

export async function deleteGuest(id: string): Promise<void> {
  await turso.batch([
    {
      sql: 'DELETE FROM audit_logs WHERE guest_id = ?',
      args: [id],
    },
    {
      sql: 'DELETE FROM guests WHERE id = ?',
      args: [id],
    },
  ]);
  broadcastDataChange('GUEST_UPDATED');
}

export async function listAudit(guestId: string): Promise<AuditEntry[]> {
  const { rows } = await turso.execute({
    sql: 'SELECT * FROM audit_logs WHERE guest_id = ? ORDER BY changed_at DESC',
    args: [guestId],
  });
  return rows.map(fromAuditRow);
}

export async function listAllAudit(): Promise<AuditEntry[]> {
  const { rows } = await turso.execute('SELECT * FROM audit_logs ORDER BY changed_at DESC');
  return rows.map(fromAuditRow);
}

export async function addAudit(entry: AuditEntry): Promise<void> {
  await turso.execute({
    sql: 'INSERT INTO audit_logs (id, guest_id, from_status, to_status, changed_at, changed_by, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: toAuditParams(entry),
  });
}

export async function changeStatus(g: Guest, to: Status, byUser: string, note?: string): Promise<Guest> {
  const now = new Date().toISOString();
  const next: Guest = { ...g, status: to };
  if (to === 'presente') {
    next.checkInAt = g.checkInAt || now;
    next.checkOutAt = undefined;
    if (!next.medicalStatus) {
      next.medicalStatus = 'aguardando';
    }
  }
  if (to === 'finalizado') {
    next.checkOutAt = now;
    next.medicalStatus = 'concluida';
  }

  const auditEntry: AuditEntry = {
    id: crypto.randomUUID(),
    guestId: g.id,
    fromStatus: g.status,
    toStatus: to,
    at: now,
    byUser,
    note: note || (to === 'finalizado' ? 'Check-out / Estadia finalizada (Pendência médica concluída)' : 'Check-in / Estadia iniciada'),
  };

  await turso.batch([
    { sql: UPSERT_GUEST_SQL, args: toParams(next) },
    {
      sql: 'INSERT INTO audit_logs (id, guest_id, from_status, to_status, changed_at, changed_by, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: toAuditParams(auditEntry),
    },
  ]);

  broadcastDataChange('GUEST_UPDATED');
  return next;
}

export async function undoCheckout(g: Guest, byUser: string): Promise<Guest> {
  const now = new Date().toISOString();
  const next: Guest = {
    ...g,
    status: 'presente',
    checkOutAt: undefined,
    medicalStatus: 'aguardando',
  };

  const auditEntry: AuditEntry = {
    id: crypto.randomUUID(),
    guestId: g.id,
    fromStatus: 'finalizado',
    toStatus: 'presente',
    at: now,
    byUser,
    note: 'Finalização desfeita (estadia reaberta por engano)',
  };

  await turso.batch([
    { sql: UPSERT_GUEST_SQL, args: toParams(next) },
    {
      sql: 'INSERT INTO audit_logs (id, guest_id, from_status, to_status, changed_at, changed_by, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: toAuditParams(auditEntry),
    },
  ]);

  broadcastDataChange('GUEST_UPDATED');
  return next;
}

export async function startNewStay(g: Guest, byUser: string): Promise<Guest> {
  const now = new Date().toISOString();
  const next: Guest = {
    ...g,
    status: 'presente',
    checkInAt: now,
    checkOutAt: undefined,
    medicalStatus: 'aguardando',
  };

  const auditEntry: AuditEntry = {
    id: crypto.randomUUID(),
    guestId: g.id,
    fromStatus: g.status,
    toStatus: 'presente',
    at: now,
    byUser,
    note: 'Nova estadia iniciada (retorno do hóspede)',
  };

  await turso.batch([
    { sql: UPSERT_GUEST_SQL, args: toParams(next) },
    {
      sql: 'INSERT INTO audit_logs (id, guest_id, from_status, to_status, changed_at, changed_by, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: toAuditParams(auditEntry),
    },
  ]);

  broadcastDataChange('GUEST_UPDATED');
  return next;
}

export async function batchCheckout(guests: Guest[], byUser: string): Promise<Guest[]> {
  const now = new Date().toISOString();
  const updatedGuests: Guest[] = guests.map(g => ({
    ...g,
    status: 'finalizado' as Status,
    checkOutAt: now,
    medicalStatus: 'concluida' as const,
  }));

  const statements = [];
  for (const g of updatedGuests) {
    statements.push({ sql: UPSERT_GUEST_SQL, args: toParams(g) });
    const auditEntry: AuditEntry = {
      id: crypto.randomUUID(),
      guestId: g.id,
      fromStatus: 'presente',
      toStatus: 'finalizado',
      at: now,
      byUser,
      note: 'Check-out em lote (saída coletiva)',
    };
    statements.push({
      sql: 'INSERT INTO audit_logs (id, guest_id, from_status, to_status, changed_at, changed_by, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: toAuditParams(auditEntry),
    });
  }

  await turso.batch(statements);
  broadcastDataChange('GUEST_UPDATED');
  return updatedGuests;
}

export async function batchUndoCheckout(guests: Guest[], byUser: string): Promise<Guest[]> {
  const now = new Date().toISOString();
  const updatedGuests: Guest[] = guests.map(g => ({
    ...g,
    status: 'presente' as Status,
    checkOutAt: undefined,
    medicalStatus: 'aguardando' as const,
  }));

  const statements = [];
  for (const g of updatedGuests) {
    statements.push({ sql: UPSERT_GUEST_SQL, args: toParams(g) });
    const auditEntry: AuditEntry = {
      id: crypto.randomUUID(),
      guestId: g.id,
      fromStatus: 'finalizado',
      toStatus: 'presente',
      at: now,
      byUser,
      note: 'Finalização em lote desfeita (estadia reaberta)',
    };
    statements.push({
      sql: 'INSERT INTO audit_logs (id, guest_id, from_status, to_status, changed_at, changed_by, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: toAuditParams(auditEntry),
    });
  }

  await turso.batch(statements);
  broadcastDataChange('GUEST_UPDATED');
  return updatedGuests;
}

export async function getSettings(): Promise<Settings> {
  try {
    const { rows } = await turso.execute('SELECT id, alert_days, updated_at FROM settings WHERE id = 1 LIMIT 1');
    if (rows.length === 0) return { alertDays: 7 };
    return { alertDays: (rows[0].alert_days as number) ?? 7 };
  } catch {
    return { alertDays: 7 };
  }
}

let userSchemaMigrated = false;
export async function ensureUserSchema(): Promise<void> {
  if (userSchemaMigrated) return;
  try {
    await turso.execute('ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0');
  } catch {
    // column already exists
  }
  userSchemaMigrated = true;
}

// User Management Services
export async function listUsers(): Promise<User[]> {
  await ensureUserSchema();
  const { rows } = await turso.execute('SELECT id, username, role, created_at, must_change_password FROM users ORDER BY created_at DESC');
  return rows.map(r => ({
    id: r.id as string,
    username: r.username as string,
    role: r.role as Role,
    createdAt: r.created_at as string | undefined,
    mustChangePassword: Number(r.must_change_password) === 1,
  }));
}

export async function createUser(username: string, password: string, role: Role, mustChangePassword = true): Promise<User> {
  await ensureUserSchema();
  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  await turso.execute({
    sql: 'INSERT INTO users (id, username, role, password_hash, must_change_password) VALUES (?, ?, ?, ?, ?)',
    args: [id, username, role, passwordHash, mustChangePassword ? 1 : 0],
  });
  return { id, username, role, mustChangePassword };
}

export async function deleteUser(id: string): Promise<void> {
  await turso.execute({
    sql: 'DELETE FROM users WHERE id = ?',
    args: [id],
  });
}

export async function updateUserPassword(userId: string, newPassword: string): Promise<void> {
  await ensureUserSchema();
  const passwordHash = await hashPassword(newPassword);
  await turso.execute({
    sql: 'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
    args: [passwordHash, userId],
  });
}

export async function resetUserPassword(userId: string, tempPassword: string): Promise<void> {
  await ensureUserSchema();
  const passwordHash = await hashPassword(tempPassword);
  await turso.execute({
    sql: 'UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?',
    args: [passwordHash, userId],
  });
}

export type AuthResult =
  | { success: true; user: User }
  | { success: false; error: 'USER_NOT_FOUND' | 'INVALID_PASSWORD' | 'SERVER_ERROR' };

export async function verifyUserCredentials(username: string, password: string): Promise<AuthResult> {
  await ensureUserSchema();
  console.log('[Auth] Iniciando verificação do usuário', username);
  try {
    const { rows } = await turso.execute({
      sql: 'SELECT id, username, role, password_hash, must_change_password FROM users WHERE username = ?',
      args: [username],
    });
    if (rows.length === 0) {
      return { success: false, error: 'USER_NOT_FOUND' };
    }
    const userRow = rows[0];
    const ok = await compareHash(password, userRow.password_hash as string);
    if (!ok) {
      return { success: false, error: 'INVALID_PASSWORD' };
    }
    return {
      success: true,
      user: {
        id: userRow.id as string,
        username: userRow.username as string,
        role: userRow.role as Role,
        mustChangePassword: Number(userRow.must_change_password) === 1,
      },
    };
  } catch (err) {
    console.error('[Auth] Erro ao verificar usuário:', err);
    return { success: false, error: 'SERVER_ERROR' };
  }
}

export async function verifyUser(username: string, password: string): Promise<User | null> {
  const res = await verifyUserCredentials(username, password);
  return res.success ? res.user : null;
}

// Database-backed IP & Username Lockout (Persists across Incognito & all browsers)
let loginAttemptsMigrated = false;
export async function ensureLoginAttemptsSchema(): Promise<void> {
  if (loginAttemptsMigrated) return;
  try {
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        identifier TEXT PRIMARY KEY,
        attempts INTEGER DEFAULT 0,
        locked_until INTEGER DEFAULT 0,
        last_attempt_at TEXT
      )
    `);
  } catch (err) {
    console.warn('Erro ao criar tabela login_attempts:', err);
  }
  loginAttemptsMigrated = true;
}

export function computeLockoutSeconds(attempts: number): number {
  if (attempts < 5) return 0;
  if (attempts === 5) return 30; // 5ª tentativa: 30s
  if (attempts === 6) return 60; // 6ª tentativa: 1 min
  if (attempts === 7) return 120; // 7ª tentativa: 2 min
  if (attempts === 8) return 300; // 8ª tentativa: 5 min
  return 600; // 9ª tentativa em diante: 10 min
}

export interface LockoutCheckResult {
  locked: boolean;
  remainingSeconds: number;
  attempts: number;
}

export async function checkLockout(ip: string, username?: string): Promise<LockoutCheckResult> {
  await ensureLoginAttemptsSchema();
  try {
    const identifiers = [`ip:${ip.trim()}`];
    if (username && username.trim()) {
      identifiers.push(`user:${username.trim().toLowerCase()}`);
    }

    let maxLockedUntil = 0;
    let maxAttempts = 0;

    for (const id of identifiers) {
      const { rows } = await turso.execute({
        sql: 'SELECT attempts, locked_until FROM login_attempts WHERE identifier = ?',
        args: [id],
      });
      if (rows.length > 0) {
        const row = rows[0];
        const attempts = Number(row.attempts) || 0;
        const lockedUntil = Number(row.locked_until) || 0;
        if (attempts > maxAttempts) maxAttempts = attempts;
        if (lockedUntil > maxLockedUntil) maxLockedUntil = lockedUntil;
      }
    }

    const now = Date.now();
    if (maxLockedUntil > now) {
      const remainingSeconds = Math.max(1, Math.ceil((maxLockedUntil - now) / 1000));
      return { locked: true, remainingSeconds, attempts: maxAttempts };
    }

    return { locked: false, remainingSeconds: 0, attempts: maxAttempts };
  } catch (err) {
    console.error('[Lockout] Erro ao verificar bloqueio:', err);
    return { locked: false, remainingSeconds: 0, attempts: 0 };
  }
}

export async function recordFailedLogin(ip: string, username: string): Promise<LockoutCheckResult> {
  await ensureLoginAttemptsSchema();
  const now = Date.now();
  const nowIso = new Date().toISOString();
  const identifiers = [`ip:${ip.trim()}`];
  if (username && username.trim()) {
    identifiers.push(`user:${username.trim().toLowerCase()}`);
  }

  let highestAttempts = 0;
  let highestLockedUntil = 0;

  for (const id of identifiers) {
    let currentAttempts = 0;
    const { rows } = await turso.execute({
      sql: 'SELECT attempts, locked_until FROM login_attempts WHERE identifier = ?',
      args: [id],
    });
    if (rows.length > 0) {
      currentAttempts = Number(rows[0].attempts) || 0;
    }
    const newAttempts = currentAttempts + 1;
    let newLockedUntil = 0;
    if (newAttempts >= 5) {
      const durationSec = computeLockoutSeconds(newAttempts);
      newLockedUntil = now + durationSec * 1000;
    }

    if (newAttempts > highestAttempts) highestAttempts = newAttempts;
    if (newLockedUntil > highestLockedUntil) highestLockedUntil = newLockedUntil;

    await turso.execute({
      sql: `INSERT INTO login_attempts (identifier, attempts, locked_until, last_attempt_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(identifier) DO UPDATE SET
              attempts = ?,
              locked_until = ?,
              last_attempt_at = ?`,
      args: [id, newAttempts, newLockedUntil, nowIso, newAttempts, newLockedUntil, nowIso],
    });
  }

  const remainingSeconds = highestLockedUntil > now
    ? Math.max(1, Math.ceil((highestLockedUntil - now) / 1000))
    : 0;

  return {
    locked: remainingSeconds > 0,
    remainingSeconds,
    attempts: highestAttempts,
  };
}

export async function recordSuccessfulLogin(ip: string, username: string): Promise<void> {
  await ensureLoginAttemptsSchema();
  const identifiers = [`ip:${ip.trim()}`];
  if (username && username.trim()) {
    identifiers.push(`user:${username.trim().toLowerCase()}`);
  }
  for (const id of identifiers) {
    try {
      await turso.execute({
        sql: 'DELETE FROM login_attempts WHERE identifier = ?',
        args: [id],
      });
    } catch {}
  }
}