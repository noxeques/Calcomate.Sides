import type { PublicSnapshot } from '../../shared/model';
import { AppError, organizationId } from '../../shared/validation';
import { invalidPublication, publicEndpoint, visitorReply } from '../../shared/wire';
import { DEMO } from '../common/mode';

export async function getPublication(signal: AbortSignal): Promise<PublicSnapshot> {
  if (DEMO) {
    const publication = await (await import('../common/demo')).readDemoPublication();
    if (!publication) throw new AppError('EMPTY', 'Henüz bir yayın kopyası oluşturulmadı.');
    return publication;
  }
  const endpoint = publicEndpoint(import.meta.env.VITE_PUBLIC_APPS_SCRIPT_URL ?? '');
  const expected = organizationId(import.meta.env.VITE_ORGANIZATION_ID ?? '');
  const response = await fetch(endpoint + '?fresh=' + Date.now(), {
    cache: 'no-store', credentials: 'omit', mode: 'cors', redirect: 'follow', signal,
  });
  if (!response.ok) throw new AppError('CONNECTION', 'Yayın kaynağına bağlanılamadı.');
  const mediaType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (mediaType !== 'application/json') throw invalidPublication();
  let raw: unknown;
  try {
    raw = await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) throw invalidPublication();
    throw error;
  }
  return visitorReply(raw, expected);
}
