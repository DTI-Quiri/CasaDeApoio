import React, { useEffect, useState } from 'react';
import { Sliders, Save, Loader2, Users, Clock, Info } from 'lucide-react';
import { toast } from 'sonner';
import { getSettings, updateSettings } from '../services/guests';

export default function ConfiguracoesPage() {
  const [alertDays, setAlertDays] = useState('7');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const s = await getSettings();
        if (!mounted) return;
        setAlertDays(String(s.alertDays || 7));
        setMaxCapacity(s.maxCapacity && s.maxCapacity > 0 ? String(s.maxCapacity) : '');
      } catch {
        toast.error('Não foi possível carregar as configurações.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedDays = Number(alertDays);
    if (!Number.isFinite(parsedDays) || parsedDays < 1 || parsedDays > 365) {
      toast.error('O limite de dias em alerta deve ser entre 1 e 365.');
      return;
    }

    let parsedCap: number | undefined;
    if (maxCapacity.trim() !== '') {
      const cap = Number(maxCapacity);
      if (!Number.isFinite(cap) || cap < 1 || cap > 9999) {
        toast.error('A capacidade de vagas deve ser um número positivo.');
        return;
      }
      parsedCap = Math.round(cap);
    }

    try {
      setSaving(true);
      await updateSettings({
        alertDays: Math.round(parsedDays),
        maxCapacity: parsedCap,
      });
      toast.success('Configurações salvas com sucesso.');
    } catch {
      toast.error('Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container-page py-6 max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 border border-brand-200/70 dark:border-brand-700/50 flex items-center justify-center text-brand-700 dark:text-brand-300">
          <Sliders className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Configurações da Casa
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ajuste o prazo de alerta de estadias longas e a capacidade total de vagas.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card p-5 space-y-5">
        {loading ? (
          <div className="py-10 flex items-center justify-center text-sm text-slate-500 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando configurações...
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="label flex items-center gap-1.5" htmlFor="cfg-alert-days">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Alerta de estadia prolongada (dias)
                </label>
                <input
                  id="cfg-alert-days"
                  type="number"
                  min={1}
                  max={365}
                  required
                  className="input tabular-nums"
                  value={alertDays}
                  onChange={e => setAlertDays(e.target.value)}
                  disabled={saving}
                />
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Hóspedes na casa há mais que esse número de dias aparecem destacados no painel.
                </p>
              </div>

              <div>
                <label className="label flex items-center gap-1.5" htmlFor="cfg-max-capacity">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  Capacidade máxima de vagas (opcional)
                </label>
                <input
                  id="cfg-max-capacity"
                  type="number"
                  min={1}
                  max={9999}
                  placeholder="Ex.: 40 (deixe vazio para ocultar)"
                  className="input tabular-nums"
                  value={maxCapacity}
                  onChange={e => setMaxCapacity(e.target.value)}
                  disabled={saving}
                />
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Soma hóspedes e acompanhantes presentes para exibir ocupação e refeições no painel.
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 p-3 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                As alterações passam a valer para toda a equipe assim que forem salvas.
              </span>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary inline-flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Salvar configurações
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
