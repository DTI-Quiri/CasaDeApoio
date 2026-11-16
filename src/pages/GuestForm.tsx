import { useState, useEffect, useRef, type FormEvent } from 'react';
import type { Guest, Status, Companion } from '../types';
import { upsertGuest, findGuestByCPF, addAudit } from '../services/guests';
import { useNavigate, Link } from 'react-router-dom';
import {
  validateCPF,
  formatCPF,
  formatPhone,
  formatCEP,
  formatSUS,
  onlyDigits,
  calculateAge,
  formatTimeBR,
  isValidTimeBR,
  formatAppointmentDisplay,
  getTodayISO,
} from '../utils/cpf';
import { parseCompanions, COMPANION_RELATIONSHIPS } from '../utils/companion';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import CpfPreCheckModal from '../components/CpfPreCheckModal';
import SmartAutocomplete from '../components/SmartAutocomplete';
import DateInput from '../components/DateInput';
import { MEDICAL_LOCATIONS, PROCEDURE_SUGGESTIONS } from '../data/medicalLocations';
import {
  Check,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Search,
  Plus,
  Trash2,
  Clock,
  X,
} from 'lucide-react';

const DRAFT_KEY = 'casaapoio_guest_form_draft';

interface FormDraft {
  name: string;
  dateOfBirth: string;
  phone: string;
  cpf: string;
  susCard: string;
  hasCompanion: boolean;
  companions: Companion[];
  reason: string;
  responsible: string;
  appointmentDate: string;
  appointmentTime: string;
  medicalNotes: string;
  medicalType: 'consulta' | 'exame' | 'cirurgia' | 'outro';
  medicalStatus: 'aguardando' | 'concluida';
  addressZip: string;
  addressState: string;
  addressCity: string;
  addressNeighborhood: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  notes?: string;
  socialNotes?: string;
  existing: Guest | null;
  modalOpen: boolean;
}

function loadDraft(): FormDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Erro ao ler rascunho:', e);
  }
  return null;
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore storage errors
  }
}

const hospitalOptions = MEDICAL_LOCATIONS.map(loc => ({
  label: loc.name,
  badge: `${loc.city} • ${loc.type}`,
  category: loc.category,
}));

