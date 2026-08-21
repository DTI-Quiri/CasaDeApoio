import { useEffect, useState, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  getGuest as getGuestSvc,
  listAudit as listAuditSvc,
  upsertGuest as upsertGuestSvc,
  addAudit as addAuditSvc,
  changeStatus as changeStatusSvc,
  deleteGuest as deleteGuestSvc,
  undoCheckout as undoCheckoutSvc,
  startNewStay as startNewStaySvc,
} from '../services/guests';
import type { AuditEntry, Guest, Companion } from '../types';
import { calculateAge, formatCPF, formatSUS } from '../utils/cpf';
import { parseCompanions, formatCompanionsList } from '../utils/companion';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { toast } from 'sonner';
import DateInput from '../components/DateInput';
import {
  ArrowLeft,
  User,
  Users,
  Stethoscope,
  MapPin,
  History,
  Clock,
  Save,
  Loader2,
  Trash2,
  Plus,
  RotateCcw,
  PlusCircle,
} from 'lucide-react';
import SmartAutocomplete from '../components/SmartAutocomplete';
import ConfirmModal from '../components/ConfirmModal';
import WhatsAppButton from '../components/WhatsAppButton';
import { MEDICAL_LOCATIONS, PROCEDURE_SUGGESTIONS } from '../data/medicalLocations';

const hospitalOptions = MEDICAL_LOCATIONS.map(loc => ({
  label: loc.name,
  badge: `${loc.city} • ${loc.type}`,
  category: loc.category,
}));

const labelMap: Record<string, string> = {
  name: 'Nome Completo',
  dateOfBirth: 'Data de Nascimento',
  phone: 'Celular',
  cpf: 'CPF',
  susCard: 'Nº do Cartão do SUS',
  hasCompanion: 'Possui Acompanhante',
  companions: 'Acompanhante(s)',
  reason: 'Procedimento / Motivo',
  responsible: 'Responsável',
  medicalNotes: 'Hospital / Clínica',
  medicalType: 'Tipo de Atendimento',
  medicalStatus: 'Pendência Médica',
  addressZip: 'CEP',
  addressState: 'Estado (UF)',
  addressCity: 'Cidade',
  addressNeighborhood: 'Bairro',
  addressStreet: 'Rua / Logradouro',
  addressNumber: 'Número',
  addressComplement: 'Complemento',
};

function formatAuditValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') {
    return value ? 'Sim' : 'Não';
  }
  if (key === 'hasCompanion') {
    return value === true || value === 'true' || value === 1 ? 'Sim' : 'Não';
  }
  if (key === 'medicalStatus') {
    if (value === 'aguardando') return 'Aguardando atendimento';
    if (value === 'concluida') return 'Concluída';
  }
  if (key === 'medicalType') {
    if (value === 'consulta') return 'Consulta';
    if (value === 'exame') return 'Exame';
    if (value === 'cirurgia') return 'Cirurgia';
    if (value === 'outro') return 'Outro';
  }
  if (key === 'status') {
    if (value === 'presente') return 'Presente na casa';
    if (value === 'finalizado') return 'Finalizado';
  }
  if (key === 'companions') {
    return formatCompanionsList(value as Companion[]) || 'Nenhum';
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : 'Nenhum';
  }
  return String(value);
}

function cleanAuditNote(note?: string): string {
  if (!note) return '';
  return note
    .replace(/"true"/gi, '"Sim"')
    .replace(/"false"/gi, '"Não"');
}

