import { useState, useEffect, useRef, type FormEvent } from 'react';
import type { Guest, Status, Companion } from '../types';
import { upsertGuest, findGuestByCPF, addAudit } from '../services/guests';
import { useNavigate, Link } from 'react-router-dom';
import { validateCPF, formatCPF, formatSUS, onlyDigits, calculateAge } from '../utils/cpf';
import { parseCompanions } from '../utils/companion';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import CpfPreCheckModal from '../components/CpfPreCheckModal';
import SmartAutocomplete from '../components/SmartAutocomplete';
import DateInput from '../components/DateInput';
import { MEDICAL_LOCATIONS, PROCEDURE_SUGGESTIONS } from '../data/medicalLocations';
import {
  User,
  Users,
  Stethoscope,
  MapPin,
  ArrowLeft,
  Check,
  Loader2,
  AlertCircle,
  Search,
  Sparkles,
  Plus,
  Trash2,
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
  } catch (e) {}
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
    () => initialDraft?.companions || [{ name: '', cpf: '' }]
  );
  const [reason, setReason] = useState(() => initialDraft?.reason || '');
  const [responsible, setResponsible] = useState(() => initialDraft?.responsible || '');
  const [medicalNotes, setMedicalNotes] = useState(() => initialDraft?.medicalNotes || '');
  const [medicalType, setMedicalType] = useState<'consulta' | 'exame' | 'cirurgia' | 'outro'>(
    () => initialDraft?.medicalType || 'consulta'
  );
  const [medicalStatus, setMedicalStatus] = useState<'aguardando' | 'concluida'>(
    () => initialDraft?.medicalStatus || 'aguardando'
  );
  const [addressZip, setAddressZip] = useState(() => initialDraft?.addressZip || '');
  const [addressState, setAddressState] = useState(() => initialDraft?.addressState || '');
  const [addressCity, setAddressCity] = useState(() => initialDraft?.addressCity || '');
  const [addressNeighborhood, setAddressNeighborhood] = useState(
    () => initialDraft?.addressNeighborhood || ''
  );
  const [addressStreet, setAddressStreet] = useState(() => initialDraft?.addressStreet || '');
  const [addressNumber, setAddressNumber] = useState(() => initialDraft?.addressNumber || '');
  const [addressComplement, setAddressComplement] = useState(
    () => initialDraft?.addressComplement || ''
  );
  const [viaCepLoading, setViaCepLoading] = useState(false);
  const [cepInfo, setCepInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<Guest | null>(() => initialDraft?.existing || null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
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
      medicalNotes ||
      addressZip ||
      addressStreet ||
      addressCity ||
      addressNeighborhood ||
      addressNumber ||
      addressComplement ||
      (hasCompanion && companions.some(c => c.name || c.cpf)) ||
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
        existing,
        modalOpen,
      };
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {}
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
    existing,
    modalOpen,
  ]);

  // Prevent accidental tab close or page refresh warning when data is typed
  useEffect(() => {
    const isDirty = Boolean(
      name ||
      cpf ||
      susCard ||
      phone ||
      dateOfBirth ||
      responsible ||
      addressStreet
    );

    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [name, cpf, susCard, phone, dateOfBirth, responsible, addressStreet]);

  const age = dateOfBirth ? calculateAge(dateOfBirth) : null;
  const isMinor = age !== null && age < 18;

  const missingName = submitted && !name.trim();
  const missingDOB = submitted && !dateOfBirth;
  const missingPhone = submitted && !phone.trim();
  const missingCPF = submitted && !cpf.trim();
  const invalidCPF = submitted && !!cpf.trim() && !validateCPF(cpf);
  const missingSusCard = submitted && !susCard.trim();
  const missingResponsible = submitted && isMinor && !responsible.trim();
  const missingZip = submitted && !addressZip.trim();
  const missingState = submitted && !addressState.trim();
  const missingCity = submitted && !addressCity.trim();
  const missingNeighborhood = submitted && !addressNeighborhood.trim();
  const missingStreet = submitted && !addressStreet.trim();
  const missingNumber = submitted && !addressNumber.trim();

  function errorInputClass(isError: boolean) {
    return isError
      ? 'border-rose-400 dark:border-rose-500 bg-rose-50/30 dark:bg-rose-950/20 ring-4 ring-rose-500/10 dark:ring-rose-500/20'
      : '';
  }

  function formatPhone(v: string) {
    const s = onlyDigits(v).slice(0, 11);
    const parts = [s.slice(0, 2), s.slice(2, 7), s.slice(7, 11)];
    if (s.length <= 2) return parts[0] ? `(${parts[0]}` : '';
    if (s.length <= 7) return `(${parts[0]}) ${parts[1]}`;
    return `(${parts[0]}) ${parts[1]}-${parts[2]}`;
  }

  function addCompanion() {
    setCompanions(prev => [...prev, { name: '', cpf: '' }]);
  }

  function removeCompanion(index: number) {
    setCompanions(prev => prev.filter((_, i) => i !== index));
  }

  function updateCompanion(index: number, field: 'name' | 'cpf', val: string) {
    setCompanions(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  }

  function formatCEP(v: string) {
    const s = onlyDigits(v).slice(0, 8);
    if (s.length <= 5) return s;
    return `${s.slice(0, 5)}-${s.slice(5)}`;
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
    setCompanions(parsedComps.length > 0 ? parsedComps : [{ name: '', cpf: '' }]);
    setReason(found.reason || '');
    setResponsible(found.responsible || '');
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
    setInfo('Dados do hóspede carregados com sucesso.');
    toast.info('Dados carregados com sucesso!');
  }

  async function onCPFBlur() {
    setInfo(null);
    setExisting(null);
    if (!validateCPF(cpf)) return;
    const found = await findGuestByCPF(cpf);
    if (found) {
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
    if (!addressZip.trim()) missing.push('CEP');
    if (!addressState.trim()) missing.push('Estado (UF)');
    if (!addressCity.trim()) missing.push('Cidade');
    if (!addressNeighborhood.trim()) missing.push('Bairro');
    if (!addressStreet.trim()) missing.push('Rua / Logradouro');
    if (!addressNumber.trim()) missing.push('Número');

    if (missing.length > 0) {
      setError(`Preencha todos os campos obrigatórios: ${missing.join(', ')}.`);
      toast.error('Preencha os campos obrigatórios.');
      return;
    }
    if (!validateCPF(cpf)) {
      setError('O CPF informado é inválido.');
      toast.error('CPF inválido.');
      return;
    }

    const cleanedCompanions: Companion[] = hasCompanion
      ? companions
          .map(c => ({
            name: c.name.trim(),
            cpf: c.cpf ? formatCPF(c.cpf) : '',
          }))
          .filter(c => c.name.length > 0 || (c.cpf && c.cpf.length > 0))
      : [];

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
      status: 'presente' as Status,
      checkInAt: new Date().toISOString(),
    };

    try {
      setSaving(true);
      await upsertGuest(g);

      if (user) {
        await addAudit({
          id: crypto.randomUUID(),
          guestId: g.id,
          toStatus: 'presente',
          at: new Date().toISOString(),
          byUser: user.username,
          note: existing
            ? 'Nova estadia iniciada (Cadastro atualizado)'
            : 'Cadastro realizado e 1ª estadia iniciada',
        });
      }

      clearDraft();
      toast.success(existing ? 'Nova estadia registrada com sucesso!' : 'Hóspede cadastrado com sucesso!');
      nav('/dashboard');
    } catch {
      setError('Falha ao salvar hóspede. Tente novamente.');
      toast.error('Erro ao salvar hóspede.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container-page py-8 max-w-4xl space-y-6 animate-in fade-in duration-300">
      {/* Pre-check CPF Modal */}
      <CpfPreCheckModal
        open={modalOpen}
        onSkip={() => setModalOpen(false)}
        onConfirm={handleModalConfirm}
      />

      {/* Header with Back Button */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            onClick={() => clearDraft()}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
            title="Voltar ao Painel"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {existing ? 'Editar Hóspede / Nova Estadia' : 'Cadastrar Novo Hóspede'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Preencha os dados do hóspede para registrar a estadia na Casa de Apoio
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn-secondary text-xs font-semibold"
          onClick={() => setModalOpen(true)}
        >
          Consultar outro CPF
        </button>
      </div>

      {info && (
        <div className="p-4 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200/70 dark:border-brand-800/50 flex items-center gap-3 text-brand-700 dark:text-brand-300 text-sm font-medium animate-in fade-in">
          <Sparkles className="h-5 w-5 text-brand-600 shrink-0" />
          <span>{info}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-800/50 flex items-center gap-3 text-rose-700 dark:text-rose-300 text-sm font-medium animate-in fade-in">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form noValidate onSubmit={submit} className="space-y-6">
        {/* Card 1: Dados Pessoais */}
        <div className="card p-6 sm:p-7 space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Identificação e Dados Pessoais
              </h2>
              <p className="text-xs text-slate-400">Campos fundamentais para o registro do cidadão</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">
                Nome Completo <span className="text-rose-500">*</span>
              </label>
              <input
                className={`input ${errorInputClass(missingName)}`}
                value={name}
                onChange={e => setName(e.target.value)}
              />
              {missingName && (
                <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  O nome completo é obrigatório.
                </span>
              )}
            </div>

            <div>
              <label className="label">
                CPF <span className="text-rose-500">*</span>
              </label>
              <input
                className={`input ${errorInputClass(missingCPF || invalidCPF)}`}
                value={cpf}
                onChange={e => setCPF(formatCPF(e.target.value))}
                onBlur={onCPFBlur}
              />
              {missingCPF && (
                <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  CPF é obrigatório.
                </span>
              )}
              {invalidCPF && (
                <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  CPF inválido. Verifique os números digitados.
                </span>
              )}
            </div>

            <div>
              <label className="label">
                Nº do Cartão do SUS <span className="text-rose-500">*</span>
              </label>
              <input
                className={`input ${errorInputClass(missingSusCard)}`}
                value={susCard}
                onChange={e => setSusCard(formatSUS(e.target.value))}
              />
              {missingSusCard && (
                <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Nº do Cartão do SUS é obrigatório.
                </span>
              )}
            </div>

            <div>
              <label className="label flex items-center justify-between">
                <span>
                  Telefone <span className="text-rose-500">*</span>
                </span>
                <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500 normal-case">
                  (DDD) 9+NUMERO
                </span>
              </label>
              <input
                className={`input ${errorInputClass(missingPhone)}`}
                value={phone}
                onChange={e => setPhone(formatPhone(e.target.value))}
              />
              {missingPhone && (
                <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Telefone é obrigatório.
                </span>
              )}
            </div>

            <div>
              <label className="label">
                Data de Nascimento <span className="text-rose-500">*</span>
              </label>
              <DateInput
                value={dateOfBirth}
                onChange={setDOB}
                hasError={missingDOB}
              />
              {missingDOB && (
                <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Data de nascimento é obrigatória.
                </span>
              )}
              {age !== null && (
                <span className="text-xs text-slate-500 font-medium mt-1 inline-block">
                  Idade calculada: <strong>{age} anos</strong> {isMinor && '(Menor de 18 anos)'}
                </span>
              )}
            </div>

            {isMinor && (
              <div className="md:col-span-2">
                <label className="label">
                  Responsável pelo Hóspede <span className="text-rose-500">*</span>
                </label>
                <input
                  className={`input ${errorInputClass(missingResponsible)}`}
                  value={responsible}
                  onChange={e => setResponsible(e.target.value)}
                />
                {missingResponsible && (
                  <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Responsável é obrigatório para menores de 18 anos.
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Acompanhantes */}
        <div className="card p-6 sm:p-7 space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Acompanhantes
              </h2>
              <p className="text-xs text-slate-400">Registro de familiares ou acompanhantes durante a estadia</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                checked={hasCompanion}
                onChange={e => {
                  setHasCompanion(e.target.checked);
                  if (e.target.checked && companions.length === 0) {
                    setCompanions([{ name: '', cpf: '' }]);
                  }
                }}
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Hóspede possui acompanhante(s)
              </span>
            </label>

            {hasCompanion && (
              <div className="space-y-3.5 pt-1 animate-in fade-in duration-200">
                {companions.map((comp, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800/80 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-[11px] font-bold">
                          {idx + 1}
                        </span>
                        {idx + 1}º Acompanhante
                      </span>
                      {companions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCompanion(idx)}
                          className="text-xs font-semibold text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 flex items-center gap-1 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Remover este acompanhante"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remover</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                      <div className="sm:col-span-7">
                        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                          Nome do Acompanhante
                        </label>
                        <input
                          type="text"
                          className="input"
                          value={comp.name}
                          onChange={e => updateCompanion(idx, 'name', e.target.value)}
                        />
                      </div>

                      <div className="sm:col-span-5">
                        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
                          <span>CPF</span>
                          <span className="text-[10px] text-slate-400 font-normal">(Opcional)</span>
                        </label>
                        <input
                          type="text"
                          className="input"
                          value={comp.cpf || ''}
                          maxLength={14}
                          onChange={e =>
                            updateCompanion(idx, 'cpf', formatCPF(e.target.value))
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addCompanion}
                  className="btn-secondary py-2.5 px-4 text-xs font-semibold w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-500 transition-all cursor-pointer shadow-xs"
                >
                  <Plus className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  <span>+ Adicionar outro acompanhante ({companions.length + 1}º)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Informações de Saúde e Atendimento com Autocomplete Inteligente */}
        <div className="card p-6 sm:p-7 space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
              <Stethoscope className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Informações de Saúde e Atendimento
              </h2>
              <p className="text-xs text-slate-400">
                O que o hóspede irá fazer e qual hospital/clínica em Goiânia ou Aparecida de Goiânia
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Campo Inteligente: Procedimento / Motivo */}
            <div className="md:col-span-2">
              <label className="label flex items-center justify-between">
                <span>Procedimento / O que o hóspede irá fazer</span>
                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 normal-case">(Opcional)</span>
              </label>
              <SmartAutocomplete
                value={reason}
                onChange={setReason}
                options={PROCEDURE_SUGGESTIONS}
              />
            </div>

            {/* Campo Inteligente: Hospital / Clínica */}
            <div className="md:col-span-2">
              <label className="label flex items-center justify-between">
                <span>Hospital / Clínica / Centro de Atendimento (Goiânia e Aparecida de Goiânia)</span>
                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 normal-case">(Opcional)</span>
              </label>
              <SmartAutocomplete
                value={medicalNotes}
                onChange={setMedicalNotes}
                options={hospitalOptions}
                emptyText="Hospital/Clínica não listado. Pressione Enter para usar o nome digitado."
              />
            </div>

            <div className="md:col-span-2">
              <label className="label flex items-center justify-between">
                <span>Status da Pendência Médica</span>
                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 normal-case">(Opcional)</span>
              </label>
              <select
                className="input"
                value={medicalStatus}
                onChange={e => setMedicalStatus((e.target.value as Guest['medicalStatus']) || 'aguardando')}
              >
                <option value="aguardando">Aguardando atendimento</option>
                <option value="concluida">Atendimento concluído</option>
              </select>
            </div>
          </div>
        </div>

        {/* Card 4: Endereço */}
        <div className="card p-6 sm:p-7 space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Endereço de Origem
              </h2>
              <p className="text-xs text-slate-400">Localização e residência de origem do hóspede (Campos obrigatórios)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">
                CEP <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  className={`input ${errorInputClass(missingZip)}`}
                  value={addressZip}
                  onChange={e => setAddressZip(formatCEP(e.target.value))}
                  onBlur={lookupCEP}
                />
                <button
                  type="button"
                  onClick={lookupCEP}
                  disabled={viaCepLoading}
                  className="btn-secondary px-3 shrink-0"
                  title="Buscar dados do CEP"
                >
                  {viaCepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </button>
              </div>
              {missingZip && (
                <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  CEP é obrigatório.
                </span>
              )}
              {cepInfo && <span className="text-xs text-slate-500 mt-1 inline-block">{cepInfo}</span>}
            </div>

            <div>
              <label className="label">
                Estado (UF) <span className="text-rose-500">*</span>
              </label>
              <input
                className={`input ${errorInputClass(missingState)}`}
                value={addressState}
                onChange={e => setAddressState(e.target.value)}
              />
              {missingState && (
                <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Estado (UF) é obrigatório.
                </span>
              )}
            </div>

            <div>
              <label className="label">
                Cidade <span className="text-rose-500">*</span>
              </label>
              <input
                className={`input ${errorInputClass(missingCity)}`}
                value={addressCity}
                onChange={e => setAddressCity(e.target.value)}
              />
              {missingCity && (
                <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Cidade é obrigatória.
                </span>
              )}
            </div>

            <div>
              <label className="label">
                Bairro <span className="text-rose-500">*</span>
              </label>
              <input
                className={`input ${errorInputClass(missingNeighborhood)}`}
                value={addressNeighborhood}
                onChange={e => setAddressNeighborhood(e.target.value)}
              />
              {missingNeighborhood && (
                <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Bairro é obrigatório.
                </span>
              )}
            </div>

            <div>
              <label className="label">
                Rua / Logradouro <span className="text-rose-500">*</span>
              </label>
              <input
                className={`input ${errorInputClass(missingStreet)}`}
                value={addressStreet}
                onChange={e => setAddressStreet(e.target.value)}
              />
              {missingStreet && (
                <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Rua / Logradouro é obrigatório.
                </span>
              )}
            </div>

            <div>
              <label className="label">
                Número <span className="text-rose-500">*</span>
              </label>
              <input
                className={`input ${errorInputClass(missingNumber)}`}
                value={addressNumber}
                onChange={e => setAddressNumber(e.target.value)}
              />
              {missingNumber && (
                <span className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Número é obrigatório.
                </span>
              )}
            </div>

            <div className="md:col-span-3">
              <label className="label flex items-center justify-between">
                <span>Complemento</span>
                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 normal-case">(Opcional)</span>
              </label>
              <input
                className="input"
                value={addressComplement}
                onChange={e => setAddressComplement(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Action Form Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4">
          <Link
            to="/dashboard"
            onClick={() => clearDraft()}
            className="btn-secondary w-full sm:w-auto text-center"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full sm:w-auto shadow-md"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Salvando Dados...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>{existing ? 'Atualizar e Iniciar Estadia' : 'Salvar e Registrar Entrada'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}