export default function GuestFormPage() {
  const nav = useNavigate();
  const { user } = useAuth();

  const initialDraft = useRef(loadDraft()).current;

  const [modalOpen, setModalOpen] = useState(() =>
    initialDraft ? initialDraft.modalOpen : true
  );
  const [name, setName] = useState(() => initialDraft?.name || '');
  const [dateOfBirth, setDOB] = useState(() => initialDraft?.dateOfBirth || '');
  const [phone, setPhone] = useState(() => initialDraft?.phone || '');
  const [cpf, setCPF] = useState(() => initialDraft?.cpf || '');
  const [susCard, setSusCard] = useState(() => initialDraft?.susCard || '');
  const [hasCompanion, setHasCompanion] = useState(() => initialDraft?.hasCompanion || false);
  const [companions, setCompanions] = useState<Companion[]>(
    () => initialDraft?.companions || [{ name: '', phone: '', relationship: '' }]
  );
  const [reason, setReason] = useState(() => initialDraft?.reason || '');
  const [responsible, setResponsible] = useState(() => initialDraft?.responsible || '');
  const [appointmentDate, setAppointmentDate] = useState(() => initialDraft?.appointmentDate || '');
  const [appointmentTime, setAppointmentTime] = useState(() => initialDraft?.appointmentTime || '');
  const [medicalNotes, setMedicalNotes] = useState(() => initialDraft?.medicalNotes || '');
  const [medicalType, setMedicalType] = useState<'consulta' | 'exame' | 'cirurgia' | 'outro'>(
    () => initialDraft?.medicalType || 'consulta'
  );
  const [medicalStatus, setMedicalStatus] = useState<'aguardando' | 'concluida'>(
    () => initialDraft?.medicalStatus || 'aguardando'
  );
  const [addressZip, setAddressZip] = useState(() => initialDraft?.addressZip ?? '75860-000');
  const [addressState, setAddressState] = useState(() => initialDraft?.addressState ?? 'GO');
  const [addressCity, setAddressCity] = useState(() => initialDraft?.addressCity ?? 'Quirinópolis');
  const [addressNeighborhood, setAddressNeighborhood] = useState(
    () => initialDraft?.addressNeighborhood || ''
  );
  const [addressStreet, setAddressStreet] = useState(() => initialDraft?.addressStreet || '');
  const [addressNumber, setAddressNumber] = useState(() => initialDraft?.addressNumber || '');
  const [addressComplement, setAddressComplement] = useState(
    () => initialDraft?.addressComplement || ''
  );
  const [notes, setNotes] = useState(() => initialDraft?.notes || '');
  const [socialNotes, setSocialNotes] = useState(() => initialDraft?.socialNotes || '');
  const [viaCepLoading, setViaCepLoading] = useState(false);
  const [cepInfo, setCepInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<Guest | null>(() => initialDraft?.existing || null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [cpfTouched, setCpfTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  // Auto-save form draft on changes
  useEffect(() => {
    const isDirty = Boolean(
      name ||
      cpf ||
      susCard ||
      phone ||
      dateOfBirth ||
      responsible ||
      reason ||
      appointmentDate ||
      appointmentTime ||
      medicalNotes ||
      addressStreet ||
      addressNeighborhood ||
      addressNumber ||
      addressComplement ||
      notes ||
      socialNotes ||
      (hasCompanion && companions.some(c => c.name || c.phone || c.relationship)) ||
      !modalOpen
    );

    if (isDirty) {
      const draft: FormDraft = {
        name,
        dateOfBirth,
        phone,
        cpf,
        susCard,
        hasCompanion,
        companions,
        reason,
        responsible,
        appointmentDate,
        appointmentTime,
        medicalNotes,
        medicalType,
        medicalStatus,
        addressZip,
        addressState,
        addressCity,
        addressNeighborhood,
        addressStreet,
        addressNumber,
        addressComplement,
        notes,
        socialNotes,
        existing,
        modalOpen,
      };
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // ignore storage errors
      }
    }
  }, [
    name,
    dateOfBirth,
    phone,
    cpf,
    susCard,
    hasCompanion,
    companions,
    reason,
    responsible,
    appointmentDate,
    appointmentTime,
    medicalNotes,
    medicalType,
    medicalStatus,
    addressZip,
    addressState,
    addressCity,
    addressNeighborhood,
    addressStreet,
    addressNumber,
    addressComplement,
    notes,
    socialNotes,
    existing,
    modalOpen,
  ]);


  const age = dateOfBirth ? calculateAge(dateOfBirth) : null;
  const isMinor = age !== null && age < 18;

  const cpfDigits = onlyDigits(cpf);
  const missingName = submitted && !name.trim();
  const missingDOB = submitted && !dateOfBirth;
  const missingPhone = submitted && !phone.trim();
  const missingCPF = submitted && !cpf.trim();
  const invalidCPF =
    (cpfDigits.length === 11 || ((submitted || cpfTouched) && cpfDigits.length > 0)) &&
    !validateCPF(cpf);
  const missingSusCard = submitted && !susCard.trim();
  const missingResponsible = submitted && isMinor && !responsible.trim();
  const missingState = submitted && !addressState.trim();
  const missingCity = submitted && !addressCity.trim();
  const missingNeighborhood = submitted && !addressNeighborhood.trim();
  const missingStreet = submitted && !addressStreet.trim();
  const missingNumber = submitted && !addressNumber.trim();
  const isNoNumber = addressNumber.trim().toUpperCase() === 'S/N';

  function errorInputClass(isError: boolean) {
    return isError
      ? 'border-rose-400 dark:border-rose-500 bg-rose-50/30 dark:bg-rose-950/20 ring-4 ring-rose-500/10 dark:ring-rose-500/20'
      : '';
  }

  function addCompanion() {
    setCompanions(prev => [...prev, { name: '', phone: '', relationship: '' }]);
  }

  function removeCompanion(index: number) {
    setCompanions(prev => prev.filter((_, i) => i !== index));
  }

  function updateCompanion(index: number, field: 'name' | 'phone' | 'relationship', val: string) {
    setCompanions(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  }

  async function lookupCEP() {
    const cepDigits = onlyDigits(addressZip);
    setCepInfo(null);
    if (cepDigits.length !== 8) return;
    try {
      setViaCepLoading(true);
      const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
      const data = await res.json();
      if (data.erro) {
        setCepInfo('CEP não localizado na base do Correios.');
        return;
      }
      setAddressState(data.uf || '');
      setAddressCity(data.localidade || '');
      setAddressNeighborhood(data.bairro || '');
      setAddressStreet(data.logradouro || '');
      if (data.complemento) setAddressComplement(data.complemento);
      setCepInfo('Endereço preenchido automaticamente pelo CEP.');
      toast.success('Endereço preenchido via CEP!');
    } catch {
      setCepInfo('Erro ao buscar CEP. Tente novamente.');
    } finally {
      setViaCepLoading(false);
    }
  }

  function populateFromGuest(found: Guest) {
    setExisting(found);
    setName(found.name || '');
    setDOB(found.dateOfBirth || '');
    setPhone(found.phone || '');
    setCPF(found.cpf || '');
    setSusCard(found.susCard || '');
    setHasCompanion(!!found.hasCompanion);
    const parsedComps = parseCompanions(found.companions);
    setCompanions(parsedComps.length > 0 ? parsedComps : [{ name: '', phone: '', relationship: '' }]);
    setReason(found.reason || '');
    setResponsible(found.responsible || '');
    setAppointmentDate(found.appointmentDate || '');
    setAppointmentTime(found.appointmentTime || '');
    setMedicalNotes(found.medicalNotes || '');
    setMedicalType(found.medicalType || 'consulta');
    setMedicalStatus(found.medicalStatus || 'aguardando');
    setAddressZip(found.addressZip || '');
    setAddressState(found.addressState || '');
    setAddressCity(found.addressCity || '');
    setAddressNeighborhood(found.addressNeighborhood || '');
    setAddressStreet(found.addressStreet || '');
    setAddressNumber(found.addressNumber || '');
    setAddressComplement(found.addressComplement || '');
    setNotes(found.notes || '');
    setSocialNotes(found.socialNotes || '');
    setInfo('Dados do hóspede carregados com sucesso.');
    toast.info('Dados carregados com sucesso!');
  }

  async function handleCpfInputChange(val: string) {
    const formatted = formatCPF(val);
    setCPF(formatted);
    if (onlyDigits(formatted).length < 11) {
      setCpfTouched(false);
      return;
    }
    if (validateCPF(formatted)) {
      const found = await findGuestByCPF(formatted);
      if (found && found.id !== existing?.id) {
        populateFromGuest(found);
      }
    }
  }

  async function onCPFBlur() {
    if (onlyDigits(cpf).length > 0) {
      setCpfTouched(true);
    }
    if (!validateCPF(cpf)) return;
    const found = await findGuestByCPF(cpf);
    if (found && found.id !== existing?.id) {
      populateFromGuest(found);
    }
  }

  function handleModalConfirm(typedCpf: string, foundGuest: Guest | null) {
    if (foundGuest) {
      populateFromGuest(foundGuest);
    } else {
      setCPF(typedCpf);
      setExisting(null);
      setInfo(null);
    }
    setModalOpen(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setError(null);

    const missing: string[] = [];
    if (!name.trim()) missing.push('Nome Completo');
    if (!cpf.trim()) missing.push('CPF');
    if (!susCard.trim()) missing.push('Nº do Cartão do SUS');
    if (!phone.trim()) missing.push('Telefone');
    if (!dateOfBirth) missing.push('Data de Nascimento');
    if (isMinor && !responsible.trim()) missing.push('Responsável pelo Hóspede');
    if (!addressState.trim()) missing.push('Estado (UF)');
    if (!addressCity.trim()) missing.push('Cidade');
    if (!addressNeighborhood.trim()) missing.push('Bairro');
    if (!addressStreet.trim()) missing.push('Rua / Logradouro');
    if (!addressNumber.trim()) missing.push('Número (ou S/N)');

    const fail = (errMsg: string, toastMsg: string) => {
      setError(errMsg);
      toast.error(toastMsg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (missing.length > 0) {
      fail(`Preencha todos os campos obrigatórios: ${missing.join(', ')}.`, 'Preencha os campos obrigatórios.');
      return;
    }
    if (!validateCPF(cpf)) {
      fail('O CPF informado é inválido.', 'CPF inválido.');
      return;
    }
    const todayIso = getTodayISO();
    if (dateOfBirth > todayIso) {
      fail('A data de nascimento não pode ser no futuro.', 'Data de nascimento inválida.');
      return;
    }
    if (appointmentTime && !isValidTimeBR(appointmentTime)) {
      fail('O horário da consulta informado é inválido. Use o formato HH:MM (ex: 08:30).', 'Horário da consulta inválido.');
      return;
    }

    const cleanedCompanions: Companion[] = hasCompanion
      ? companions
          .map(c => ({
            name: c.name.trim(),
            phone: c.phone ? formatPhone(c.phone) : '',
            relationship: (c.relationship || '').trim(),
          }))
          .filter(c => c.name.length > 0 || c.phone.length > 0 || c.relationship.length > 0)
      : [];

    for (const comp of cleanedCompanions) {
      if (!comp.name) {
        fail('Informe o nome completo de todos os acompanhantes.', 'Nome do acompanhante obrigatório.');
        return;
      }
      if (comp.phone && onlyDigits(comp.phone).length < 10) {
        fail(`O celular do acompanhante "${comp.name}" está incompleto (informe DDD + número).`, 'Celular de acompanhante inválido.');
        return;
      }
    }

    const isCurrentlyPresent = existing?.status === 'presente';
    const nextStatus: Status = isCurrentlyPresent ? 'presente' : 'agendado';

    const guestId = existing?.id ?? crypto.randomUUID();
    const g: Guest = {
      id: guestId,
      name: name.trim(),
      dateOfBirth,
      phone: formatPhone(phone),
      cpf: formatCPF(cpf),
      susCard: formatSUS(susCard),
      hasCompanion,
      companions: cleanedCompanions,
      reason,
      responsible: isMinor ? responsible : '',
      appointmentDate: appointmentDate || undefined,
      appointmentTime: appointmentTime || undefined,
      medicalNotes,
      medicalType,
      medicalStatus: 'aguardando',
      addressZip,
      addressState,
      addressCity,
      addressNeighborhood,
      addressStreet,
      addressNumber,
      addressComplement,
      notes: notes.trim() || undefined,
      socialNotes: socialNotes.trim() || undefined,
      status: nextStatus,
      checkInAt: isCurrentlyPresent ? existing?.checkInAt : undefined,
      checkOutAt: undefined,
    };

    try {
      setSaving(true);
      await upsertGuest(g);

      if (user) {
        const apptSummary = formatAppointmentDisplay(appointmentDate, appointmentTime);
        const apptText = apptSummary ? ` (Consulta: ${apptSummary})` : '';
        await addAudit({
          id: crypto.randomUUID(),
          guestId: g.id,
          fromStatus: existing?.status,
          toStatus: nextStatus,
          at: new Date().toISOString(),
          byUser: user.username,
          note: isCurrentlyPresent
            ? `Dados atualizados durante estadia ativa${apptText}`
            : existing
              ? `Encaminhado pela Secretaria de Saúde${apptText}`
              : `Cadastro realizado e encaminhado para a Casa de Apoio${apptText}`,
        });
      }

      clearDraft();
      toast.success(
        isCurrentlyPresent
          ? 'Dados da estadia ativa atualizados com sucesso!'
          : existing
            ? 'Hóspede encaminhado! Aguardando chegada na Casa de Apoio.'
            : 'Hóspede cadastrado e encaminhado para a Casa de Apoio!'
      );
      nav(isCurrentlyPresent ? `/hospedes/${g.id}` : '/recepcao?tab=agendado');
    } catch {
      setError('Falha ao salvar hóspede. Tente novamente.');
      toast.error('Erro ao salvar hóspede.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container-page py-6 space-y-5">
      {/* Pre-check CPF Modal */}
      <CpfPreCheckModal
        open={modalOpen}
        onSkip={() => setModalOpen(false)}
        onConfirm={handleModalConfirm}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:min-h-[44px]">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
            {existing ? 'Editar Hóspede / Nova Estadia' : 'Cadastrar Novo Hóspede'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Preencha os dados do paciente e da consulta para encaminhar à Casa de Apoio
          </p>
        </div>

        <button
          type="button"
          className="btn-secondary self-start sm:self-auto cursor-pointer"
          onClick={() => setModalOpen(true)}
        >
          Consultar outro CPF
        </button>
      </div>

      {existing?.status === 'presente' && (
        <div className="p-3.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-800 dark:text-amber-200 text-xs font-medium">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              Atenção: <strong>{existing.name}</strong> já está com estadia ativa (<strong>Na casa</strong>). Salvar este formulário apenas atualizará os dados sem apagar o registro de entrada.
            </span>
          </div>
          <button
            type="button"
            onClick={() => nav(`/hospedes/${existing.id}`)}
            className="btn-secondary !py-1.5 !px-3 text-xs shrink-0 self-start sm:self-auto cursor-pointer"
          >
            Abrir Ficha / Saída
          </button>
        </div>
      )}

      {info && existing?.status !== 'presente' && (
        <div className="p-3.5 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 flex items-center gap-2.5 text-blue-800 dark:text-blue-200 text-xs font-medium">
          <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>{info}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 flex items-center gap-2.5 text-rose-800 dark:text-rose-200 text-xs font-medium">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form noValidate onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Coluna Esquerda: 1. Consulta -> 2. Dados Pessoais -> 3. Observações */}
        <div className="lg:col-span-7 space-y-5">
          {/* Card 1: Consulta e Atendimento Médico */}
          <div className="card p-5 sm:p-6 space-y-4">
            <div className="pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                1. Consulta e Atendimento Médico
              </h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="label">Dia da Consulta</label>
                  <DateInput
                    value={appointmentDate}
                    onChange={setAppointmentDate}
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
                      className={`input pr-14 tabular-nums ${
                        submitted && appointmentTime && !isValidTimeBR(appointmentTime)
                          ? 'border-rose-400 dark:border-rose-500 ring-2 ring-rose-500/15'
                          : ''
                      }`}
                      value={appointmentTime}
                      onChange={e => setAppointmentTime(formatTimeBR(e.target.value))}
                      autoComplete="off"
                    />
                    <div className="absolute right-2 flex items-center gap-0.5">
                      {appointmentTime && (
                        <button
                          type="button"
                          onClick={() => setAppointmentTime('')}
                          className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                          title="Limpar horário"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <span className="p-1 text-slate-400 pointer-events-none">
                        <Clock className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                  {submitted && appointmentTime && !isValidTimeBR(appointmentTime) && (
                    <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      Horário inválido (00:00 a 23:59).
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="label">Hospital / Clínica de Atendimento</label>
                <SmartAutocomplete
                  value={medicalNotes}
                  onChange={setMedicalNotes}
                  options={hospitalOptions}
                  emptyText="Hospital/Clínica não listado. Pressione Enter para usar o nome digitado."
                />
              </div>

              <div>
                <label className="label">Procedimento / Motivo</label>
                <SmartAutocomplete
                  value={reason}
                  onChange={setReason}
                  options={PROCEDURE_SUGGESTIONS}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Dados Pessoais */}
          <div className="card p-5 sm:p-6 space-y-4">
            <div className="pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                2. Dados Pessoais
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">
                  Nome Completo <span className="text-slate-400 dark:text-slate-500 font-normal">*</span>
                </label>
                <input
                  className={`input ${errorInputClass(missingName)}`}
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
                {missingName && (
                  <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    O nome completo é obrigatório.
                  </span>
                )}
              </div>

              <div>
                <label className="label">
                  CPF <span className="text-slate-400 dark:text-slate-500 font-normal">*</span>
                </label>
                <input
                  className={`input tabular-nums ${errorInputClass(missingCPF || invalidCPF)}`}
                  value={cpf}
                  maxLength={14}
                  inputMode="numeric"
                  onChange={e => handleCpfInputChange(e.target.value)}
                  onBlur={onCPFBlur}
                />
                {missingCPF && (
                  <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    CPF é obrigatório.
                  </span>
                )}
                {invalidCPF && (
                  <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    CPF inválido. Verifique os números digitados.
                  </span>
                )}
              </div>

              <div>
                <label className="label">
                  Nº do Cartão do SUS <span className="text-slate-400 dark:text-slate-500 font-normal">*</span>
                </label>
                <input
                  className={`input tabular-nums ${errorInputClass(missingSusCard)}`}
                  value={susCard}
                  onChange={e => setSusCard(formatSUS(e.target.value))}
                />
                {missingSusCard && (
                  <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Nº do Cartão do SUS é obrigatório.
                  </span>
                )}
              </div>

              <div>
                <label className="label">
                  Telefone <span className="text-slate-400 dark:text-slate-500 font-normal">*</span>
                </label>
                <input
                  className={`input tabular-nums ${errorInputClass(missingPhone)}`}
                  value={phone}
                  onChange={e => setPhone(formatPhone(e.target.value))}
                />
                {missingPhone && (
                  <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Telefone é obrigatório.
                  </span>
                )}
              </div>

              <div>
                <label className="label">
                  Data de Nascimento <span className="text-slate-400 dark:text-slate-500 font-normal">*</span>
                </label>
                <DateInput
                  value={dateOfBirth}
                  onChange={setDOB}
                  hasError={missingDOB}
                  maxDate={getTodayISO()}
                />
                {missingDOB && (
                  <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Data de nascimento é obrigatória.
                  </span>
                )}
                {age !== null && (
                  <span className="text-xs text-slate-500 font-medium mt-1 inline-block tabular-nums">
                    Idade: <strong>{age} anos</strong> {isMinor && '(Menor de 18 anos)'}
                  </span>
                )}
              </div>

              {isMinor && (
                <div className="sm:col-span-2">
                  <label className="label">
                    Responsável pelo Hóspede <span className="text-slate-400 dark:text-slate-500 font-normal">*</span>
                  </label>
                  <input
                    className={`input ${errorInputClass(missingResponsible)}`}
                    value={responsible}
                    onChange={e => setResponsible(e.target.value)}
                  />
                  {missingResponsible && (
                    <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      Responsável é obrigatório para menores de 18 anos.
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Observações da Estadia */}
          <div className="card p-5 sm:p-6 space-y-4">
            <div className="pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                3. Observações (opcional)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Observações da estadia</label>
                <textarea
                  rows={3}
                  className="input min-h-[76px] py-2 resize-y"
                  placeholder="Dieta, alergias, cadeira de rodas, horários de medicação..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Observações sociais</label>
                <textarea
                  rows={3}
                  className="input min-h-[76px] py-2 resize-y"
                  placeholder="Anotações de assistência social, situação familiar ou demandas..."
                  value={socialNotes}
                  onChange={e => setSocialNotes(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Coluna Direita: 4. Acompanhantes -> 5. Endereço -> Ações */}
        <div className="lg:col-span-5 space-y-5">
          {/* Card 4: Acompanhantes */}
          <div className="card p-5 sm:p-6 space-y-4">
            <div className="pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                4. Acompanhantes
              </h2>
            </div>

            <div className="space-y-3.5">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                  checked={hasCompanion}
                  onChange={e => {
                    setHasCompanion(e.target.checked);
                    if (e.target.checked && companions.length === 0) {
                      setCompanions([{ name: '', phone: '', relationship: '' }]);
                    }
                  }}
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Hóspede possui acompanhante(s)
                </span>
              </label>

              {hasCompanion && (
                <div className="space-y-3 pt-1">
                  {companions.map((comp, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          {idx + 1}º Acompanhante
                        </span>
                        {companions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCompanion(idx)}
                            className="text-xs font-medium text-rose-600 hover:text-rose-700 dark:hover:text-rose-400 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Remover este acompanhante"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Remover</span>
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="label">Nome do Acompanhante</label>
                          <input
                            type="text"
                            className="input"
                            value={comp.name}
                            onChange={e => updateCompanion(idx, 'name', e.target.value)}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="label">Parentesco</label>
                            <select
                              className="input"
                              value={comp.relationship || ''}
                              onChange={e => updateCompanion(idx, 'relationship', e.target.value)}
                            >
                              <option value="">Selecione...</option>
                              {COMPANION_RELATIONSHIPS.map(rel => (
                                <option key={rel} value={rel}>
                                  {rel}
                                </option>
                              ))}
                              {comp.relationship &&
                                !(COMPANION_RELATIONSHIPS as readonly string[]).includes(comp.relationship) && (
                                  <option value={comp.relationship}>{comp.relationship}</option>
                                )}
                            </select>
                          </div>

                          <div>
                            <label className="label">Celular</label>
                            <input
                              type="tel"
                              inputMode="numeric"
                              placeholder="(64) 99999-9999"
                              className="input tabular-nums"
                              value={comp.phone || ''}
                              maxLength={15}
                              onChange={e =>
                                updateCompanion(idx, 'phone', formatPhone(e.target.value))
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addCompanion}
                    className="btn-secondary w-full cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 text-slate-500" />
                    <span>Adicionar outro acompanhante ({companions.length + 1}º)</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Card 5: Endereço de Origem */}
          <div className="card p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                5. Endereço de Origem
              </h2>
              {(addressCity.trim().toLowerCase() !== 'quirinópolis' ||
                addressState.trim().toUpperCase() !== 'GO') && (
                <button
                  type="button"
                  onClick={() => {
                    setAddressCity('Quirinópolis');
                    setAddressState('GO');
                    if (!addressZip.trim()) setAddressZip('75860-000');
                  }}
                  className="text-xs font-medium text-brand-700 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200/70 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Usar Quirinópolis - GO
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-5">
                <label className="label">CEP</label>
                <div className="flex gap-1.5">
                  <input
                    className="input tabular-nums"
                    value={addressZip}
                    onChange={e => setAddressZip(formatCEP(e.target.value))}
                    onBlur={lookupCEP}
                  />
                  <button
                    type="button"
                    onClick={lookupCEP}
                    disabled={viaCepLoading}
                    className="btn-secondary px-2.5 shrink-0 cursor-pointer"
                    title="Buscar dados do CEP"
                  >
                    {viaCepLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {cepInfo && <span className="text-xs text-slate-500 mt-1 inline-block">{cepInfo}</span>}
              </div>

              <div className="sm:col-span-5">
                <label className="label">
                  Cidade <span className="text-slate-400 dark:text-slate-500 font-normal">*</span>
                </label>
                <input
                  className={`input ${errorInputClass(missingCity)}`}
                  value={addressCity}
                  onChange={e => setAddressCity(e.target.value)}
                />
                {missingCity && (
                  <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Cidade é obrigatória.
                  </span>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="label">
                  UF <span className="text-slate-400 dark:text-slate-500 font-normal">*</span>
                </label>
                <input
                  className={`input uppercase ${errorInputClass(missingState)}`}
                  maxLength={2}
                  value={addressState}
                  onChange={e => setAddressState(e.target.value.toUpperCase())}
                />
                {missingState && (
                  <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Obrigatório.
                  </span>
                )}
              </div>

              <div className="sm:col-span-5">
                <label className="label">
                  Bairro <span className="text-slate-400 dark:text-slate-500 font-normal">*</span>
                </label>
                <input
                  className={`input ${errorInputClass(missingNeighborhood)}`}
                  value={addressNeighborhood}
                  onChange={e => setAddressNeighborhood(e.target.value)}
                />
                {missingNeighborhood && (
                  <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Bairro é obrigatório.
                  </span>
                )}
              </div>

              <div className="sm:col-span-4">
                <label className="label">
                  Rua / Logradouro <span className="text-slate-400 dark:text-slate-500 font-normal">*</span>
                </label>
                <input
                  className={`input ${errorInputClass(missingStreet)}`}
                  value={addressStreet}
                  onChange={e => setAddressStreet(e.target.value)}
                />
                {missingStreet && (
                  <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Rua é obrigatória.
                  </span>
                )}
              </div>

              <div className="sm:col-span-3">
                <label className="label">
                  Número <span className="text-slate-400 dark:text-slate-500 font-normal">*</span>
                </label>
                {!isNoNumber && (
                  <input
                    className={`input ${errorInputClass(missingNumber)}`}
                    value={addressNumber}
                    onChange={e => setAddressNumber(e.target.value)}
                  />
                )}
                <label
                  className={`inline-flex items-center gap-2 cursor-pointer select-none transition-colors ${
                    isNoNumber
                      ? 'h-9 px-3 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 w-full'
                      : 'mt-1.5 text-xs text-slate-400 dark:text-slate-500 opacity-70 hover:opacity-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                    checked={isNoNumber}
                    onChange={e => setAddressNumber(e.target.checked ? 'S/N' : '')}
                  />
                  <span>Sem número</span>
                </label>
                {missingNumber && (
                  <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Informe o nº.
                  </span>
                )}
              </div>

              <div className="sm:col-span-12">
                <label className="label">Complemento</label>
                <input
                  className="input"
                  value={addressComplement}
                  onChange={e => setAddressComplement(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Action Form Footer */}
          <div className="card p-4 flex flex-col sm:flex-row items-center justify-end gap-2.5">
            <Link
              to="/hospedes"
              onClick={() => clearDraft()}
              className="btn-secondary w-full sm:w-auto text-center"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full sm:flex-1 py-2.5 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Salvando Dados...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>{existing ? 'Atualizar e Encaminhar' : 'Salvar e Encaminhar'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}