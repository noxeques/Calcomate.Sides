import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { Archive, CalendarDays, FileText, Pencil, Plus, Radio, Save } from 'lucide-react';
import { displayDate, displayTime, EMPTY_CONTENT, SAMPLE_IMAGES } from '../../shared/model';
import type { Content, ContentFields, ContentKind, ContentStatus } from '../../shared/model';
import { Dialog, Empty, Feedback, Field, Pagination, Panel, ReadState, useCommand, useRead } from './ui';
import type { ModuleProps } from './ui';

const kindNames = { post: 'Paylaşım', event: 'Etkinlik' };
const statusNames = { draft: 'Taslak', published: 'Yayımlandı', archived: 'Arşiv' };
export function ContentModule({ api, revision, refresh }: ModuleProps) {
  const [filter, setFilter] = useState<{ kind?: ContentKind; status?: ContentStatus; search?: string }>({});
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ type: 'form' | 'publish' | 'archive'; item?: Content } | null>(null);
  const load = useCallback(() => api.contents({ ...filter, page }), [api, filter, page, revision]);
  const data = useRead(load);
  const command = useCommand(api, refresh);
  function open(type: 'form' | 'publish' | 'archive', item?: Content) {
    command.clear();
    setDialog({ type, item });
  }
  function close() { setDialog(null); command.clear(); }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget)) as unknown as ContentFields;
    const fields = { ...EMPTY_CONTENT, ...values };
    const old = dialog?.item;
    if (old) fields.kind = old.kind;
    void command.execute({ action: 'content.save', fields, ...(old ? { id: old.id, version: old.version } : {}) },
      old?.status === 'published' ? 'Taslak güncellendi. Önceki yayın sürümü sitede duruyor.' : 'Taslak kaydedildi.',
      () => setDialog(null));
  }
  function transition() {
    const item = dialog?.item;
    if (!item || dialog.type === 'form') return;
    const publish = dialog.type === 'publish';
    void command.execute({ action: publish ? 'content.publish' : 'content.archive', id: item.id, version: item.version },
      publish ? 'İçerik yayımlandı. Ziyaretçi sitesinde yenileyerek görebilirsiniz.' : 'İçerik arşivlendi.',
      () => setDialog(null));
  }
  return <Panel title="İçerik kayıtları" detail="Paylaşımları ve etkinlikleri taslak olarak hazırlayıp yayınlayın."
    action={<button className="button" onClick={() => open('form')}><Plus size={18} /> Yeni içerik</button>}>
    <form className="filter-bar" onSubmit={(event) => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      setFilter({ search: String(values.get('search')), kind: (values.get('kind') || undefined) as ContentKind | undefined,
        status: (values.get('status') || undefined) as ContentStatus | undefined });
      setPage(1);
    }}>
      <Field title="Başlık ara"><input name="search" type="search" placeholder="Başlığa göre ara" maxLength={180} /></Field>
      <Field title="Tür"><select name="kind"><option value="">Tüm türler</option><option value="post">Paylaşım</option><option value="event">Etkinlik</option></select></Field>
      <Field title="Durum"><select name="status"><option value="">Tüm durumlar</option><option value="draft">Taslak</option><option value="published">Yayımlandı</option><option value="archived">Arşiv</option></select></Field>
      <button className="button secondary" type="submit">Uygula</button>
    </form>
    {!dialog && command.feedback && <Feedback {...command.feedback} />}
    <ReadState {...data} retry={refresh} />
    {data.value && (data.value.items.length ? <>
      <div className="table-scroll"><table><thead><tr><th>Başlık</th><th>Tür</th><th>Durum</th><th>Son değişiklik</th><th>İşlemler</th></tr></thead><tbody>
        {data.value.items.map((item) => <tr key={item.id}>
          <td><strong>{item.title}</strong>{item.eventDate && <small>{displayDate(item.eventDate)} · {item.location || 'Yer belirtilmedi'}</small>}</td>
          <td><span className="table-icon">{item.kind === 'event' ? <CalendarDays size={16} /> : <FileText size={16} />}{kindNames[item.kind]}</span></td>
          <td><span className={'status-chip ' + item.status}>{statusNames[item.status]}</span>
            {item.status === 'published' && item.version !== item.published?.version && <small>Yeni taslak var</small>}</td>
          <td>{displayTime(item.updatedAt)}</td>
          <td><div className="row-actions">
            <button className="icon-button" aria-label={item.title + ' düzenle'} title="Düzenle" onClick={() => open('form', item)}><Pencil size={16} /></button>
            {(item.status !== 'published' || item.version !== item.published?.version) && <button className="icon-button" aria-label={item.title + ' yayımla'} title="Yayımla" onClick={() => open('publish', item)}><Radio size={17} /></button>}
            {item.status !== 'archived' && <button className="icon-button" aria-label={item.title + ' arşivle'} title="Arşivle" onClick={() => open('archive', item)}><Archive size={16} /></button>}
          </div></td>
        </tr>)}
      </tbody></table></div><Pagination value={data.value} onPage={setPage} />
    </> : <Empty title="İçerik bulunamadı" detail="Yeni bir taslak oluşturabilir veya filtreleri değiştirebilirsiniz." />)}
    {dialog && <Dialog title={dialog.type === 'form' ? (dialog.item ? 'İçeriği düzenle' : 'Yeni içerik') : dialog.type === 'publish' ? 'İçeriği yayımla' : 'İçeriği arşivle'}
      detail={dialog.type === 'form' ? 'Bu form özel çalışma kopyasını kaydeder.' : dialog.item?.title} onClose={close} busy={command.busy}>
      {command.feedback && <Feedback {...command.feedback} />}
      {dialog.type === 'form'
        ? <ContentForm item={dialog.item} busy={command.busy} submit={submit} close={close} />
        : <><p className="dialog-copy">{dialog.type === 'publish' ? 'Bu sürüm kamuya açık yayın kopyasına aktarılacak.' : 'İçerik yönetim kayıtlarında kalacak ve varsa ziyaretçi sitesindeki yayını kaldırılacak.'}</p>
          <div className="dialog-actions"><button className="button secondary" onClick={close} disabled={command.busy}>Vazgeç</button>
            <button className="button" onClick={transition} disabled={command.busy}>{dialog.type === 'publish' ? 'Yayımla' : 'Arşivle'}</button></div></>}
    </Dialog>}
  </Panel>;
}
function ContentForm({ item, busy, submit, close }: { item?: Content; busy: boolean; submit: (event: FormEvent<HTMLFormElement>) => void; close: () => void }) {
  const [kind, setKind] = useState<ContentKind>(item?.kind ?? 'post');
  return <form onSubmit={submit}>
    <div className="form-grid">
      <Field title="İçerik türü"><select name="kind" value={kind} disabled={!!item} onChange={(event) => setKind(event.target.value as ContentKind)}>
        <option value="post">Paylaşım</option><option value="event">Etkinlik</option></select></Field>
      <Field title="Başlık"><input name="title" defaultValue={item?.title} required maxLength={120} /></Field>
      {kind === 'event' && <>
        <Field title="Etkinlik tarihi"><input name="eventDate" type="date" defaultValue={item?.eventDate} /></Field>
        <Field title="Etkinlik yeri"><input name="location" defaultValue={item?.location} maxLength={180} /></Field>
      </>}
      <Field title="Kısa özet" full><textarea name="summary" rows={2} maxLength={320} defaultValue={item?.summary} /></Field>
      <Field title="Açıklama" full hint={kind === 'event' ? 'Yayın için tarih, yer ve açıklama gereklidir.' : 'Düz metin girin.'}>
        <textarea name="body" rows={5} maxLength={4000} defaultValue={item?.body} /></Field>
      <Field title="Görsel adresi" full hint="HTTPS adresi girebilir veya yerel örnek seçebilirsiniz.">
        <input name="image" list="sample-images" defaultValue={item?.image} maxLength={500} />
      </Field>
      <datalist id="sample-images">{Object.entries(SAMPLE_IMAGES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</datalist>
    </div>
    <div className="dialog-actions"><button type="button" className="button secondary" onClick={close} disabled={busy}>Vazgeç</button>
      <button className="button" type="submit" disabled={busy}><Save size={16} /> Taslağı kaydet</button></div>
  </form>;
}