export default function GuestDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [g, setG] = useState<Guest | undefined>(undefined);
  const [orig, setOrig] = useState<Guest | undefined>(undefined);
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      setLoading(true);
      try {
        const found = await getGuestSvc(id);
        if (found) {
          const comps = parseCompanions(found.companions);
          found.companions = found.hasCompanion && comps.length === 0 ? [{ name: '', cpf: '' }] : comps;
        }
        setG(found);
        setOrig(found);
        const l = await listAuditSvc(id);
        setLogs(l);
      } catch {
        toast.error('Erro ao carregar hóspede.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const hasUnsavedChanges = useMemo(() => {
    if (!g || !orig) return false;
    const fields: (keyof Guest)[] = [
      'name',
      'dateOfBirth',
      'phone',
      'cpf',
      'susCard',
      'hasCompanion',
      'companions',
      'reason',
      'responsible',
      'medicalNotes',
      'medicalStatus',
      'addressZip',
      'addressState',
      'addressCity',
      'addressNeighborhood',
      'addressStreet',
      'addressNumber',
      'addressComplement',
    ];
    return fields.some(k => {
      const prevVal = orig[k];
      const nextVal = g[k];
      const prevStr = typeof prevVal === 'object' ? JSON.stringify(prevVal) : String(prevVal ?? '');
      const nextStr = typeof nextVal === 'object' ? JSON.stringify(nextVal) : String(nextVal ?? '');
      return prevStr !== nextStr;
    });
  }, [g, orig]);

  const age = g?.dateOfBirth ? calculateAge(g.dateOfBirth) : null;
  const isMinor = age !== null && age < 18;

  async function handleDeleteGuest() {
    if (!g) return;
    try {
      setDeleteLoading(true);
      await deleteGuestSvc(g.id);
      toast.success('Hóspede excluído com sucesso.');
      navigate('/dashboard', { replace: true });
    } catch {
      toast.error('Erro ao excluir hóspede.');
    } finally {
      setDeleteLoading(false);
      setDeleteModalOpen(false);
    }
  }

  function updateLocalField<K extends keyof Guest>(key: K, value: Guest[K]) {
    if (!g) return;
    setG({ ...g, [key]: value });
  }

  function handleToggleHasCompanion(checked: boolean) {
    if (!g) return;
    const currentComps = parseCompanions(g.companions);
    const nextComps = checked
      ? currentComps.length > 0
        ? currentComps
        : [{ name: '', cpf: '' }]
      : [];
    setG({
      ...g,
      hasCompanion: checked,
      companions: nextComps,
    });
  }

  function handleAddCompanion() {
    if (!g) return;
    const current = parseCompanions(g.companions);
    const next = [...current, { name: '', cpf: '' }];
    setG({
      ...g,
      hasCompanion: true,
      companions: next,
    });
  }

  function handleRemoveCompanion(index: number) {
    if (!g) return;
    const current = parseCompanions(g.companions);
    const next = current.filter((_, i) => i !== index);
    setG({
      ...g,
      hasCompanion: next.length > 0,
      companions: next,
    });
  }

  function handleUpdateCompanion(index: number, field: 'name' | 'cpf', val: string) {
    if (!g) return;
    const current = parseCompanions(g.companions).map(c => ({ ...c }));
    while (current.length <= index) {
      current.push({ name: '', cpf: '' });
    }
    current[index][field] = val;
    setG({
      ...g,
      companions: current,
    });
  }

  function handleDiscardChanges() {
    if (orig) {
      setG(orig);
      toast.info('Alterações descartadas.');
    }
  }

  async function handleSaveAll() {
    if (!user || !g || !orig) return;

    if (!g.name.trim()) {
      toast.error('O nome do hóspede não pode ficar vazio.');
      return;
    }

    try {
      setSaving(true);
      const cleanedCompanions = parseCompanions(g.companions, true);
      const guestToSave: Guest = {
        ...g,
        hasCompanion: g.hasCompanion && cleanedCompanions.length > 0,
        companions: cleanedCompanions,
      };

      const fields: (keyof Guest)[] = [
        'name',
        'dateOfBirth',
        'phone',
        'cpf',
        'susCard',
        'hasCompanion',
        'companions',
        'reason',
        'responsible',
        'medicalNotes',
        'medicalStatus',
        'addressZip',
        'addressState',
        'addressCity',
        'addressNeighborhood',
        'addressStreet',
        'addressNumber',
        'addressComplement',
      ];

      const newAuditEntries: AuditEntry[] = [];
      const now = new Date().toISOString();

      for (const k of fields) {
        const prevVal = orig[k];
        const nextVal = guestToSave[k];
        const prevStr = typeof prevVal === 'object' ? JSON.stringify(prevVal) : String(prevVal ?? '');
        const nextStr = typeof nextVal === 'object' ? JSON.stringify(nextVal) : String(nextVal ?? '');

        if (prevStr !== nextStr) {
          const prevDisplay = formatAuditValue(String(k), prevVal);
          const nextDisplay = formatAuditValue(String(k), nextVal);
          const note = `Alterou ${labelMap[String(k)] || String(k)} de "${prevDisplay}" para "${nextDisplay}"`;
          const entry: AuditEntry = {
            id: crypto.randomUUID(),
            guestId: guestToSave.id,
            toStatus: guestToSave.status,
            at: now,
            byUser: user.username,
            note,
          };
          newAuditEntries.push(entry);
        }
      }

      if (newAuditEntries.length === 0) {
        toast.info('Nenhuma alteração detectada.');
        return;
      }

      await upsertGuestSvc(guestToSave);

      for (const entry of newAuditEntries) {
        await addAuditSvc(entry);
      }

      setG(guestToSave);
      setOrig(guestToSave);
      setLogs(prev => [...newAuditEntries, ...prev]);
      toast.success('Alterações salvas com sucesso!');
    } catch {
      toast.error('Erro ao salvar ficha do hóspede.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmCheckout() {
    if (!user || !g) return;
    try {
      setCheckoutLoading(true);
      const next = await changeStatusSvc(g, 'finalizado', user.username);
      setG(next);
      setOrig(next);
      const l = await listAuditSvc(g.id);
      setLogs(l);
      setCheckoutModalOpen(false);
      toast.success(`Estadia de "${g.name}" finalizada com sucesso!`, {
        action: {
          label: 'Desfazer',
          onClick: () => handleUndoCheckout(),
        },
        duration: 8000,
      });
    } catch {
      toast.error('Erro ao finalizar estadia.');
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handleUndoCheckout() {
    if (!user || !g) return;
    try {
      const next = await undoCheckoutSvc(g, user.username);
      setG(next);
      setOrig(next);
      const l = await listAuditSvc(g.id);
      setLogs(l);
      toast.success(`Finalização desfeita! "${g.name}" está marcado como Presente.`);
    } catch {
      toast.error('Erro ao desfazer finalização.');
    }
  }

  async function handleStartNewStay() {
    if (!user || !g) return;
    try {
      const next = await startNewStaySvc(g, user.username);
      setG(next);
      setOrig(next);
      const l = await listAuditSvc(g.id);
      setLogs(l);
      toast.success(`Nova estadia iniciada para "${g.name}"!`);
    } catch {
      toast.error('Erro ao iniciar nova estadia.');
    }
  }

  if (loading) {
    return (
      <div className="container-page py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        <p className="text-sm font-medium">Carregando ficha do hóspede...</p>
      </div>
    );
  }

  if (!g) {
    return (
      <div className="container-page py-12 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Hóspede não encontrado
        </h2>
        <p className="text-sm text-slate-500">
          O registro solicitado não existe ou foi removido.
        </p>
        <Link className="btn-primary" to="/dashboard">
          Voltar ao Painel
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page py-8 space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
            title="Voltar ao Painel"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Ficha do Hóspede
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Detalhes cadastrais, informações de atendimento e histórico
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
          <Link
            to={`/hospedes/${g.id}/historico`}
            className="btn-secondary text-xs sm:text-sm font-medium justify-center"
          >
            <History className="h-4 w-4 text-slate-500" />
            <span>Ver Linha do Tempo</span>
          </Link>
          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            className="btn-secondary text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs sm:text-sm font-semibold justify-center"
            title="Excluir este hóspede"
          >
            <Trash2 className="h-4 w-4" />
            <span>Excluir</span>
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className={`text-xs sm:text-sm font-semibold shadow-sm transition-all justify-center ${
              hasUnsavedChanges
                ? 'btn-primary ring-4 ring-brand-500/20 animate-pulse'
                : 'btn-primary'
            }`}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>{hasUnsavedChanges ? 'Salvar *' : 'Salvar'}</span>
          </button>
        </div>
      </div>

      {/* Profile Overview Card */}
      <div className="card p-6 sm:p-7 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 text-white flex items-center justify-center text-xl sm:text-2xl font-extrabold shadow-md ring-4 ring-brand-500/10 shrink-0">
              {g.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">
                  {g.name}
                </h2>
                <StatusBadge status={g.status} />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] sm:text-xs text-slate-500 mt-1">
                <span>CPF: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{g.cpf}</strong></span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  Celular: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{g.phone || '-'}</strong>
                  {g.phone && <WhatsAppButton phone={g.phone} name={g.name} />}
                </span>
                <span>•</span>
                <span>Idade: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{age !== null ? `${age} anos` : '-'}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {g.status !== 'presente' ? (
              <>
                <button
                  type="button"
                  className="btn-secondary text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 py-2 px-3.5 text-xs font-semibold"
                  onClick={handleUndoCheckout}
                  title="Desfazer check-out e reabrir a estadia que foi finalizada por engano"
                >
                <RotateCcw className="h-4 w-4" />
                  <span className="hidden sm:inline">Reabrir Estadia (Desfazer Saída)</span>
                  <span className="sm:hidden">Reabrir</span>
                </button>
                <button
                  type="button"
                  className="btn-success py-2 px-3.5 text-xs font-semibold"
                  onClick={handleStartNewStay}
                  title="Iniciar um novo atendimento com data e hora de hoje"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Iniciar Nova Estadia</span>
                  <span className="sm:hidden">Nova Estadia</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-secondary text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 py-2 px-4 text-xs font-semibold"
                onClick={() => setCheckoutModalOpen(true)}
              >
                <Clock className="h-4 w-4" />
                Finalizar Estadia (Check-out)
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div>
            <span className="label">Check-in Atual</span>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {g.checkInAt ? new Date(g.checkInAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
            </p>
          </div>
          <div>
            <span className="label">Check-out</span>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {g.checkOutAt ? new Date(g.checkOutAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Em aberto'}
            </p>
          </div>
          <div>
            <span className="label">Acompanhantes</span>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {g.hasCompanion ? (formatCompanionsList(g.companions) || 'Sim (não nominado)') : 'Nenhum'}
            </p>
          </div>
          <div>
            <span className="label">Cidade de Origem</span>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {g.addressCity ? `${g.addressCity} - ${g.addressState || ''}` : 'Quirinópolis - GO'}
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Dados Pessoais */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <User className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Dados Pessoais
            </h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="label">Nome Completo</label>
              <input
                className="input"
                value={g.name}
                onChange={e => updateLocalField('name', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">CPF</label>
                <input
                  className="input"
                  value={g.cpf}
                  onChange={e => updateLocalField('cpf', formatCPF(e.target.value))}
                />
              </div>
              <div>
                <label className="label">Nº Cartão do SUS</label>
                <input
                  className="input"
                  value={g.susCard || ''}
                  onChange={e => updateLocalField('susCard', formatSUS(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label flex items-center justify-between">
                  <span>Telefone</span>
                  <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500 normal-case">
                    (DDD) 9+NUMERO
                  </span>
                </label>
                <input
                  className="input"
                  value={g.phone}
                  onChange={e => updateLocalField('phone', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Data de Nascimento</label>
                <DateInput
                  value={g.dateOfBirth}
                  onChange={val => updateLocalField('dateOfBirth', val)}
                />
              </div>
            </div>

            {isMinor && (
              <div>
                <label className="label">Responsável pelo Menor</label>
                <input
                  className="input"
                  value={g.responsible || ''}
                  onChange={e => updateLocalField('responsible', e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Atendimento e Saúde */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Stethoscope className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Atendimento e Saúde
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label">Procedimento / O que o hóspede irá fazer</label>
              <SmartAutocomplete
                value={g.reason || ''}
                onChange={val => updateLocalField('reason', val)}
                options={PROCEDURE_SUGGESTIONS}
              />
            </div>

            <div>
              <label className="label">Hospital / Clínica / Centro de Atendimento (Goiânia e Aparecida de Goiânia)</label>
              <SmartAutocomplete
                value={g.medicalNotes || ''}
                onChange={val => updateLocalField('medicalNotes', val)}
                options={hospitalOptions}
                emptyText="Hospital/Clínica não listado. Pressione Enter para usar o nome digitado."
              />
            </div>

            <div>
              <label className="label flex items-center justify-between">
                <span>Status da Pendência Médica</span>
                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 normal-case">(Opcional)</span>
              </label>
              <select
                className="input"
                value={g.medicalStatus || 'aguardando'}
                onChange={e => updateLocalField('medicalStatus', e.target.value as Guest['medicalStatus'])}
              >
                <option value="aguardando">Aguardando atendimento</option>
                <option value="concluida">Atendimento concluído</option>
              </select>
            </div>
          </div>
        </div>

        {/* Card 3: Acompanhantes */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Acompanhante(s)
              </h3>
            </div>
            {g.hasCompanion && (
              <span className="badge-yellow">
                {parseCompanions(g.companions).length}{' '}
                {parseCompanions(g.companions).length === 1 ? 'acompanhante' : 'acompanhantes'}
              </span>
            )}
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                checked={!!g.hasCompanion}
                onChange={e => handleToggleHasCompanion(e.target.checked)}
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Possui acompanhante nesta estadia
              </span>
            </label>

            {g.hasCompanion && (
              <div className="space-y-3 pt-1 animate-in fade-in duration-200">
                {(parseCompanions(g.companions).length > 0
                  ? parseCompanions(g.companions)
                  : [{ name: '', cpf: '' }]
                ).map((comp, idx, arr) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800/80 space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-[11px] font-bold">
                          {idx + 1}
                        </span>
                        {idx + 1}º Acompanhante
                      </span>
                      {arr.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCompanion(idx)}
                          className="text-xs font-semibold text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 flex items-center gap-1 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Remover este acompanhante"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remover</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-7">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">
                          Nome do Acompanhante
                        </label>
                        <input
                          className="input py-2 text-sm"
                          value={comp.name || ''}
                          onChange={e => handleUpdateCompanion(idx, 'name', e.target.value)}
                        />
                      </div>

                      <div className="sm:col-span-5">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
                          <span>CPF</span>
                          <span className="text-[10px] text-slate-400 font-normal">(Opcional)</span>
                        </label>
                        <input
                          className="input py-2 text-sm"
                          value={comp.cpf || ''}
                          maxLength={14}
                          onChange={e => handleUpdateCompanion(idx, 'cpf', formatCPF(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddCompanion}
                  className="btn-secondary py-2.5 px-4 text-xs font-semibold w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 transition-all cursor-pointer shadow-xs"
                >
                  <Plus className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  <span>
                    Adicionar outro acompanhante (
                    {(parseCompanions(g.companions).length || 1) + 1}º)
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Endereço */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Endereço
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">CEP</label>
              <input
                className="input"
                value={g.addressZip || ''}
                onChange={e => updateLocalField('addressZip', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="label">Cidade</label>
                <input
                  className="input"
                  value={g.addressCity || ''}
                  onChange={e => updateLocalField('addressCity', e.target.value)}
                />
              </div>
              <div>
                <label className="label">UF</label>
                <input
                  className="input"
                  value={g.addressState || ''}
                  onChange={e => updateLocalField('addressState', e.target.value)}
                />
              </div>
            </div>
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8">
                <label className="label">Rua / Logradouro</label>
                <input
                  className="input"
                  value={g.addressStreet || ''}
                  onChange={e => updateLocalField('addressStreet', e.target.value)}
                />
              </div>
              <div className="sm:col-span-4">
                <label className="label">Número</label>
                <input
                  className="input"
                  value={g.addressNumber || ''}
                  onChange={e => updateLocalField('addressNumber', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label">Bairro</label>
              <input
                className="input"
                value={g.addressNeighborhood || ''}
                onChange={e => updateLocalField('addressNeighborhood', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Complemento</label>
              <input
                className="input"
                value={g.addressComplement || ''}
                onChange={e => updateLocalField('addressComplement', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log Timeline */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Linha do Tempo & Auditoria ({logs.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400">Registros automáticos do sistema</span>
        </div>

        {logs.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            Nenhuma ação registrada até o momento.
          </p>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            {logs.slice(0, 10).map(log => (
              <div key={log.id} className="relative group">
                <div className="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white dark:ring-slate-900" />
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      {cleanAuditNote(log.note) || `Alteração para status: ${log.toStatus}`}
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      Por: <strong>{log.byUser || 'Sistema'}</strong>
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                    {new Date(log.at).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal for Guest Checkout */}
      <ConfirmModal
        open={checkoutModalOpen}
        title="Finalizar Estadia (Check-out)"
        message={`Deseja realmente finalizar a estadia de "${g.name}"? O hóspede será marcado como Finalizado com data e hora de saída registradas agora.`}
        confirmLabel="Sim, Finalizar Estadia"
        cancelLabel="Cancelar"
        loading={checkoutLoading}
        onConfirm={handleConfirmCheckout}
        onCancel={() => setCheckoutModalOpen(false)}
      />

      {/* Confirmation Modal for Guest Deletion */}
      <ConfirmModal
        open={deleteModalOpen}
        title="Excluir Hóspede"
        message={`Tem certeza que deseja excluir o cadastro de "${g.name}"? Esta ação não pode ser desfeita e removerá todos os registros associados.`}
        confirmLabel="Sim, Excluir Hóspede"
        cancelLabel="Cancelar"
        loading={deleteLoading}
        onConfirm={handleDeleteGuest}
        onCancel={() => setDeleteModalOpen(false)}
      />
      {/* Floating Save Actions Bar when there are unsaved edits */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-6 inset-x-4 max-w-2xl mx-auto z-40 animate-in slide-in-from-bottom-5 duration-200">
          <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-4 shadow-2xl shadow-black/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-white">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <span className="text-xs font-semibold text-slate-200">
                Você possui alterações não salvas nesta ficha.
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleDiscardChanges}
                disabled={saving}
                className="btn-secondary py-1.5 px-3 text-xs font-semibold text-slate-300 hover:text-white border-slate-700 hover:bg-slate-800"
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={saving}
                className="btn-primary py-1.5 px-4 text-xs font-semibold shadow-md shadow-brand-500/20"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    <span>Salvar Alterações</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}