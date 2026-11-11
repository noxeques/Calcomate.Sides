import type { AdminApi, Mutation, MutationResult } from '../../shared/model';
import { AppError } from '../../shared/validation';
import { unwrap } from '../../shared/wire';
import type { Envelope } from '../../shared/wire';
import { DEMO } from '../common/mode';

interface Runner {
  withSuccessHandler(callback: (result: Envelope<unknown>) => void): Runner;
  withFailureHandler(callback: () => void): Runner;
  adminQuery(name: string, params: unknown): void;
  adminMutate(input: Mutation): void;
}
function rpc<T>(method: (runner: Runner) => void): Promise<T> {
  const runner = (window as Window & { google?: { script?: { run?: Runner } } }).google?.script?.run;
  if (!runner) return Promise.reject(new AppError('CONFIG', 'Kurulum eksik. Yönetim panelini Apps Script web uygulamasının /exec adresinde açın.'));
  return new Promise((resolve, reject) => {
    method(runner.withSuccessHandler((result) => {
      try { resolve(unwrap(result) as T); } catch (error) { reject(error); }
    }).withFailureHandler(() => reject(new AppError('CONNECTION', 'Apps Script yanıtı doğrulanamadı. İşlemi yeniden deneyin.'))));
  });
}
export async function getAdmin(): Promise<AdminApi> {
  if (import.meta.env.DEV && import.meta.env.MODE === 'demo') return (await import('../common/demo')).demoAdmin();
  const read = <T>(name: string, params?: unknown) => rpc<T>((runner) => runner.adminQuery(name, params ?? null));
  return {
    overview: (filter) => read('overview', filter),
    contents: (filter) => read('contents', filter),
    theme: () => read('theme'),
    donations: (filter) => read('donations', filter),
    history: (page) => read('history', page),
    publication: () => read('publication'),
    exportData: () => read('exportData'),
    exportDonations: (filter) => read('exportDonations', filter),
    mutate: (input) => rpc((runner) => runner.adminMutate(JSON.parse(JSON.stringify(input)) as Mutation)),
  };
}

type Command = Mutation extends infer M ? M extends Mutation ? Omit<M, 'requestId'> : never : never;
const pending = new Map<string, string>();
export async function sendCommand(api: AdminApi, input: Command): Promise<MutationResult> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(input)));
  const hash = Array.from(new Uint8Array(bytes), (part) => part.toString(16).padStart(2, '0')).join('');
  const context = DEMO ? new URLSearchParams(location.search).get('org') ?? 'default' : location.pathname;
  const key = 'calcomatesides:pending:' + context + ':' + hash;
  let saved: string | null = null;
  try { saved = sessionStorage.getItem(key); } catch { /* Embedded browser may deny storage. */ }
  const requestId = pending.get(key) ?? saved ?? crypto.randomUUID();
  pending.set(key, requestId);
  try { sessionStorage.setItem(key, requestId); } catch { /* Same-page retry still works. */ }
  function clear() {
    pending.delete(key);
    try { sessionStorage.removeItem(key); } catch { /* Storage unavailable. */ }
  }
  try {
    const result = await api.mutate({ ...input, requestId } as Mutation);
    clear();
    return result;
  } catch (error) {
    if (error instanceof AppError && ['VALIDATION', 'AUTH', 'CONFLICT', 'NOT_FOUND', 'LIMIT', 'IDEMPOTENCY'].includes(error.code)) clear();
    throw error;
  }
}
export type { Command };
