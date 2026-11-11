import type { PublicSnapshot } from '../../shared/model';
import { AppError } from '../../shared/validation';
import { DEMO } from '../common/mode';
import { fetchPublication } from './publication';

export async function getPublication(signal: AbortSignal): Promise<PublicSnapshot> {
  if (DEMO) {
    const publication = await (await import('../common/demo')).readDemoPublication();
    if (!publication) throw new AppError('EMPTY', 'Henüz bir yayın kopyası oluşturulmadı.');
    return publication;
  }
  return fetchPublication(import.meta.env.VITE_PUBLIC_APPS_SCRIPT_URL ?? '',
    import.meta.env.VITE_ORGANIZATION_ID ?? '', signal);
}
