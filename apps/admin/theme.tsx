import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Palette, Plus, Save, X } from 'lucide-react';
import { PAGE_NAMES, THEMES } from '../../shared/model';
import type { MenuPage, Settings, SettingsFields } from '../../shared/model';
import { Feedback, Field, Panel, ReadState, useCommand, useRead } from './ui';
import type { ModuleProps } from './ui';

export function ThemeModule({ api, revision, refresh }: ModuleProps) {
  const load = useCallback(() => api.theme(), [api, revision]);
  const data = useRead(load);
  const command = useCommand(api, refresh);
  return <Panel title="Görünüm ve kuruluş bilgileri" detail="Kaydedilen ayarlar ziyaretçi sitesinin yayın kopyasına aktarılır.">
    {command.feedback && <Feedback {...command.feedback} />}
    <ReadState {...data} retry={refresh} />
    {data.value && <ThemeForm key={data.value.version} original={data.value} command={command} />}
  </Panel>;
}
function ThemeForm({ original, command }: { original: Settings; command: ReturnType<typeof useCommand> }) {
  const [theme, setTheme] = useState(original.theme);
  const [primary, setPrimary] = useState(original.primary);
  const [accent, setAccent] = useState(original.accent);
  const [socials, setSocials] = useState(original.socials);
  const [menu, setMenu] = useState(original.menu);
  const options = Object.keys(PAGE_NAMES) as MenuPage[];
  function select(next: SettingsFields['theme']) {
    setTheme(next);
    setPrimary(THEMES[next].primary);
    setAccent(THEMES[next].accent);
  }
  function toggle(page: MenuPage) { setMenu((current) => current.includes(page) ? current.filter((item) => item !== page) : [...current, page]); }
  function move(page: MenuPage, offset: number) {
    setMenu((current) => {
      const position = current.indexOf(page);
      const next = [...current];
      [next[position], next[position + offset]] = [next[position + offset], next[position]];
      return next;
    });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget)) as unknown as SettingsFields;
    const fields: SettingsFields = { ...values, theme, primary, accent, menu, socials };
    void command.execute({ action: 'theme.save', version: original.version, fields }, 'Ayarlar kaydedildi ve yayımlandı.');
  }
  return <form className="theme-form" onSubmit={submit}>
    <fieldset>
      <legend><Palette size={18} /> Hazır temalar</legend>
      <div className="theme-options">
        {(Object.keys(THEMES) as (keyof typeof THEMES)[]).map((name) => <button type="button" className={'theme-choice ' + (theme === name ? 'selected' : '')}
          onClick={() => select(name)} aria-pressed={theme === name} key={name}>
          <span className={'theme-preview ' + name}><i /><b /><b /><em /></span>
          <span>{THEMES[name].label}{theme === name && <Check size={18} />}</span>
        </button>)}
      </div>
      <div className="form-grid">
        <Field title="Ana renk"><input type="color" value={primary} onChange={(event) => setPrimary(event.target.value)} /></Field>
        <Field title="Vurgu rengi"><input type="color" value={accent} onChange={(event) => setAccent(event.target.value)} /></Field>
      </div>
      <p className="field-note">Ziyaretçi arayüzü düşük kontrastlı metin renklerinde okunabilir bir renk kullanır.</p>
    </fieldset>
    <fieldset><legend>Kuruluş profili</legend>
      <div className="form-grid">
        <Field title="Kuruluş adı"><input name="organizationName" required maxLength={90} defaultValue={original.organizationName} /></Field>
        <Field title="Logo HTTPS adresi"><input name="logo" type="url" maxLength={500} defaultValue={original.logo} /></Field>
        <Field title="Ana sayfa başlığı" full><input name="tagline" maxLength={110} defaultValue={original.tagline} /></Field>
        <Field title="Ana sayfa açıklaması" full><textarea name="introduction" rows={3} maxLength={550} defaultValue={original.introduction} /></Field>
        <Field title="Hakkımızda" full><textarea name="about" rows={4} maxLength={4000} defaultValue={original.about} /></Field>
      </div>
    </fieldset>
    <fieldset><legend>Menü</legend>
      <p className="field-note">Sayfaları etkinleştirin ve menüdeki sıralarını ayarlayın.</p>
      <div className="menu-editor">
        {menu.map((page, index) => <div key={page}><span>{PAGE_NAMES[page]}</span><div>
          <button type="button" className="icon-button" aria-label={PAGE_NAMES[page] + ' yukarı'} disabled={!index} onClick={() => move(page, -1)}>↑</button>
          <button type="button" className="icon-button" aria-label={PAGE_NAMES[page] + ' aşağı'} disabled={index === menu.length - 1} onClick={() => move(page, 1)}>↓</button>
          <button type="button" className="icon-button" aria-label={PAGE_NAMES[page] + ' kaldır'} disabled={page === 'home'} onClick={() => toggle(page)}><X size={15} /></button>
        </div></div>)}
      </div>
      <div className="actions">{options.filter((page) => !menu.includes(page)).map((page) =>
        <button type="button" className="button secondary" key={page} onClick={() => toggle(page)}><Plus size={14} /> {PAGE_NAMES[page]}</button>)}</div>
    </fieldset>
    <fieldset><legend>İletişim ve sosyal bağlantılar</legend>
      <div className="form-grid">
        <Field title="E-posta"><input name="email" type="email" maxLength={160} defaultValue={original.email} /></Field>
        <Field title="Telefon"><input name="phone" type="tel" maxLength={40} defaultValue={original.phone} /></Field>
        <Field title="Adres" full><textarea name="address" rows={2} maxLength={400} defaultValue={original.address} /></Field>
      </div>
      {socials.map((social, index) => <div className="social-row" key={index}>
        <Field title={'Bağlantı adı ' + (index + 1)}><input required value={social.label} maxLength={40} onChange={(event) =>
          setSocials((rows) => rows.map((row, i) => i === index ? { ...row, label: event.target.value } : row))} /></Field>
        <Field title={'HTTPS adresi ' + (index + 1)}><input type="url" required value={social.url} maxLength={500} onChange={(event) =>
          setSocials((rows) => rows.map((row, i) => i === index ? { ...row, url: event.target.value } : row))} /></Field>
        <button type="button" className="icon-button" aria-label={'Bağlantı ' + (index + 1) + ' kaldır'} onClick={() => setSocials((rows) => rows.filter((_, i) => index !== i))}><X size={17} /></button>
      </div>)}
      <button type="button" className="button secondary" disabled={socials.length >= 6} onClick={() => setSocials([...socials, { label: '', url: '' }])}><Plus size={15} /> Sosyal bağlantı</button>
    </fieldset>
    <fieldset><legend>Yasal metinler ve destek</legend>
      <p className="field-note">Kuruluşa ait onaylı metinleri girin. Demo metinleri taslak olarak işaretlidir.</p>
      <div className="form-grid">
        <Field title="Kullanım Koşulları" full><textarea name="terms" rows={3} maxLength={4000} defaultValue={original.terms} /></Field>
        <Field title="Gizlilik Politikası" full><textarea name="privacy" rows={3} maxLength={4000} defaultValue={original.privacy} /></Field>
        <Field title="Aydınlatma Metni" full><textarea name="notice" rows={3} maxLength={4000} defaultValue={original.notice} /></Field>
        <Field title="Destek HTTPS bağlantısı" full><input name="support" type="url" maxLength={500} defaultValue={original.support} /></Field>
      </div>
    </fieldset>
    <div className="actions theme-save">
      <button type="submit" className="button" disabled={command.busy}><Save size={17} /> Ayarları kaydet ve yayımla</button>
      {command.feedback && <Feedback {...command.feedback} />}
    </div>
  </form>;
}
