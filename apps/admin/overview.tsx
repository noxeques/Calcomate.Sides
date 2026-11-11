import { useCallback, useState } from 'react';
import { ArrowRight, CalendarDays, ChartNoAxesColumnIncreasing, FileText, HeartHandshake, Radio } from 'lucide-react';
import { displayMoney, displayTime, localDate } from '../../shared/model';
import type { ContentStatus, Currency, DonationFilter, HistoryEntry, Summary } from '../../shared/model';
import { Empty, Field, Filters, Panel, ReadState, useRead } from './ui';
import type { ModuleProps } from './ui';

const statusNames: Record<ContentStatus, string> = { draft: 'taslak', published: 'yayında', archived: 'arşivde' };
export const actionNames: Record<HistoryEntry['action'], string> = {
  'content.save': 'Taslak kaydedildi', 'content.publish': 'İçerik yayımlandı', 'content.archive': 'İçerik arşivlendi',
  'theme.save': 'Tema ve ayarlar güncellendi', 'donation.save': 'Bağış kaydedildi', 'donation.cancel': 'Bağış iptal edildi',
  'donation.import': 'CSV içe aktarıldı',
};
export function initialPeriod(): DonationFilter {
  const today = localDate();
  return { from: today.slice(0, 8) + '01', to: today };
}
export function useCampaigns(api: ModuleProps['api'], revision: number) {
  const load = useCallback(() => api.overview(), [api, revision]);
  return useRead(load).value?.campaignOptions ?? [];
}
export function CampaignReport({ report }: { report: Summary }) {
  const [selected, setSelected] = useState<Currency>('TRY');
  if (!report.totals.length) return <Empty title="Bu dönemde bağış bulunamadı" detail="Başka bir tarih aralığı veya kampanya seçebilirsiniz." />;
  const currency = report.totals.some((item) => item.currency === selected) ? selected : report.totals[0].currency;
  const groups = report.campaigns.flatMap((row) => {
    const total = row.totals.find((item) => item.currency === currency);
    return total ? [{ campaign: row.campaign || 'Kampanyasız', ...total }] : [];
  }).sort((a, b) => b.amountMinor - a.amountMinor);
  const max = groups[0]?.amountMinor || 1;
  return <>
    <div className="report-currency"><Field title="Grafik para birimi"><select value={currency} onChange={(event) => setSelected(event.target.value as Currency)}>
      {report.totals.map((item) => <option key={item.currency}>{item.currency}</option>)}
    </select></Field></div>
    <div className="bar-list">{groups.map((row, i) => <div className="bar-entry" key={i}>
      <div><strong>{row.campaign}</strong><span>{displayMoney(row.amountMinor, row.currency)} · {row.count} kayıt</span></div>
      <div className="bar-track" aria-hidden="true"><div style={{ width: 100 * row.amountMinor / max + '%' }} /></div>
    </div>)}</div>
    <details className="report-details"><summary>Tüm kampanya ve para birimleri</summary>
      <div className="table-scroll"><table><thead><tr><th>Kampanya</th><th>Para birimi</th><th>Kayıt</th><th>Toplam</th></tr></thead><tbody>
        {report.campaigns.flatMap((group, index) => group.totals.map((item) => <tr key={index + item.currency}>
          <td>{group.campaign || 'Kampanyasız'}</td><td>{item.currency}</td><td>{item.count}</td><td>{displayMoney(item.amountMinor, item.currency)}</td>
        </tr>))}
      </tbody></table></div>
    </details>
  </>;
}
export function Overview({ api, revision, refresh }: ModuleProps) {
  const [filter, setFilter] = useState<DonationFilter>(initialPeriod);
  const load = useCallback(() => api.overview(filter), [api, filter, revision]);
  const loadHistory = useCallback(() => api.history(), [api, revision]);
  const data = useRead(load);
  const history = useRead(loadHistory);
  const options = useCampaigns(api, revision);
  const report = data.value;
  return <>
    <ReadState {...data} retry={refresh} />
    {report && <div className="metric-grid">
      {(['post', 'event'] as const).map((kind) => {
        const Icon = kind === 'post' ? FileText : CalendarDays;
        return <div className="metric" key={kind}><div className={'metric-icon ' + kind}><Icon size={20} /></div>
          <span>{kind === 'post' ? 'Paylaşımlar' : 'Etkinlikler'}</span><strong>{Object.values(report.content[kind]).reduce((sum, count) => sum + count, 0)}</strong>
          <small>{(Object.keys(statusNames) as ContentStatus[]).map((status) => report.content[kind][status] + ' ' + statusNames[status]).join(' · ')}</small></div>;
      })}
      <div className="metric"><div className="metric-icon donation"><HeartHandshake size={21} /></div><span>Dönem bağışları</span>
        <strong>{report.totals.reduce((sum, item) => sum + item.count, 0)} <small>kayıt</small></strong>
        <small>{report.totals.length ? report.totals.map((item) => displayMoney(item.amountMinor, item.currency)).join(' · ') : 'Seçili dönemde kayıt yok'}</small></div>
      <div className="metric"><div className="metric-icon publication"><Radio size={20} /></div><span>Yayın sürümü</span>
        <strong>{report.publicVersion ? 'v' + report.publicVersion : '—'}</strong><small>Özel günlükteki son yayın sürümü</small></div>
    </div>}
    <div className="overview-grid">
      <Panel title="Bağış görünümü" detail="Dönem ve kampanyaya göre kaydedilmiş bağışlar." action={<span className="panel-icon"><ChartNoAxesColumnIncreasing size={20} /></span>}>
        <Filters filter={filter} setFilter={setFilter} campaignOptions={options} search={false} />
        {report && <><div className="currency-totals">{report.totals.map((item) => <span key={item.currency}>{displayMoney(item.amountMinor, item.currency)}</span>)}</div>
          <CampaignReport report={report} /></>}
      </Panel>
      <Panel title="Son işlemler" detail="Yönetim günlüğünden son kayıtlar." action={<a className="button plain" href="#yonetim" aria-label="Tüm geçmiş"><ArrowRight size={19} /></a>}>
        <ReadState {...history} retry={refresh} />
        {history.value && (history.value.items.length ? <ul className="activity-list">
          {history.value.items.slice(0, 5).map((entry) => <li key={entry.requestId}>
            <span className="activity-dot" aria-hidden="true" /><div><strong>{actionNames[entry.action]}</strong>
              <small>{displayTime(entry.at)} · {entry.count} kayıt</small></div>
          </li>)}</ul> : <Empty title="Henüz işlem yok" />)}
      </Panel>
    </div>
  </>;
}
