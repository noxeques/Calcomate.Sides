import { StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight, CircleHelp, FileText, HeartHandshake, LayoutDashboard, Menu, PanelsTopLeft, Palette,
  RefreshCw, Settings2, ShieldCheck, X,
} from 'lucide-react';
import { COPYRIGHT, PRODUCT, PRODUCT_NOTE } from '../../shared/model';
import type { AdminApi } from '../../shared/model';
import { DEMO, withDemoOrg } from '../common/mode';
import { getAdmin } from './api';
import { ContentModule } from './content';
import { DonationsModule } from './donations';
import { Help, Management } from './management';
import { Overview } from './overview';
import { ThemeModule } from './theme';
import { Feedback, message, ReadState, useRead } from './ui';
import '../common/base.css';
import './style.css';

const SECTIONS = {
  ozet: { title: 'Özet', heading: 'Yönetim özeti', detail: 'İçerik, etkinlik ve bağış kayıtlarınızı tek ekrandan takip edin.', icon: LayoutDashboard, Component: Overview },
  icerik: { title: 'İçerik', heading: 'İçerik yönetimi', detail: 'Ziyaretçi sitesindeki paylaşımları ve etkinlikleri yönetin.', icon: FileText, Component: ContentModule },
  tema: { title: 'Tema', heading: 'Tema ve ayarlar', detail: 'Kuruluş profilini ve ziyaretçi sitesinin görünümünü düzenleyin.', icon: Palette, Component: ThemeModule },
  bagislar: { title: 'Bağışlar', heading: 'Bağış yönetimi', detail: 'Kayıtları inceleyin, CSV ile çalışın ve dönem raporu alın.', icon: HeartHandshake, Component: DonationsModule },
  yonetim: { title: 'Yönetim', heading: 'Yönetim ve geçmiş', detail: 'Yayın durumunu izleyin ve kuruluş verilerini arşivleyin.', icon: Settings2, Component: Management },
  yardim: { title: 'Yardım', heading: 'Yardım ve destek', detail: 'Günlük işlemler, yasal metinler ve destek bağlantıları.', icon: CircleHelp, Component: Help },
} as const;
type Section = keyof typeof SECTIONS;
function route(): Section {
  const raw = location.hash.slice(1);
  return Object.prototype.hasOwnProperty.call(SECTIONS, raw) ? raw as Section : 'ozet';
}
function ProductMark() { return <span className="product-mark"><PanelsTopLeft size={23} strokeWidth={2.25} /></span>; }
function Shell({ api }: { api: AdminApi }) {
  const [section, setSection] = useState(route);
  const [revision, setRevision] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const navButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const closeNavigation = useCallback(() => {
    setNavOpen(false);
    requestAnimationFrame(() => navButton.current?.focus());
  }, []);
  useEffect(() => {
    if (!navOpen) return;
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeNavigation();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [navOpen, closeNavigation]);
  const refresh = useCallback(() => setRevision((old) => old + 1), []);
  const load = useCallback(() => api.theme(), [api, revision]);
  const identity = useRead(load);
  const organization = identity.value?.organizationName ?? 'Kuruluş';
  const logo = identity.value?.logo;
  const [failedLogo, setFailedLogo] = useState('');
  useEffect(() => {
    const change = () => {
      setSection(route());
      setNavOpen(false);
      window.scrollTo(0, 0);
      requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  const { title, heading: headline, detail, Component } = SECTIONS[section];
  useEffect(() => { document.title = title + ' · ' + PRODUCT; }, [title]);
  return <div className="admin-shell" onClick={(event) => {
    const anchor = (event.target as Element).closest('a[href^="#"]');
    const fragment = anchor?.getAttribute('href');
    if (fragment && !event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      location.hash = fragment;
    }
  }}>
    <a className="skip" href="#admin-main" onClick={(event) => { event.preventDefault(); heading.current?.focus(); }}>Ana içeriğe geç</a>
    <aside className={'sidebar ' + (navOpen ? 'open' : '')}>
      <a className="sidebar-brand" href="#ozet" onClick={() => setNavOpen(false)}><ProductMark /><span>{PRODUCT}<small>YÖNETİM PANELİ</small></span></a>
      <button ref={closeButton} className="icon-button nav-close" onClick={closeNavigation} aria-label="Gezinmeyi kapat"><X size={20} /></button>
      <div className="nav-label">ÇALIŞMA ALANI</div>
      <nav id="admin-nav" aria-label="Yönetim menüsü">
        {(Object.keys(SECTIONS) as Section[]).map((key) => {
          const Icon = SECTIONS[key].icon;
          return <a key={key} href={'#' + key} aria-current={section === key ? 'page' : undefined} onClick={() => setNavOpen(false)}>
            <Icon size={19} strokeWidth={1.9} />{SECTIONS[key].title}</a>;
        })}
      </nav>
      <div className="sidebar-foot"><span><ShieldCheck size={16} /> {DEMO ? 'Örnek çalışma alanı' : 'Google çalışma alanı'}</span><small>{PRODUCT_NOTE}</small></div>
    </aside>
    {navOpen && <button className="nav-scrim" tabIndex={-1} aria-label="Gezinmeyi kapat" onClick={closeNavigation} />}
    <div className="workspace" inert={navOpen}>
      <header className="admin-top">
        <button ref={navButton} className="icon-button nav-open" aria-controls="admin-nav" aria-expanded={navOpen} aria-label="Yönetim menüsünü aç" onClick={() => setNavOpen(true)}><Menu size={23} /></button>
        <div className="breadcrumb"><span>{PRODUCT}</span><span aria-hidden="true">/</span><strong>{title}</strong></div>
        <div className="admin-top-right">
          {DEMO && <span className="demo-mark">● Demo</span>}
          <div className="organization">{logo && logo !== failedLogo ? <img src={logo} alt="" referrerPolicy="no-referrer" onError={() => setFailedLogo(logo)} /> : <span aria-hidden="true">{organization.slice(0, 1)}</span>}<strong>{organization}</strong></div>
        </div>
      </header>
      <main className="admin-main" id="admin-main">
        <div className="main-intro">
          <div><div className="admin-eyebrow"><span /> {organization}</div><h1 ref={heading} tabIndex={-1}>{headline}</h1><p>{detail}</p></div>
          <div className="actions top-actions">
            <button className="button secondary" onClick={refresh}><RefreshCw size={16} /> Yenile</button>
            {DEMO && <a className="button secondary" href={withDemoOrg('/')} target="_blank" rel="noreferrer">Ziyaretçi sitesi <ArrowUpRight size={16} /></a>}
          </div>
        </div>
        {identity.error
          ? <ReadState {...identity} retry={refresh} />
          : <Component key={section} api={api} revision={revision} refresh={refresh} />}
      </main>
      <footer className="admin-footer"><span>{COPYRIGHT}</span><a href="#yardim">CalcomateSides yardım</a></footer>
    </div>
  </div>;
}
function App() {
  const [api, setApi] = useState<AdminApi | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    getAdmin().then((client) => { if (live) setApi(client); }, (problem) => { if (live) setError(message(problem)); });
    return () => { live = false; };
  }, [attempt]);
  if (api) return <Shell api={api} />;
  return <main className="entry-screen"><div><ProductMark /><h1>{PRODUCT}</h1><p>{PRODUCT_NOTE}</p>
    {error ? <><Feedback text={error} error /><button className="button secondary" onClick={() => { setError(''); setAttempt(attempt + 1); }}>Yeniden dene</button></>
      : <p role="status">Yönetim paneli yükleniyor…</p>}</div></main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
