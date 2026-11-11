import { useCallback, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Ban, Download, FileUp, Pencil, Plus, Save } from 'lucide-react';
import { CURRENCIES, displayDate, displayMoney, localDate, METHODS } from '../../shared/model';
import type { Currency, Donation, DonationFields, DonationFilter } from '../../shared/model';
import { CSV_FIELDS, CSV_MAX_BYTES, decimalText, exportCsv, parseCsv, previewCsv, suggestMapping } from '../../shared/csv';
import type { CsvField, CsvMapping, Delimiter } from '../../shared/csv';
import { parseAmount, requireValue } from '../../shared/validation';
import { CampaignReport, initialPeriod, useCampaigns } from './overview';
import { Dialog, download, Empty, Feedback, Field, Filters, message, Pagination, Panel, ReadState, useCommand, useRead } from './ui';
import type { ModuleProps } from './ui';

const currencies = Object.keys(CURRENCIES) as Currency[];
export function DonationsModule({ api, revision, refresh }: ModuleProps) {
  const [filter, setFilter] = useState<DonationFilter>({});
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ type: 'form' | 'cancel' | 'import'; item?: Donation } | null>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const options = useCampaigns(api, revision);
  const load = useCallback(() => api.donations({ ...filter, page }), [api, filter, page, revision]);
  const data = useRead(load);
  const command = useCommand(api, refresh);
  function open(type: 'form' | 'cancel' | 'import', item?: Donation) {
    setError('');
    command.clear();
    setDialog({ type, item });
  }
  function close() { setDialog(null); setError(''); command.clear(); }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    command.clear();
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget)) as unknown as DonationFields & { amount: string };
      const { amount, ...details } = values;
      const fields = { ...details, amountMinor: parseAmount(amount, details.currency, ',') };
      const old = dialog?.item;
      void command.execute({ action: 'donation.save', fields, ...(old ? { id: old.id, version: old.version } : {}) }, 'Bağış kaydedildi.', () => setDialog(null));
    } catch (problem) { setError(message(problem)); }
  }
  async function downloadCsv() {
    setExporting(true);
    setError('');
    try {
      download('calcomatesides-bagislar-' + localDate() + '.csv', exportCsv(await api.exportDonations(filter)), 'text/csv;charset=utf-8');
    } catch (problem) { setError(message(problem)); }
    finally { setExporting(false); }
  }
  return <>
    <Panel title="Bağış kayıtları" detail="Alınmış bağışları görüntüleyin, düzenleyin ve filtreleyin."
      action={<div className="actions">
        <button className="button secondary" onClick={() => open('import')}><FileUp size={17} /> CSV içe aktar</button>
        <button className="button" onClick={() => open('form')}><Plus size={18} /> Yeni bağış</button>
      </div>}>
      <Filters filter={filter} setFilter={(next) => { setFilter(next); setPage(1); }} campaignOptions={options} />
      <div className="export-row">
        <span>{data.value ? data.value.total + ' kayıt' : 'Kayıtlar'} · İptal edilen bağışlar listede tutulur.</span>
        <button className="button plain" disabled={exporting} onClick={() => void downloadCsv()}><Download size={16} /> CSV dışa aktar</button>
      </div>
      {!dialog && <><Feedback text={error} error />{command.feedback && <Feedback {...command.feedback} />}</>}
      <ReadState {...data} retry={refresh} />
      {data.value && (data.value.items.length ? <>
        <div className="table-scroll"><table><thead><tr><th>Tarih / Bağışçı</th><th>Tutar</th><th>Kampanya</th><th>Yöntem</th><th>Durum</th><th>İşlemler</th></tr></thead><tbody>
          {data.value.items.map((item) => <tr key={item.id}>
            <td><strong>{item.donor || 'İsimsiz bağış'}</strong><small>{displayDate(item.date)}{item.reference && ' · ' + item.reference}</small></td>
            <td className="nowrap"><strong>{displayMoney(item.amountMinor, item.currency)}</strong></td>
            <td>{item.campaign || '—'}</td><td>{METHODS[item.method]}</td>
            <td><span className={'status-chip ' + item.status}>{item.status === 'active' ? 'Etkin' : 'İptal'}</span></td>
            <td>{item.status === 'active' && <div className="row-actions">
              <button className="icon-button" aria-label={(item.donor || item.reference || item.id) + ' bağışını düzenle'} title="Düzenle" onClick={() => open('form', item)}><Pencil size={16} /></button>
              <button className="icon-button" aria-label={(item.donor || item.reference || item.id) + ' bağışını iptal et'} title="İptal et" onClick={() => open('cancel', item)}><Ban size={16} /></button>
            </div>}</td>
          </tr>)}
        </tbody></table></div><Pagination value={data.value} onPage={setPage} />
      </> : <Empty title="Bağış bulunamadı" detail="Filtreleri değiştirebilir veya alınmış bir bağışı kaydedebilirsiniz." />)}
    </Panel>
    <DonationReport api={api} revision={revision} refresh={refresh} options={options} />
    {dialog && <Dialog title={dialog.type === 'import' ? 'CSV içe aktar' : dialog.type === 'cancel' ? 'Bağışı iptal et' : dialog.item ? 'Bağışı düzenle' : 'Yeni bağış'}
      detail={dialog.type === 'import' ? 'Dosyayı seçin, sütunları eşleştirin ve kayıtları kontrol edin.' : undefined}
      onClose={close} busy={command.busy}>
      <Feedback text={error} error />
      {command.feedback && <Feedback {...command.feedback} />}
      {dialog.type === 'form' && <DonationForm item={dialog.item} campaigns={options} busy={command.busy} submit={save} close={close} />}
      {dialog.type === 'import' && <ImportForm command={command} close={close} />}
      {dialog.type === 'cancel' && dialog.item && <><p className="dialog-copy">Bu bağış iptal edilecek ve rapor toplamlarından çıkarılacak. Kayıt geçmişte kalır.</p>
        <div className="dialog-actions"><button className="button secondary" onClick={close} disabled={command.busy}>Vazgeç</button>
          <button className="button danger" disabled={command.busy} onClick={() => {
            const { id, version } = dialog.item!;
            void command.execute({ action: 'donation.cancel', id, version }, 'Bağış iptal edildi.', () => setDialog(null));
          }}>Bağışı iptal et</button></div></>}
    </Dialog>}
  </>;
}
function DonationReport({ api, revision, refresh, options }: ModuleProps & { options: string[] }) {
  const [filter, setFilter] = useState<DonationFilter>(initialPeriod);
  const load = useCallback(() => api.overview(filter), [api, filter, revision]);
  const data = useRead(load);
  return <Panel title="Dönem ve kampanya raporu" detail="Toplamlar yalnızca etkin bağışları ve ayrı para birimlerini içerir.">
    <Filters filter={filter} setFilter={setFilter} campaignOptions={options} search={false} />
    <ReadState {...data} retry={refresh} />
    {data.value && <><div className="currency-totals">{data.value.totals.map((item) => <span key={item.currency}>
      {displayMoney(item.amountMinor, item.currency)} · {item.count} kayıt</span>)}</div><CampaignReport report={data.value} /></>}
  </Panel>;
}
function DonationForm({ item, campaigns, busy, submit, close }: {
  item?: Donation; campaigns: string[]; busy: boolean; submit: (event: FormEvent<HTMLFormElement>) => void; close: () => void;
}) {
  return <form onSubmit={submit}>
    <div className="form-grid">
      <Field title="Bağış tarihi"><input name="date" type="date" defaultValue={item?.date ?? localDate()} required /></Field>
      <Field title="Para birimi"><select name="currency" defaultValue={item?.currency ?? 'TRY'}>{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></Field>
      <Field title="Tutar" hint="Ondalık için virgül kullanın. Örnek 1250,50."><input name="amount" inputMode="decimal" maxLength={16}
        defaultValue={item ? decimalText(item.amountMinor, item.currency) : ''} required /></Field>
      <Field title="Ödeme yöntemi"><select name="method" defaultValue={item?.method ?? 'transfer'}>
        {Object.entries(METHODS).map(([method, label]) => <option key={method} value={method}>{label}</option>)}</select></Field>
      <Field title="Kampanya"><input name="campaign" defaultValue={item?.campaign} maxLength={100} list="campaign-suggestions" /></Field>
      <datalist id="campaign-suggestions">{campaigns.map((item) => <option key={item} value={item} />)}</datalist>
      <Field title="Bağışçı adı (isteğe bağlı)"><input name="donor" defaultValue={item?.donor} maxLength={120} /></Field>
      <Field title="Referans" full><input name="reference" defaultValue={item?.reference} maxLength={100} /></Field>
      <Field title="Not" full><textarea name="note" rows={3} defaultValue={item?.note} maxLength={500} /></Field>
    </div>
    <div className="dialog-actions"><button type="button" className="button secondary" onClick={close} disabled={busy}>Vazgeç</button>
      <button className="button" type="submit" disabled={busy}><Save size={17} /> Bağışı kaydet</button></div>
  </form>;
}
function ImportForm({ command, close }: { command: ReturnType<typeof useCommand>; close: () => void }) {
  const [source, setSource] = useState('');
  const [delimiter, setDelimiter] = useState<Delimiter>(';');
  const [decimal, setDecimal] = useState<',' | '.'>(',');
  const [currency, setCurrency] = useState<Currency>('TRY');
  const [fileError, setFileError] = useState('');
  const [mapping, setMapping] = useState<CsvMapping | null>(null);
  const [done, setDone] = useState(false);
  const fileSequence = useRef(0);
  const parsed = useMemo(() => {
    if (!source) return { table: null, error: '' };
    try { return { table: parseCsv(source, delimiter), error: '' }; }
    catch (problem) { return { table: null, error: message(problem) }; }
  }, [source, delimiter]);
  const selected = mapping ?? suggestMapping(parsed.table?.headers ?? []);
  let preview: ReturnType<typeof previewCsv> = [];
  let issue = '';
  if (parsed.table) {
    try { preview = previewCsv(parsed.table, selected, decimal, currency); }
    catch (problem) { issue = message(problem); }
  }
  const valid = preview.flatMap((row) => row.data ? [row.data] : []);
  const errorCount = preview.length - valid.length;
  return <>
    <fieldset disabled={command.busy || done} className="import-fields">
      <div className="form-grid">
        <Field title="UTF-8 CSV dosyası" full hint="En fazla 100 kayıt ve 512 KB. Tarih biçimi YYYY-AA-GG.">
          <input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={async (event) => {
            const file = event.target.files?.[0];
            const sequence = ++fileSequence.current;
            setSource(''); setFileError(''); setMapping(null); command.clear();
            if (!file) return;
            try {
              requireValue(file.size <= CSV_MAX_BYTES && file.size > 0, 'Dosya boş veya 512 KB sınırını aşıyor.');
              const content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
              if (fileSequence.current === sequence) setSource(content);
            } catch (problem) {
              if (fileSequence.current === sequence) {
                setFileError(problem instanceof TypeError ? 'Dosyayı UTF-8 olarak kaydedip yeniden deneyin.' : message(problem));
              }
            }
          }} />
        </Field>
        <Field title="Sütun ayırıcı"><select value={delimiter} onChange={(event) => { setDelimiter(event.target.value as Delimiter); setMapping(null); }}>
          <option value=";">Noktalı virgül (;)</option><option value=",">Virgül (,)</option><option value={'\t'}>Sekme</option></select></Field>
        <Field title="Ondalık ayırıcı"><select value={decimal} onChange={(event) => setDecimal(event.target.value as ',' | '.')}>
          <option value=",">Virgül (,)</option><option value=".">Nokta (.)</option></select></Field>
        <Field title="Varsayılan para birimi"><select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>
          {currencies.map((item) => <option key={item}>{item}</option>)}</select></Field>
      </div>
      <Feedback text={fileError || parsed.error} error />
      {parsed.table && <>
        <h3>Sütun eşleştirme</h3>
        <div className="form-grid mapping-grid">
          {(Object.keys(CSV_FIELDS) as CsvField[]).map((field) => <Field title={CSV_FIELDS[field] + (['date', 'amount', 'method'].includes(field) ? ' *' : '')} key={field}>
            <select value={selected[field] ?? ''} onChange={(event) => {
              const next = { ...selected };
              if (event.target.value === '') delete next[field]; else next[field] = Number(event.target.value);
              setMapping(next);
            }}><option value="">Eşleştirilmedi</option>
              {parsed.table!.headers.map((header, index) => <option key={index} value={index}>{index + 1} · {header}</option>)}
            </select>
          </Field>)}
        </div>
        <Feedback text={issue} error />
        {!!preview.length && <><h3>Önizleme</h3>
          <p className="field-note" role="status">{valid.length} geçerli · {errorCount} hatalı{errorCount ? ' · Aktarmadan önce dosyadaki hataları düzeltin.' : ''}</p>
          <div className="table-scroll csv-table"><table><thead><tr><th>Satır</th><th>Tarih / Bağışçı</th><th>Tutar</th><th>Kampanya</th><th>Sonuç</th></tr></thead><tbody>
            {preview.map(({ line, data, error }) => <tr key={line}><td>{line}</td>
              <td>{data ? displayDate(data.date) + (data.donor ? ' · ' + data.donor : '') : '—'}</td>
              <td className="nowrap">{data ? displayMoney(data.amountMinor, data.currency) : '—'}</td><td>{data?.campaign || '—'}</td>
              <td className={error ? 'invalid-row' : ''}>{error || 'Geçerli'}</td></tr>)}
          </tbody></table></div></>}
      </>}
    </fieldset>
    <div className="dialog-actions">
      <button className="button secondary" onClick={close} disabled={command.busy}>{done ? 'Kapat' : 'Vazgeç'}</button>
      {!done && <button className="button" disabled={command.busy || !!issue || errorCount > 0 || !valid.length}
        onClick={() => void command.execute({ action: 'donation.import', rows: valid }, valid.length + ' bağış kaydedildi.', () => setDone(true))}>
        <FileUp size={17} /> {valid.length ? valid.length + ' bağışı içe aktar' : 'İçe aktar'}
      </button>}
    </div>
  </>;
}
