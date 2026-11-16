import { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  startNewStayWithAppointment as startNewStayWithAppointmentSvc,
  confirmArrival as confirmArrivalSvc,
  undoCheckin as undoCheckinSvc,
  markNoShow as markNoShowSvc,
} from '../services/guests';
import type { AuditEntry, Guest, Companion, Status } from '../types';
import {
  calculateAge,
  formatCPF,
  formatPhone,
  formatCEP,
  formatSUS,
  formatTimeBR,
  isValidTimeBR,
  isoToBrDate,
  formatAppointmentDisplay,
  validateCPF,
  onlyDigits,
  getTodayISO,
} from '../utils/cpf';
import {
  parseCompanions,
  formatCompanionsList,
  COMPANION_RELATIONSHIPS,
} from '../utils/companion';
import { STATUS_LABEL } from '../utils/labels';
import { useAuth } from '../context/AuthContext';
import { useModalA11y } from '../utils/useModalA11y';
import { StatusBadge } from '../components/StatusBadge';
import { toast } from 'sonner';
import DateInput from '../components/DateInput';
import {
  ArrowLeft,
  History,
  Clock,
  Save,
  Loader2,
  Search,
  Trash2,
  Plus,
  RotateCcw,
  PlusCircle,
  CheckCircle2,
  XCircle,
  X,
  Pencil,
  Calendar,
} from 'lucide-react';
import SmartAutocomplete from '../components/SmartAutocomplete';
import ConfirmModal from '../components/ConfirmModal';
import WhatsAppButton from '../components/WhatsAppButton';
import { MEDICAL_LOCATIONS, PROCEDURE_SUGGESTIONS } from '../data/medicalLocations';

type DetailTab = 'resumo' | 'dados' | 'acompanhantes' | 'historico';

const hospitalOptions = MEDICAL_LOCATIONS.map(loc => ({
  label: loc.name,
  badge: `${loc.city} • ${loc.type}`,
  category: loc.category,
}));

const TRACKED_FIELDS: (keyof Guest)[] = [
  'name',
  'dateOfBirth',
  'phone',
  'cpf',
  'susCard',
  'hasCompanion',
  'companions',
  'reason',
  'responsible',
  'appointmentDate',
  'appointmentTime',
  'medicalNotes',
  'medicalStatus',
  'addressZip',
  'addressState',
  'addressCity',
  'addressNeighborhood',
  'addressStreet',
  'addressNumber',
  'addressComplement',
  'notes',
  'socialNotes',
];

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
  appointmentDate: 'Dia da Consulta',
  appointmentTime: 'Hora da Consulta',
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
  notes: 'Observações da estadia',
  socialNotes: 'Observações sociais',
};

function formatAuditValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') {
    return value ? 'Sim' : 'Não';
  }
  if (key === 'hasCompanion') {
    return value === true || value === 'true' || value === 1 ? 'Sim' : 'Não';
  }
  if (key === 'appointmentDate' || key === 'dateOfBirth') {
    return isoToBrDate(String(value)) || String(value);
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
    if (value === 'agendado' || value === 'presente' || value === 'finalizado') {
      return STATUS_LABEL[value as Status];
    }
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

function ReadOnlyField({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <span className="label">{label}</span>
      <p
        className={`text-sm font-medium text-slate-900 dark:text-slate-100 break-words ${
          mono ? 'tabular-nums' : ''
        }`}
      >
        {value && value.trim() ? value : <span className="text-slate-400 font-normal">Não informado</span>}
      </p>
    </div>
  );
}

export default function GuestDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [g, setG] = useState<Guest | undefined>(undefined);
  const [orig, setOrig] = useState<Guest | undefined>(undefined);
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('resumo');
  const [saving, setSaving] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [viaCepLoading, setViaCepLoading] = useState(false);

  // Modal: Novo encaminhamento
  const [newStayOpen, setNewStayOpen] = useState(false);
  const [newStayDate, setNewStayDate] = useState('');
  const [newStayTime, setNewStayTime] = useState('');
  const [newStayHospital, setNewStayHospital] = useState('');
  const [newStayReason, setNewStayReason] = useState('');
  const [newStayLoading, setNewStayLoading] = useState(false);
  const newStayModalRef = useRef<HTMLDivElement>(null);

  useModalA11y(
    newStayOpen,
    newStayModalRef,
    newStayLoading ? undefined : () => setNewStayOpen(false)
  );

  useEffect(() => {
    (async () => {
      if (!id) return;
      setLoading(true);
      try {
        const found = await getGuestSvc(id);
        if (found) {
          const comps = parseCompanions(found.companions);
          found.companions =
            found.hasCompanion && comps.length === 0
              ? [{ name: '', phone: '', relationship: '' }]
              : comps;
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
    return TRACKED_FIELDS.some(k => {
      const prevVal = orig[k];
      const nextVal = g[k];
      const prevStr = typeof prevVal === 'object' ? JSON.stringify(prevVal) : String(prevVal ?? '');
      const nextStr = typeof nextVal === 'object' ? JSON.stringify(nextVal) : String(nextVal ?? '');
      return prevStr !== nextStr;
    });
  }, [g, orig]);

  const age = g?.dateOfBirth ? calculateAge(g.dateOfBirth) : null;
  const isMinor = age !== null && age < 18;
  const companionsList = useMemo(() => parseCompanions(g?.companions), [g?.companions]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  function handleBackNavigation() {
    if (hasUnsavedChanges) {
      const ok = window.confirm(
        'Existem alterações não salvas na ficha. Deseja realmente sair e descartar as alterações?'
      );
      if (!ok) return;
    }
    navigate(-1);
  }

  async function handleDeleteGuest() {
    if (!g || !isAdmin) return;
    try {
      setDeleteLoading(true);
      await deleteGuestSvc(g.id);
      toast.success('Hóspede excluído com sucesso.');
      navigate('/hospedes', { replace: true });
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
        : [{ name: '', phone: '', relationship: '' }]
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
    setG({
      ...g,
      hasCompanion: true,
      companions: [...current, { name: '', phone: '', relationship: '' }],
    });
  }

  function handleRemoveCompanion(idx: number) {
    if (!g) return;
    const current = parseCompanions(g.companions);
    const next = current.filter((_, i) => i !== idx);
    setG({
      ...g,
      hasCompanion: next.length > 0,
      companions: next,
    });
  }

  function handleUpdateCompanion(idx: number, field: 'name' | 'phone' | 'relationship', val: string) {
    if (!g) return;
    const current = parseCompanions(g.companions);
    current[idx] = { ...current[idx], [field]: val };
    setG({
      ...g,
      companions: current,
    });
  }

  async function lookupCEP() {
    if (!g) return;
    const cepDigits = onlyDigits(g.addressZip || '');
    if (cepDigits.length !== 8) {
      toast.info('Informe os 8 dígitos do CEP para buscar.');
      return;
    }
    try {
      setViaCepLoading(true);
      const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast.error('CEP não localizado na base dos Correios.');
        return;
      }
      setG(prev =>
        prev
          ? {
              ...prev,
              addressState: data.uf || prev.addressState,
              addressCity: data.localidade || prev.addressCity,
              addressNeighborhood: data.bairro || prev.addressNeighborhood,
              addressStreet: data.logradouro || prev.addressStreet,
              addressComplement: data.complemento || prev.addressComplement,
            }
          : prev
      );
      toast.success('Endereço preenchido via CEP!');
    } catch {
      toast.error('Erro ao buscar CEP.');
    } finally {
      setViaCepLoading(false);
    }
  }

  function handleDiscardChanges() {
    if (orig) {
      setG(orig);
      setEditing(false);
      toast.info('Alterações descartadas.');
    }
  }

  async function handleSaveAll() {
    if (!user || !g || !orig) return;

    if (!g.name.trim()) {
      toast.error('O nome do hóspede não pode ficar vazio.');
      setActiveTab('dados');
      return;
    }

    if (!g.cpf || !validateCPF(g.cpf)) {
      toast.error('O CPF do hóspede é inválido. Verifique os 11 dígitos.');
      setActiveTab('dados');
      return;
    }

    if (!g.dateOfBirth) {
      toast.error('Informe uma data de nascimento válida.');
      setActiveTab('dados');
      return;
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    if (g.dateOfBirth > todayIso) {
      toast.error('A data de nascimento não pode ser no futuro.');
      setActiveTab('dados');
      return;
    }

    if (!g.phone || onlyDigits(g.phone).length < 10) {
      toast.error('Informe um telefone válido com DDD.');
      setActiveTab('dados');
      return;
    }

    if (g.appointmentTime && !isValidTimeBR(g.appointmentTime)) {
      toast.error('Horário da consulta inválido. Use o formato HH:MM (ex: 08:30).');
      setActiveTab('resumo');
      return;
    }

    if (!(g.addressNumber || '').trim()) {
      toast.error('Informe o número do endereço ou marque a opção "S/N".');
      setActiveTab('dados');
      return;
    }

    if (g.hasCompanion) {
      const rawComps = parseCompanions(g.companions);
      for (const comp of rawComps) {
        if (comp.phone && comp.phone.trim().length > 0 && onlyDigits(comp.phone).length < 10) {
          toast.error(`O celular do acompanhante "${comp.name || 'Sem nome'}" está incompleto.`);
          setActiveTab('acompanhantes');
          return;
        }
      }
    }

    try {
      setSaving(true);
      const cleanedCompanions = parseCompanions(g.companions, true);
      const guestToSave: Guest = {
        ...g,
        hasCompanion: g.hasCompanion && cleanedCompanions.length > 0,
        companions: cleanedCompanions,
      };

      const newAuditEntries: AuditEntry[] = [];
      const now = new Date().toISOString();

      for (const k of TRACKED_FIELDS) {
        const prevVal = orig[k];
        const nextVal = guestToSave[k];
        const prevStr = typeof prevVal === 'object' ? JSON.stringify(prevVal) : String(prevVal ?? '');
        const nextStr = typeof nextVal === 'object' ? JSON.stringify(nextVal) : String(nextVal ?? '');

        if (prevStr !== nextStr) {
          const prevDisplay = formatAuditValue(String(k), prevVal);
          const nextDisplay = formatAuditValue(String(k), nextVal);
          const note = `Alterou ${labelMap[String(k)] || String(k)} de "${prevDisplay}" para "${nextDisplay}"`;
          newAuditEntries.push({
            id: crypto.randomUUID(),
            guestId: guestToSave.id,
            toStatus: guestToSave.status,
            at: now,
            byUser: user.username,
            note,
          });
        }
      }

      if (newAuditEntries.length === 0) {
        setEditing(false);
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
      setEditing(false);
      toast.success('Alterações salvas com sucesso!');
    } catch {
      toast.error('Erro ao salvar ficha do hóspede.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmArrival() {
    if (!user || !g) return;
    try {
      const next = await confirmArrivalSvc(g, user.username);
      setG(next);
      setOrig(next);
      const l = await listAuditSvc(g.id);
      setLogs(l);
      toast.success(`Entrada de "${g.name}" registrada!`, {
        action: {
          label: 'Desfazer',
          onClick: () => handleUndoCheckin(next),
        },
        duration: 8000,
      });
    } catch {
      toast.error('Erro ao registrar entrada.');
    }
  }

  async function handleUndoCheckin(target = g) {
    if (!user || !target) return;
    try {
      const next = await undoCheckinSvc(target, user.username);
      setG(next);
      setOrig(next);
      const l = await listAuditSvc(target.id);
      setLogs(l);
      toast.success('Entrada desfeita. Hóspede retornou para Aguardando.');
    } catch {
      toast.error('Erro ao desfazer entrada.');
    }
  }

  async function handleMarkNoShow() {
    if (!user || !g) return;
    try {
      const next = await markNoShowSvc(g, user.username);
      setG(next);
      setOrig(next);
      const l = await listAuditSvc(g.id);
      setLogs(l);
      toast.info(`"${g.name}" marcado como "Não veio".`, {
        action: {
          label: 'Desfazer',
          onClick: () => handleStartNewStay(next),
        },
        duration: 8000,
      });
    } catch {
      toast.error('Erro ao registrar ausência.');
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
      toast.success(`Saída de "${g.name}" registrada!`, {
        action: {
          label: 'Desfazer',
          onClick: () => handleUndoCheckout(next),
        },
        duration: 8000,
      });
    } catch {
      toast.error('Erro ao registrar saída.');
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handleUndoCheckout(target = g) {
    if (!user || !target) return;
    try {
      const next = await undoCheckoutSvc(target, user.username);
      setG(next);
      setOrig(next);
      const l = await listAuditSvc(target.id);
      setLogs(l);
      toast.success(`Saída desfeita! "${target.name}" voltou para Na casa.`);
    } catch {
      toast.error('Erro ao desfazer saída.');
    }
  }

  async function handleStartNewStay(target = g) {
    if (!user || !target) return;
    try {
      const next = await startNewStaySvc(target, user.username);
      setG(next);
      setOrig(next);
      const l = await listAuditSvc(target.id);
      setLogs(l);
      toast.success(`Novo encaminhamento iniciado para "${target.name}"!`);
    } catch {
      toast.error('Erro ao iniciar novo encaminhamento.');
    }
  }

  function openNewStayModal() {
    if (!g) return;
    setNewStayDate(getTodayISO());
    setNewStayTime('');
    setNewStayHospital(g.medicalNotes || '');
    setNewStayReason(g.reason || '');
    setNewStayOpen(true);
  }

  async function submitNewStayModal(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !g) return;
    if (newStayTime && !isValidTimeBR(newStayTime)) {
      toast.error('Horário inválido. Informe entre 00:00 e 23:59.');
      return;
    }
    try {
      setNewStayLoading(true);
      const next = await startNewStayWithAppointmentSvc(g, user.username, {
        appointmentDate: newStayDate || undefined,
        appointmentTime: newStayTime || undefined,
        medicalNotes: newStayHospital.trim() || undefined,
        reason: newStayReason.trim() || undefined,
      });
      setG(next);
      setOrig(next);
      const l = await listAuditSvc(g.id);
      setLogs(l);
      setNewStayOpen(false);
      toast.success(`Novo encaminhamento iniciado para "${g.name}"!`);
    } catch {
      toast.error('Erro ao iniciar novo encaminhamento.');
    } finally {
      setNewStayLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container-page py-16 text-center text-sm text-slate-500">
        Carregando ficha do hóspede...
      </div>
    );
  }

  if (!g) {
    return (
      <div className="container-page py-16 text-center space-y-4">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Hóspede não encontrado no sistema.
        </p>
        <Link to="/hospedes" className="btn-secondary">
          Voltar para a Lista de Hóspedes
        </Link>
      </div>
    );
  }

  const tabs: { id: DetailTab; label: string; badge?: number }[] = [
    { id: 'resumo', label: 'Resumo e Atendimento' },
    { id: 'dados', label: 'Dados e Endereço' },
    { id: 'acompanhantes', label: 'Acompanhantes', badge: g.hasCompanion ? companionsList.length : undefined },
    { id: 'historico', label: 'Histórico', badge: logs.length },
  ];

  return (
    <div className="container-page py-6 space-y-5 pb-24">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:min-h-[44px]">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleBackNavigation}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Voltar"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Ficha do Hóspede
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {editing ? 'Modo de edição ativo' : 'Visualização da estadia e dados cadastrais'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setDeleteModalOpen(true)}
              className="btn-secondary text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 justify-center cursor-pointer"
              title="Excluir este hóspede"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Excluir</span>
            </button>
          )}

          {editing ? (
            <>
              <button
                type="button"
                onClick={handleDiscardChanges}
                disabled={saving}
                className="btn-secondary justify-center cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>Cancelar edição</span>
              </button>
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={saving}
                className="btn-primary justify-center cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                <span>{hasUnsavedChanges ? 'Salvar Alterações *' : 'Salvar'}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                if (activeTab === 'historico') setActiveTab('resumo');
              }}
              className="btn-primary justify-center cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Editar ficha</span>
            </button>
          )}
        </div>
      </div>

      {/* Profile Overview Card */}
      <div className="card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white truncate">
                {g.name}
              </h2>
              <StatusBadge status={g.status} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-1 tabular-nums">
              <span>
                CPF: <strong className="text-slate-700 dark:text-slate-300 font-medium">{g.cpf}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                Celular: <strong className="text-slate-700 dark:text-slate-300 font-medium">{g.phone || '-'}</strong>
                {g.phone && <WhatsAppButton phone={g.phone} name={g.name} />}
              </span>
              <span>•</span>
              <span>
                Idade:{' '}
                <strong className="text-slate-700 dark:text-slate-300 font-medium">
                  {age !== null ? `${age} anos` : '-'}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {g.status === 'agendado' ? (
              <>
                <button
                  type="button"
                  className="btn-success cursor-pointer"
                  onClick={handleConfirmArrival}
                  title="Confirmar entrada na Casa de Apoio"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Registrar entrada</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                  onClick={handleMarkNoShow}
                  title="Marcar que o hóspede não veio"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Não veio</span>
                </button>
              </>
            ) : g.status === 'finalizado' ? (
              <>
                <button
                  type="button"
                  className="btn-secondary text-amber-700 dark:text-amber-300 cursor-pointer"
                  onClick={() => handleUndoCheckout()}
                  title="Desfazer saída e reabrir a estadia que foi finalizada por engano"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reabrir estadia</span>
                </button>
                <button
                  type="button"
                  className="btn-success cursor-pointer"
                  onClick={openNewStayModal}
                  title="Agendar um novo encaminhamento para a Casa de Apoio"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>Novo encaminhamento</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-warning cursor-pointer"
                onClick={() => setCheckoutModalOpen(true)}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>Registrar saída</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div>
            <span className="label">Consulta Agendada</span>
            <p className="text-xs font-medium text-slate-900 dark:text-slate-100 tabular-nums">
              {formatAppointmentDisplay(g.appointmentDate, g.appointmentTime) || 'Não informada'}
            </p>
          </div>
          <div>
            <span className="label">Entrada na Casa</span>
            <p className="text-xs font-medium text-slate-900 dark:text-slate-100 tabular-nums">
              {g.checkInAt
                ? new Date(g.checkInAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                : g.status === 'agendado'
                  ? 'Aguardando chegada'
                  : '-'}
            </p>
          </div>
          <div>
            <span className="label">Saída</span>
            <p className="text-xs font-medium text-slate-900 dark:text-slate-100 tabular-nums">
              {g.checkOutAt
                ? new Date(g.checkOutAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                : 'Em aberto'}
            </p>
          </div>
          <div>
            <span className="label">Acompanhantes</span>
            <p className="text-xs font-medium text-slate-900 dark:text-slate-100">
              {g.hasCompanion ? formatCompanionsList(g.companions) || 'Sim (não nominado)' : 'Nenhum'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Seções da ficha do hóspede"
        className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 w-fit"
      >
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === t.id
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>{t.label}</span>
            {t.badge !== undefined && t.badge > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-200 tabular-nums">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab 1: Resumo e Atendimento */}
      {activeTab === 'resumo' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card p-5 space-y-4">
            <div className="pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Atendimento e Saúde
              </h3>
            </div>

            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="label">Procedimento / Motivo</label>
                  <SmartAutocomplete
                    value={g.reason || ''}
                    onChange={val => updateLocalField('reason', val)}
                    options={PROCEDURE_SUGGESTIONS}
                  />
                </div>

                <div>
                  <label className="label">Hospital / Clínica de Atendimento</label>
                  <SmartAutocomplete
                    value={g.medicalNotes || ''}
                    onChange={val => updateLocalField('medicalNotes', val)}
                    options={hospitalOptions}
                    emptyText="Hospital/Clínica não listado. Pressione Enter para usar o nome digitado."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Dia da Consulta</label>
                    <DateInput
                      value={g.appointmentDate || ''}
                      onChange={val => updateLocalField('appointmentDate', val)}
                      defaultToToday
                    />
                  </div>

                  <div>
                    <label className="label">Hora da Consulta</label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={5}
                        className="input pr-14"
                        value={g.appointmentTime || ''}
                        onChange={e => updateLocalField('appointmentTime', formatTimeBR(e.target.value))}
                        autoComplete="off"
                      />
                      <div className="absolute right-2.5 flex items-center gap-1">
                        {g.appointmentTime && (
                          <button
                            type="button"
                            onClick={() => updateLocalField('appointmentTime', '')}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                            title="Limpar horário"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <span className="p-1 text-slate-400 pointer-events-none">
                          <Clock className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <ReadOnlyField label="Hospital / Clínica de Atendimento" value={g.medicalNotes} />
                </div>
                <ReadOnlyField label="Procedimento / Motivo" value={g.reason} />
                <ReadOnlyField
                  label="Consulta Agendada"
                  value={formatAppointmentDisplay(g.appointmentDate, g.appointmentTime)}
                  mono
                />
              </div>
            )}
          </div>

          <div className="card p-5 space-y-4">
            <div className="pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Observações da Estadia
              </h3>
            </div>

            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="label">Observações da estadia (dieta, alergia, cuidados)</label>
                  <textarea
                    rows={3}
                    className="input min-h-[76px] py-2 resize-y"
                    placeholder="Ex.: Dieta sem sal, alergia a dipirona, usa cadeira de rodas..."
                    value={g.notes || ''}
                    onChange={e => updateLocalField('notes', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Observações sociais</label>
                  <textarea
                    rows={3}
                    className="input min-h-[76px] py-2 resize-y"
                    placeholder="Anotações do serviço social, transporte ou demandas..."
                    value={g.socialNotes || ''}
                    onChange={e => updateLocalField('socialNotes', e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <ReadOnlyField label="Observações da estadia" value={g.notes} />
                <ReadOnlyField label="Observações sociais" value={g.socialNotes} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Dados Cadastrais e Endereço */}
      {activeTab === 'dados' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Dados Pessoais */}
          <div className="card p-5 space-y-4">
            <div className="pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Dados Pessoais
              </h3>
            </div>

            {editing ? (
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
                    <label className="label">Telefone</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={15}
                      className="input tabular-nums"
                      value={g.phone}
                      onChange={e => updateLocalField('phone', formatPhone(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="label">Data de Nascimento</label>
                    <DateInput
                      value={g.dateOfBirth}
                      onChange={val => updateLocalField('dateOfBirth', val)}
                      maxDate={getTodayISO()}
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
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <ReadOnlyField label="Nome Completo" value={g.name} />
                </div>
                <ReadOnlyField label="CPF" value={g.cpf} mono />
                <ReadOnlyField label="Nº Cartão do SUS" value={g.susCard} mono />
                <ReadOnlyField label="Telefone" value={g.phone} mono />
                <ReadOnlyField
                  label="Data de Nascimento"
                  value={
                    g.dateOfBirth
                      ? `${isoToBrDate(g.dateOfBirth)}${age !== null ? ` (${age} anos)` : ''}`
                      : ''
                  }
                  mono
                />
                {isMinor && (
                  <div className="col-span-2">
                    <ReadOnlyField label="Responsável pelo Menor" value={g.responsible} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Endereço de Origem */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Endereço de Origem
              </h3>
              {editing && (
                <button
                  type="button"
                  onClick={() => {
                    setG(prev =>
                      prev
                        ? {
                            ...prev,
                            addressCity: 'Quirinópolis',
                            addressState: 'GO',
                            addressZip: prev.addressZip || '75860-000',
                          }
                        : prev
                    );
                  }}
                  className="text-xs font-medium text-brand-700 dark:text-brand-400 hover:underline cursor-pointer"
                  title="Preencher cidade Quirinópolis - GO (CEP 75860-000)"
                >
                  Usar Quirinópolis - GO
                </button>
              )}
            </div>

            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">CEP</label>
                  <div className="flex gap-1.5">
                    <input
                      className="input tabular-nums"
                      inputMode="numeric"
                      maxLength={9}
                      value={g.addressZip || ''}
                      onChange={e => updateLocalField('addressZip', formatCEP(e.target.value))}
                    />
                    <button
                      type="button"
                      onClick={lookupCEP}
                      disabled={viaCepLoading}
                      className="btn-secondary px-2.5 shrink-0 cursor-pointer"
                      title="Buscar dados do CEP"
                    >
                      {viaCepLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Search className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
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
                    {(g.addressNumber || '').trim().toUpperCase() !== 'S/N' && (
                      <input
                        className="input"
                        value={g.addressNumber || ''}
                        onChange={e => updateLocalField('addressNumber', e.target.value)}
                      />
                    )}
                    <label
                      className={`inline-flex items-center gap-2 cursor-pointer select-none transition-colors ${
                        (g.addressNumber || '').trim().toUpperCase() === 'S/N'
                          ? 'h-9 px-3 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 w-full'
                          : 'mt-1.5 text-xs text-slate-400 dark:text-slate-500 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                        checked={(g.addressNumber || '').trim().toUpperCase() === 'S/N'}
                        onChange={e =>
                          updateLocalField('addressNumber', e.target.checked ? 'S/N' : '')
                        }
                      />
                      <span>Sem número</span>
                    </label>
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
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <ReadOnlyField label="CEP" value={g.addressZip} mono />
                <ReadOnlyField
                  label="Cidade / UF"
                  value={
                    g.addressCity || g.addressState
                      ? `${g.addressCity || ''}${g.addressCity && g.addressState ? ' - ' : ''}${g.addressState || ''}`
                      : ''
                  }
                />
                <div className="col-span-2">
                  <ReadOnlyField
                    label="Logradouro"
                    value={
                      g.addressStreet
                        ? `${g.addressStreet}${g.addressNumber ? `, ${g.addressNumber}` : ''}`
                        : ''
                    }
                  />
                </div>
                <ReadOnlyField label="Bairro" value={g.addressNeighborhood} />
                <ReadOnlyField label="Complemento" value={g.addressComplement} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Acompanhantes */}
      {activeTab === 'acompanhantes' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Acompanhantes
            </h3>
            {g.hasCompanion && (
              <span className="badge-yellow">
                {companionsList.length}{' '}
                {companionsList.length === 1 ? 'acompanhante' : 'acompanhantes'}
              </span>
            )}
          </div>

          {editing ? (
            <div className="space-y-3.5">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                  checked={!!g.hasCompanion}
                  onChange={e => handleToggleHasCompanion(e.target.checked)}
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Possui acompanhante nesta estadia
                </span>
              </label>

              {g.hasCompanion && (
                <div className="space-y-3 pt-1">
                  {(companionsList.length > 0
                    ? companionsList
                    : [{ name: '', phone: '', relationship: '' }]
                  ).map((comp, idx, arr) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          {idx + 1}º Acompanhante
                        </span>
                        {arr.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCompanion(idx)}
                            className="text-xs font-medium text-rose-600 hover:text-rose-700 dark:hover:text-rose-400 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Remover este acompanhante"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Remover</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-5">
                          <label className="label">Nome do Acompanhante</label>
                          <input
                            className="input"
                            value={comp.name || ''}
                            onChange={e => handleUpdateCompanion(idx, 'name', e.target.value)}
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="label">Parentesco</label>
                          <select
                            className="input"
                            value={comp.relationship || ''}
                            onChange={e =>
                              handleUpdateCompanion(idx, 'relationship', e.target.value)
                            }
                          >
                            <option value="">Selecione...</option>
                            {COMPANION_RELATIONSHIPS.map(rel => (
                              <option key={rel} value={rel}>
                                {rel}
                              </option>
                            ))}
                            {comp.relationship &&
                              !(COMPANION_RELATIONSHIPS as readonly string[]).includes(
                                comp.relationship
                              ) && (
                                <option value={comp.relationship}>{comp.relationship}</option>
                              )}
                          </select>
                        </div>

                        <div className="sm:col-span-4">
                          <label className="label">Celular</label>
                          <input
                            type="tel"
                            inputMode="numeric"
                            placeholder="(64) 99999-9999"
                            className="input tabular-nums"
                            value={comp.phone || ''}
                            maxLength={15}
                            onChange={e =>
                              handleUpdateCompanion(idx, 'phone', formatPhone(e.target.value))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddCompanion}
                    className="btn-secondary w-full sm:w-auto cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 text-slate-500" />
                    <span>
                      Adicionar outro acompanhante ({(companionsList.length || 1) + 1}º)
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : !g.hasCompanion || companionsList.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
              Nenhum acompanhante registrado para esta estadia. Clique em <strong>Editar ficha</strong> para adicionar.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {companionsList.map((comp, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {comp.name || 'Sem nome'}
                    </span>
                    {comp.relationship && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-amber-100/80 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300">
                        {comp.relationship}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                    <span>Celular: {comp.phone || 'Não informado'}</span>
                    {comp.phone && <WhatsAppButton phone={comp.phone} name={comp.name || g.name} />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Histórico */}
      {activeTab === 'historico' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Linha do Tempo e Auditoria ({logs.length})
            </h3>
            <Link
              to={`/hospedes/${g.id}/historico`}
              className="text-xs font-medium text-brand-700 dark:text-brand-400 hover:underline inline-flex items-center gap-1"
            >
              <History className="h-3.5 w-3.5" />
              <span>Abrir histórico completo</span>
            </Link>
          </div>

          {logs.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              Nenhuma ação registrada até o momento.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.map(log => (
                <div
                  key={log.id}
                  className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-slate-900 dark:text-white">
                      {cleanAuditNote(log.note) ||
                        `Alteração de situação: ${STATUS_LABEL[log.toStatus] || log.toStatus}`}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Por: <strong className="font-medium">{log.byUser || 'Sistema'}</strong>
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">
                    {new Date(log.at).toLocaleString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Novo encaminhamento */}
      {newStayOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]">
            <div
              ref={newStayModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-stay-title"
              className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  <h2
                    id="new-stay-title"
                    className="text-sm font-semibold text-slate-900 dark:text-white"
                  >
                    Novo encaminhamento
                  </h2>
                </div>
                <button
                  type="button"
                  disabled={newStayLoading}
                  onClick={() => setNewStayOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={submitNewStayModal} className="p-5 space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Informe os dados da nova consulta para <strong>{g.name}</strong>. Os dados cadastrais serão mantidos.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Dia da Consulta</label>
                    <DateInput
                      value={newStayDate}
                      onChange={setNewStayDate}
                      defaultToToday
                    />
                  </div>
                  <div>
                    <label className="label">Hora da Consulta</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={5}
                      placeholder="Ex.: 08:30"
                      className="input tabular-nums"
                      value={newStayTime}
                      onChange={e => setNewStayTime(formatTimeBR(e.target.value))}
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Hospital / Clínica de Atendimento</label>
                  <SmartAutocomplete
                    value={newStayHospital}
                    onChange={setNewStayHospital}
                    options={hospitalOptions}
                  />
                </div>

                <div>
                  <label className="label">Procedimento / Motivo</label>
                  <SmartAutocomplete
                    value={newStayReason}
                    onChange={setNewStayReason}
                    options={PROCEDURE_SUGGESTIONS}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={newStayLoading}
                    onClick={() => setNewStayOpen(false)}
                    className="btn-secondary cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={newStayLoading}
                    className="btn-success cursor-pointer"
                  >
                    {newStayLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Confirmando...</span>
                      </>
                    ) : (
                      <>
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span>Confirmar encaminhamento</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Confirmation Modal for Guest Checkout */}
      <ConfirmModal
        open={checkoutModalOpen}
        title="Registrar Saída"
        message={`Deseja realmente registrar a saída de "${g.name}"? O hóspede será marcado como Finalizado com data e hora de saída registradas agora.`}
        confirmLabel="Sim, Registrar Saída"
        cancelLabel="Cancelar"
        variant="warning"
        loading={checkoutLoading}
        onConfirm={handleConfirmCheckout}
        onCancel={() => setCheckoutModalOpen(false)}
      />

      {/* Confirmation Modal for Guest Deletion (Admin only) */}
      {isAdmin && (
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
      )}

      {/* Floating Save Actions Bar when editing with unsaved changes */}
      {editing && hasUnsavedChanges && (
        <div className="fixed bottom-5 inset-x-4 max-w-xl mx-auto z-40">
          <div className="bg-slate-900 dark:bg-slate-950 border border-slate-700/80 rounded-lg p-3.5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-white">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-xs font-medium text-slate-200">
                Você possui alterações não salvas nesta ficha.
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleDiscardChanges}
                disabled={saving}
                className="btn-secondary py-1.5 px-3 text-xs font-medium text-slate-300 hover:text-white border-slate-700 hover:bg-slate-800 cursor-pointer"
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={saving}
                className="btn-primary py-1.5 px-4 text-xs font-medium cursor-pointer"
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
