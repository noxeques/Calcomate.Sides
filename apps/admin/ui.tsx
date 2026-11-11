import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Check, FileText, Inbox, LoaderCircle, X } from 'lucide-react';
import type { AdminApi, DonationFilter, Page } from '../../shared/model';
import { AppError } from '../../shared/validation';
import { sendCommand } from './api';
import type { Command } from './api';

export interface ModuleProps { api: AdminApi; revision: number; refresh: () => void }
export function message(error: unknown): string {
  return error instanceof AppError ? error.message : 'İşlem tamamlanamadı. Yeniden deneyin.';
}
export function useRead<T>(load: () => Promise<T>) {
  const [state, setState] = useState<{ value: T | null; error: string; loading: boolean }>({ value: null, error: '', loading: true });
  useEffect(() => {
    let active = true;
    setState({ value: null, error: '', loading: true });
    load().then((value) => { if (active) setState({ value, error: '', loading: false }); },
      (error) => { if (active) setState({ value: null, error: message(error), loading: false }); });
    return () => { active = false; };
  }, [load]);
  return state;
}
export function useCommand(api: AdminApi, refresh: () => void) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const lock = useRef(false);
  async function execute(command: Command, success: string, onSuccess?: () => void) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await sendCommand(api, command);
      setFeedback({ text: result.repeated ? 'Önceki istek doğrulandı. ' + success : success, error: false });
      onSuccess?.();
      refresh();
    } catch (error) {
      setFeedback({ text: message(error), error: true });
      if (error instanceof AppError && error.code === 'PUBLIC_PENDING') refresh();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, execute, feedback, clear: () => setFeedback(null) };
}
export function Feedback({ text, error = false }: { text: string; error?: boolean }) {
  if (!text) return null;
  return <div className={'feedback admin-feedback ' + (error ? 'error' : 'success')} role={error ? 'alert' : 'status'}>
    {error ? <AlertCircle size={17} /> : <Check size={17} />}{text}
  </div>;
}
export function ReadState({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  if (error) return <div className="read-state"><Feedback text={error} error /><button className="button secondary" onClick={retry}>Yeniden dene</button></div>;
  return loading ? <div className="read-state" role="status"><LoaderCircle className="spin" size={19} /> Yükleniyor…</div> : null;
}
export function Empty({ title, detail }: { title: string; detail?: string }) {
  return <div className="admin-empty"><span><Inbox size={23} /></span><strong>{title}</strong>{detail && <p>{detail}</p>}</div>;
}
export function Pagination<T>({ value, onPage }: { value: Page<T>; onPage: (page: number) => void }) {
  if (value.pages === 1) return null;
  return <nav className="pagination" aria-label="Liste sayfaları">
    <button className="button secondary" aria-label="Önceki sayfa" disabled={value.page === 1} onClick={() => onPage(value.page - 1)}><ArrowLeft size={15} /></button>
    <span>Sayfa {value.page} / {value.pages} · {value.total} kayıt</span>
    <button className="button secondary" aria-label="Sonraki sayfa" disabled={value.page === value.pages} onClick={() => onPage(value.page + 1)}><ArrowRight size={15} /></button>
  </nav>;
}
export function Panel({ title, detail, action, children, className = '' }: { title: string; detail?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={'panel ' + className}>
    <div className="panel-head"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>
    {children}
  </section>;
}
export function Field({ title, hint, children, full = false }: { title: string; hint?: string; children: ReactNode; full?: boolean }) {
  return <label className={'field' + (full ? ' full' : '')}><span>{title}</span>{children}{hint && <small>{hint}</small>}</label>;
}
export function Dialog({ title, detail, onClose, busy, children }: { title: string; detail?: string; onClose: () => void; busy: boolean; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => { node?.close(); };
  }, []);
  return <dialog ref={dialog} className="dialog" aria-labelledby="dialog-title"
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="dialog-head"><div><h2 id="dialog-title">{title}</h2>{detail && <p>{detail}</p>}</div>
      <button className="icon-button" aria-label="Pencereyi kapat" disabled={busy} onClick={onClose}><X size={21} /></button>
    </div>
    <div className="dialog-body">{children}</div>
  </dialog>;
}
export function Filters({ filter, setFilter, campaignOptions, search = true }: {
  filter: DonationFilter; setFilter: (value: DonationFilter) => void; campaignOptions: string[]; search?: boolean;
}) {
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setFilter(Object.fromEntries(form) as DonationFilter);
  }
  return <form className="filter-bar" key={JSON.stringify(filter)} onSubmit={apply}>
    {search && <Field title="Ara"><input name="search" type="search" defaultValue={filter.search} placeholder="Bağışçı, referans, not…" maxLength={180} /></Field>}
    <Field title="Başlangıç"><input name="from" type="date" defaultValue={filter.from} /></Field>
    <Field title="Bitiş"><input name="to" type="date" defaultValue={filter.to} /></Field>
    <Field title="Kampanya"><select name="campaign" defaultValue={filter.campaign || ''}>
      <option value="">Tüm kampanyalar</option>
      {[...new Set([...(filter.campaign ? [filter.campaign] : []), ...campaignOptions])].map((name) => <option key={name}>{name}</option>)}
    </select></Field>
    <div className="actions"><button className="button secondary" type="submit">Uygula</button>
      <button type="reset" className="button plain" onClick={(event) => {
        event.preventDefault();
        event.currentTarget.form?.querySelectorAll<HTMLInputElement>('input').forEach((input) => { input.value = ''; });
        const select = event.currentTarget.form?.querySelector('select');
        if (select) select.value = '';
        setFilter({});
      }}>Temizle</button></div>
  </form>;
}
export function download(name: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function FileHelp({ children }: { children: ReactNode }) {
  return <div className="file-help"><FileText size={20} /> <div>{children}</div></div>;
}
