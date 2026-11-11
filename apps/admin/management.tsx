import { useCallback, useState } from 'react';
import { DatabaseBackup, Download, ExternalLink, RefreshCw } from 'lucide-react';
import { displayTime, localDate, PRODUCT_NOTE } from '../../shared/model';
import { actionNames } from './overview';
import { download, Empty, Feedback, FileHelp, message, Pagination, Panel, ReadState, useCommand, useRead } from './ui';
import type { ModuleProps } from './ui';

export function Management({ api, revision, refresh }: ModuleProps) {
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const history = useRead(useCallback(() => api.history(page), [api, page, revision]));
  const publication = useRead(useCallback(() => api.publication(), [api, revision]));
  const command = useCommand(api, refresh);
  async function exportData() {
    setExporting(true);
    setExportError('');
    try {
      const archive = await api.exportData();
      download('calcomatesides-' + archive.organizationId + '-' + localDate() + '.json', JSON.stringify(archive, null, 2), 'application/json');
    } catch (error) { setExportError(message(error)); }
    finally { setExporting(false); }
  }
  const status = publication.value;
  return <>
    <div className="management-grid">
      <Panel title="Yayın kopyası" detail="Özel günlük ile ziyaretçi kaynağının sürümünü karşılaştırın.">
        <ReadState {...publication} retry={refresh} />
        {status && <div className="publication-status">
          <span className={'status-chip ' + (status.current === status.target && status.target > 0 ? 'published' : 'draft')}>
            {status.current === null ? 'Kopya doğrulanamadı' : status.target !== status.current ? 'Sürümler farklı'
              : status.target ? 'Eşitlendi' : 'Henüz yayın yok'}
          </span>
          <p>Hedef {status.target || '—'} · Ziyaretçi kopyası {status.current || '—'}</p>
        </div>}
        <button className="button secondary" disabled={command.busy || !status?.target} onClick={() =>
          void command.execute({ action: 'publication.retry' }, 'Yayın kopyası eşitlendi.')}><RefreshCw size={17} /> Yayını yeniden eşitle</button>
        {command.feedback && <Feedback {...command.feedback} />}
      </Panel>
      <Panel title="Veri dışa aktarma" detail="İçerik, ayarlar, bağışlar ve özel işlem günlüğü.">
        <FileHelp><strong>Özel JSON arşivi</strong><p>Arşivi yalnızca kuruluşun yetkili hesaplarıyla paylaşın.</p></FileHelp>
        <button className="button secondary" disabled={exporting} onClick={() => void exportData()}><Download size={17} /> JSON arşivini indir</button>
        <Feedback text={exportError} error />
      </Panel>
    </div>
    <Panel title="Değişiklik geçmişi" detail="Yazma işlemleri ve içe aktarılan gruplar.">
      <ReadState {...history} retry={refresh} />
      {history.value && (history.value.items.length ? <>
        <div className="table-scroll"><table><thead><tr><th>İşlem</th><th>Yönetici</th><th>Zaman</th><th>Adet</th><th>İstek kimliği</th></tr></thead><tbody>
          {history.value.items.map((entry) => <tr key={entry.requestId}>
            <td><strong>{actionNames[entry.action]}</strong>{entry.publicVersion && <small>Yayın v{entry.publicVersion}</small>}</td>
            <td>{entry.actor}</td><td>{displayTime(entry.at)}</td><td>{entry.count}</td>
            <td><code>{entry.requestId}</code></td>
          </tr>)}
        </tbody></table></div><Pagination value={history.value} onPage={setPage} />
      </> : <Empty title="Henüz kayıtlı işlem yok" />)}
    </Panel>
    <Backup />
  </>;
}
function Backup() {
  return <Panel title="Yedekleme ve geri yükleme" detail="Kuruluşun üç Sheets dosyasını birlikte yönetin." action={<span className="panel-icon"><DatabaseBackup size={20} /></span>}>
    <ol className="help-list">
      <li>Yazma işlemlerine ara verin ve içerik, bağış ve yayın Sheets dosyalarının aynı anda özel kopyalarını alın.</li>
      <li>Geri dönüşte yedekleri ayrı dosyalar olarak açın. Sekme işaretlerini ve izinleri kontrol edin.</li>
      <li>Her iki Apps Script projesinin dosya kimliklerini aynı yedek grubuyla güncelleyin, yönetim ve ziyaretçi bağlantılarını test edin.</li>
    </ol>
    <p className="field-note">Tam işlem sırası proje paketindeki Google kurulumu rehberinde yer alır.</p>
  </Panel>;
}
export function Help({ api, revision, refresh }: ModuleProps) {
  const data = useRead(useCallback(() => api.theme(), [api, revision]));
  return <>
    <Panel title="CalcomateSides yardım merkezi" detail={PRODUCT_NOTE}
      action={data.value?.support ? <a className="button" href={data.value.support} target="_blank" rel="noreferrer">Destek <ExternalLink size={16} /></a> : undefined}>
      <ol className="help-list">
        <li>İçerik bölümünde bir taslak oluşturun. Yayımlamayı ayrı işlem olarak onaylayın.</li>
        <li>Tema bölümünden kuruluş bilgilerini ve yasal metinleri güncelleyin.</li>
        <li>Bağışlar bölümünden daha önce alınmış bağışları kaydedin ve raporları filtreleyin.</li>
        <li>Yönetim bölümünde işlem geçmişini, yayın sürümünü ve dışa aktarmayı açın.</li>
      </ol>
      <ReadState {...data} retry={refresh} />
      {data.value && <div className="legal-help">
        {([['terms', 'Kullanım Koşulları'], ['privacy', 'Gizlilik Politikası'], ['notice', 'Aydınlatma Metni']] as const).map(([key, title]) =>
          <details key={key}><summary>{title}</summary><p className="prose">{data.value?.[key] || 'Kuruluş metni henüz eklenmemiş.'}</p></details>)}
        {!data.value.support && <p className="field-note">Destek bağlantısı Tema bölümünde tanımlanabilir.</p>}
      </div>}
    </Panel>
    <Backup />
  </>;
}
