import { AppError, organizationId } from '../../shared/validation';
import { publicEndpoint, visitorReply } from '../../shared/wire';

export async function fetchPublication(endpoint: string, organization: string, signal: AbortSignal) {
  const url = publicEndpoint(endpoint);
  const expected = organizationId(organization);
  const response = await fetch(url + '?fresh=' + Date.now(), {
    cache: 'no-store', credentials: 'omit', mode: 'cors', redirect: 'follow', signal,
  });
  if (!response.ok) throw new AppError('CONNECTION', 'Yayın servisi yanıt veremedi. Biraz sonra yeniden deneyin.');
  if (!/^application\/json\s*(?:;|$)/i.test(response.headers.get('content-type') ?? '')) {
    throw new AppError('INVALID_PUBLICATION', 'Yayın servisi beklenen JSON yanıtını göndermedi.');
  }
  let raw: unknown;
  try {
    raw = await response.json();
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new AppError('INVALID_PUBLICATION', 'Yayın servisi geçersiz JSON gönderdi.');
  }
  return visitorReply(raw, expected);
}
