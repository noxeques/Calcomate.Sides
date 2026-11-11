export const DEMO = import.meta.env.DEV && import.meta.env.MODE === 'demo';

export function withDemoOrg(path: string): string {
  if (DEMO) {
    const org = new URLSearchParams(location.search).get('org');
    if (org) return path + '?org=' + encodeURIComponent(org);
  }
  return path;
}
