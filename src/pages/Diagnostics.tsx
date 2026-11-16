import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { turso, hashPassword, compareHash } from '../lib/turso';
import {
  createUser,
  deleteUser,
  listUsers,
  upsertGuest,
  listGuests,
  getGuest,
  deleteGuest,
  addAudit,
  listAudit,
} from '../services/guests';
import { Play, CheckCircle2, XCircle, Loader2, Server, Database } from 'lucide-react';
import { toast } from 'sonner';

interface DiagnosticResult {
  name: string;
  status: 'ok' | 'error';
  detail?: string;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export default function DiagnosticsPage() {
  const { user } = useAuth();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);

  async function runDiagnostics(includeWriteTests = false) {
    setRunning(true);
    setResults([]);

    const addResult = (res: DiagnosticResult) => {
      setResults(prev => [...prev, res]);
    };

    try {
      // 1. Env Turso
      const hasUrl = Boolean((import.meta.env.VITE_TURSO_DATABASE_URL as string)?.trim());
      const hasToken = Boolean((import.meta.env.VITE_TURSO_AUTH_TOKEN as string)?.trim());
      if (hasUrl && hasToken) {
        addResult({ name: 'Variáveis de Ambiente (Turso LibSQL)', status: 'ok', detail: 'Credenciais configuradas no ambiente.' });
      } else {
        addResult({ name: 'Variáveis de Ambiente (Turso LibSQL)', status: 'error', detail: 'Variáveis VITE_TURSO_* ausentes no .env.' });
      }

      // 2. Table users
      try {
        const usersList = await listUsers();
        const adminCount = usersList.filter(u => u.role === 'admin').length;
        addResult({
          name: 'Tabela: users',
          status: adminCount > 0 ? 'ok' : 'error',
          detail: `${usersList.length} usuário(s) ativo(s) (${adminCount} administrador(es)).`,
        });
      } catch (err: unknown) {
        addResult({ name: 'Tabela: users', status: 'error', detail: getErrorMessage(err) });
      }

      // 3. Table settings
      try {
        await turso.execute('SELECT id FROM settings LIMIT 1');
        addResult({ name: 'Tabela: settings', status: 'ok', detail: 'Configurações de alerta e capacidade disponíveis.' });
      } catch (err: unknown) {
        addResult({ name: 'Tabela: settings', status: 'error', detail: getErrorMessage(err) });
      }

      // 4. Table guests
      try {
        const guestsList = await listGuests();
        addResult({ name: 'Tabela: guests', status: 'ok', detail: `Estrutura ativa (${guestsList.length} hóspedes registrados).` });
      } catch (err: unknown) {
        addResult({ name: 'Tabela: guests', status: 'error', detail: getErrorMessage(err) });
      }

      // 5. Table audit_logs
      try {
        await turso.execute('SELECT id FROM audit_logs LIMIT 1');
        addResult({ name: 'Tabela: audit_logs', status: 'ok', detail: 'Sistema de auditoria ativo.' });
      } catch (err: unknown) {
        addResult({ name: 'Tabela: audit_logs', status: 'error', detail: getErrorMessage(err) });
      }

      // 6. Cryptographic Hash Integrity (without hardcoded passwords)
      try {
        const probe = `diag_${crypto.randomUUID().slice(0, 8)}`;
        const hashed = await hashPassword(probe);
        const matches = await compareHash(probe, hashed);
        addResult({
          name: 'Motor Criptográfico (Salted SHA-256)',
          status: matches ? 'ok' : 'error',
          detail: matches ? 'Geração de salt e verificação íntegras.' : 'Falha na verificação de hash.',
        });
      } catch (err: unknown) {
        addResult({ name: 'Motor Criptográfico (Salted SHA-256)', status: 'error', detail: getErrorMessage(err) });
      }

      if (includeWriteTests) {
        // 7. CRUD users
        try {
          const diagUsername = `diag_user_${crypto.randomUUID().slice(0, 8)}`;
          const randomSecret = crypto.randomUUID();
          const createdUser = await createUser(diagUsername, randomSecret, 'funcionario');
          addResult({ name: 'Gravação: Criar Usuário Temporário', status: 'ok', detail: `Criado ${createdUser.username}` });

          const userList = await listUsers();
          const found = userList.find(u => u.username === diagUsername);
          addResult({
            name: 'Gravação: Listar Usuários',
            status: found ? 'ok' : 'error',
            detail: found ? 'Usuário localizado na listagem.' : 'Usuário não encontrado após criação.',
          });

          await deleteUser(createdUser.id);
          const userListAfter = await listUsers();
          const stillExists = userListAfter.find(u => u.username === diagUsername);
          addResult({
            name: 'Gravação: Excluir Usuário Temporário',
            status: stillExists ? 'error' : 'ok',
            detail: stillExists ? 'Usuário ainda presente após exclusão.' : 'Removido com sucesso.',
          });
        } catch (err: unknown) {
          addResult({ name: 'Gravação de Usuários', status: 'error', detail: getErrorMessage(err) });
        }

        // 8. CRUD guests (with complete cleanup including audit_logs)
        const testGuestId = crypto.randomUUID();
        try {
          await upsertGuest({
            id: testGuestId,
            name: 'DIAG Teste Temporário',
            dateOfBirth: '1990-01-01',
            phone: '(62) 99999-9999',
            cpf: '000.000.000-00',
            status: 'presente',
          });
          addResult({ name: 'Gravação: Criar Hóspede Temporário', status: 'ok', detail: `ID=${testGuestId.slice(0, 8)}...` });

          const fetched = await getGuest(testGuestId);
          addResult({
            name: 'Gravação: Buscar Hóspede',
            status: fetched ? 'ok' : 'error',
            detail: fetched ? `Nome: ${fetched.name}` : 'Não encontrado via busca.',
          });

          const now = new Date().toISOString();
          await addAudit({
            id: crypto.randomUUID(),
            guestId: testGuestId,
            toStatus: 'presente',
            at: now,
            byUser: user?.username || 'diagnostic',
            note: 'Entrada de auditoria de diagnóstico.',
          });

          const auditLogs = await listAudit(testGuestId);
          const hasDiagAudit = auditLogs.some(
            a => a.note?.includes('diagnóstico') || a.note?.includes('diagnostic')
          );
          addResult({
            name: 'Gravação: Auditoria do Hóspede',
            status: hasDiagAudit ? 'ok' : 'error',
            detail: hasDiagAudit ? `Registros verificados (${auditLogs.length})` : 'Sem registro de diagnóstico.',
          });

          await deleteGuest(testGuestId);
          await turso.execute({ sql: 'DELETE FROM audit_logs WHERE guest_id = ?', args: [testGuestId] });
          const fetchedAfter = await getGuest(testGuestId);
          addResult({
            name: 'Gravação: Limpeza de Registro Temporário',
            status: fetchedAfter ? 'error' : 'ok',
            detail: fetchedAfter ? 'Ainda existe após exclusão.' : 'Hóspede e registros de teste removidos com sucesso.',
          });
        } catch (err: unknown) {
          try {
            await deleteGuest(testGuestId);
            await turso.execute({ sql: 'DELETE FROM audit_logs WHERE guest_id = ?', args: [testGuestId] });
          } catch {
            // ignore cleanup error
          }
          addResult({ name: 'Gravação de Hóspedes', status: 'error', detail: getErrorMessage(err) });
        }
      }

      toast.success('Verificação de diagnóstico concluída!');
    } finally {
      setRunning(false);
    }
  }

