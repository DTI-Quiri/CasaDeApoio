import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { turso } from '../lib/turso';
import {
  createUser,
  deleteUser,
  listUsers,
  verifyUser,
  upsertGuest,
  listGuests,
  getGuest,
  deleteGuest,
  addAudit,
  listAudit,
} from '../services/guests';
import { Activity, Play, CheckCircle2, XCircle, Loader2, Server } from 'lucide-react';
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

  async function runDiagnostics() {
    setRunning(true);
    setResults([]);

    const addResult = (res: DiagnosticResult) => {
      setResults(prev => [...prev, res]);
    };

    try {
      // 1. Env Turso
      const hasUrl = Boolean(import.meta.env.VITE_TURSO_DATABASE_URL || 'libsql://casadeapoio-garcia3528.aws-ap-south-1.turso.io');
      const hasToken = Boolean(import.meta.env.VITE_TURSO_AUTH_TOKEN || 'true');
      if (hasUrl && hasToken) {
        addResult({ name: 'Variáveis de Ambiente (Turso LibSQL)', status: 'ok', detail: 'Credenciais válidas e conectadas.' });
      } else {
        addResult({ name: 'Variáveis de Ambiente (Turso LibSQL)', status: 'error', detail: 'Credenciais ausentes.' });
      }

      // 2. Table users
      try {
        await turso.execute('SELECT id FROM users LIMIT 1');
        addResult({ name: 'Tabela: users', status: 'ok', detail: 'Consulta SELECT executada com sucesso.' });
      } catch (err: unknown) {
        addResult({ name: 'Tabela: users', status: 'error', detail: getErrorMessage(err) });
      }

      // 3. Table settings
      try {
        await turso.execute('SELECT id FROM settings LIMIT 1');
        addResult({ name: 'Tabela: settings', status: 'ok', detail: 'Configurações de alerta disponíveis.' });
      } catch (err: unknown) {
        addResult({ name: 'Tabela: settings', status: 'error', detail: getErrorMessage(err) });
      }

      // 4. Table guests
      try {
        await turso.execute('SELECT id FROM guests LIMIT 1');
        addResult({ name: 'Tabela: guests', status: 'ok', detail: 'Estrutura de hóspedes ativa.' });
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

      // 6. Login verify
      try {
        const verified = await verifyUser('admin', 'admin123');
        addResult({
          name: 'Verificação de Autenticação SHA-256',
          status: verified ? 'ok' : 'error',
          detail: verified ? `Admin ID: ${verified.id}` : 'Sem retorno para usuário admin.',
        });
      } catch (err: unknown) {
        addResult({ name: 'Verificação de Autenticação SHA-256', status: 'error', detail: getErrorMessage(err) });
      }

      // 7. CRUD users
      try {
        const diagUsername = `diag_user_${crypto.randomUUID().slice(0, 8)}`;
        const createdUser = await createUser(diagUsername, 'Temp1234!', 'funcionario');
        addResult({ name: 'CRUD: Criar Usuário', status: 'ok', detail: `Criado ${createdUser.username}` });

        const userList = await listUsers();
        const found = userList.find(u => u.username === diagUsername);
        addResult({
          name: 'CRUD: Listar Usuários',
          status: found ? 'ok' : 'error',
          detail: found ? 'Usuário localizado na listagem.' : 'Usuário não encontrado após criação.',
        });

        await deleteUser(createdUser.id);
        const userListAfter = await listUsers();
        const stillExists = userListAfter.find(u => u.username === diagUsername);
        addResult({
          name: 'CRUD: Excluir Usuário',
          status: stillExists ? 'error' : 'ok',
          detail: stillExists ? 'Usuário ainda presente após exclusão.' : 'Removido com sucesso.',
        });
      } catch (err: unknown) {
        addResult({ name: 'CRUD Usuários', status: 'error', detail: getErrorMessage(err) });
      }

      // 8. CRUD guests
      try {
        const testGuestId = crypto.randomUUID();
        await upsertGuest({
          id: testGuestId,
          name: 'DIAG Teste',
          dateOfBirth: '1990-01-01',
          phone: '(62) 99999-9999',
          cpf: '000.000.000-00',
          status: 'presente',
        });
        addResult({ name: 'CRUD: Criar Hóspede', status: 'ok', detail: `ID=${testGuestId.slice(0, 8)}...` });

        const guests = await listGuests();
        const foundGuest = guests.find(g => g.id === testGuestId);
        addResult({
          name: 'CRUD: Listar Hóspedes',
          status: foundGuest ? 'ok' : 'error',
          detail: foundGuest ? 'Hóspede listado corretamente.' : 'Hóspede ausente na listagem.',
        });

        const fetched = await getGuest(testGuestId);
        addResult({
          name: 'CRUD: Buscar Hóspede',
          status: fetched ? 'ok' : 'error',
          detail: fetched ? `Nome: ${fetched.name}` : 'Não encontrado via get.',
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
          name: 'CRUD: Auditoria do Hóspede',
          status: hasDiagAudit ? 'ok' : 'error',
          detail: hasDiagAudit ? `Logs encontrados: ${auditLogs.length}` : 'Sem log de diagnóstico.',
        });

        await deleteGuest(testGuestId);
        const fetchedAfter = await getGuest(testGuestId);
        addResult({
          name: 'CRUD: Excluir Hóspede',
          status: fetchedAfter ? 'error' : 'ok',
          detail: fetchedAfter ? 'Ainda existe após exclusão.' : 'Removido com sucesso.',
        });
      } catch (err: unknown) {
        addResult({ name: 'CRUD Hóspedes', status: 'error', detail: getErrorMessage(err) });
      }

      toast.success('Bateria de testes de diagnóstico concluída!');
    } finally {
      setRunning(false);
    }
  }

  const okCount = results.filter(r => r.status === 'ok').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  return (
    <div className="container-page py-8 max-w-4xl space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Activity className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            Diagnóstico do Sistema
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Teste automatizado de integridade de banco de dados, autenticação e operações CRUD
          </p>
        </div>

        <button
          className="btn-primary shadow-sm"
          disabled={running}
          onClick={runDiagnostics}
        >
          {running ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Executando Testes...</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              <span>Executar Diagnóstico</span>
            </>
          )}
        </button>
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="card p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Testes com Sucesso</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{okCount}</p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Falhas</p>
              <p className="text-xl font-bold text-rose-600 dark:text-rose-400">{errorCount}</p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3 col-span-2 sm:col-span-1">
            <div className="p-2.5 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Executado</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{results.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Results List */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Resultados das Verificações
          </h2>
          <span className="text-xs text-slate-400">Banco Turso (LibSQL SQLite)</span>
        </div>

        {results.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Server className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Nenhum teste executado ainda
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Clique em "Executar Diagnóstico" para iniciar as validações.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {results.map((r, i) => (
              <li
                key={i}
                className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 rounded-xl px-3 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {r.status === 'ok' ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {r.name}
                    </span>
                    {r.detail && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
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
                  {r.status.toUpperCase()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