  const okCount = results.filter(r => r.status === 'ok').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  return (
    <div className="container-page py-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:min-h-[44px]">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
            Diagnóstico do Sistema
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Teste automatizado de integridade de banco de dados, autenticação e gravação
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-secondary cursor-pointer"
            disabled={running}
            onClick={() => runDiagnostics(true)}
          >
            <Database className="h-3.5 w-3.5" />
            <span>Testar Escrita (Banco)</span>
          </button>

          <button
            type="button"
            className="btn-primary cursor-pointer"
            disabled={running}
            onClick={() => runDiagnostics(false)}
          >
            {running ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Executando...</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                <span>Verificar Saúde (Leitura)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
          <div className="card p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">Testes com Sucesso</p>
            <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{okCount}</p>
          </div>

          <div className="card p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">Falhas</p>
            <p className="text-2xl font-semibold text-rose-600 dark:text-rose-400 tabular-nums">{errorCount}</p>
          </div>

          <div className="card p-4 col-span-2 sm:col-span-1">
            <p className="text-xs text-slate-500 font-medium mb-1">Total Executado</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">{results.length}</p>
          </div>
        </div>
      )}

      {/* Results List */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Resultados das Verificações
          </h2>
          <span className="text-xs text-slate-400">Banco Turso (LibSQL SQLite)</span>
        </div>

        {results.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Server className="h-7 w-7 text-slate-300 dark:text-slate-600 mx-auto mb-1.5" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Nenhum teste executado ainda
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Clique em "Executar Diagnóstico" para iniciar as validações.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {results.map((r, i) => (
              <li
                key={i}
                className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 rounded-md px-2.5 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  {r.status === 'ok' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  <div>
                    <span className="font-medium text-sm text-slate-900 dark:text-white">
                      {r.name}
                    </span>
                    {r.detail && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                        {r.detail}
                      </p>
                    )}
                  </div>
                </div>

                <span
                  className={
                    r.status === 'ok'
                      ? 'badge-green'
                      : 'badge-red'
                  }
                >
                  {r.status === 'ok' ? 'SUCESSO' : 'ERRO'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
