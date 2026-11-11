import { StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Clock3, Compass, Leaf,
  Mail, MapPin, Menu, Phone, RefreshCw, X,
} from 'lucide-react';
import {
  COPYRIGHT, displayDate, displayTime, localDate, PAGE_NAMES, PRODUCT, PRODUCT_NOTE, SAMPLE_IMAGES,
} from '../../shared/model';
import type { ContentKind, PublicItem, PublicSnapshot, SettingsFields } from '../../shared/model';
import { AppError, has } from '../../shared/validation';
import { DEMO, withDemoOrg } from '../common/mode';
import { getPublication } from './api';
import garden from './art/garden.svg';
import shore from './art/shore.svg';
import workshop from './art/workshop.svg';
import '../common/base.css';
import './style.css';

const art = { 'local:garden': garden, 'local:shore': shore, 'local:workshop': workshop };
const LEGAL = { terms: 'Kullanım Koşulları', privacy: 'Gizlilik Politikası', notice: 'Aydınlatma Metni' } as const;
const routes = { home: '/', about: '/hakkimizda', posts: '/paylasimlar', events: '/etkinlikler', contact: '/iletisim',
  terms: '/kullanim-kosullari', privacy: '/gizlilik-politikasi', notice: '/aydinlatma-metni' } as const;
type Route = keyof typeof routes;
function currentRoute(): { page: Route | 'missing'; id?: string } {
  const path = location.hash.slice(1) || '/';
  const page = (Object.keys(routes) as Route[]).find((item) => routes[item] === path);
  if (page) return { page };
  const detail = /^\/(etkinlikler|paylasimlar)\/([a-z0-9-]+)$/.exec(path);
  return detail ? { page: detail[1] === 'etkinlikler' ? 'events' : 'posts', id: detail[2] } : { page: 'missing' };
}
function href(page: Route, id?: string): string { return '#' + routes[page] + (id ? '/' + id : ''); }
function safeColor(color: string, background: string, fallback: string): string {
  const luminance = (hex: string) => [0, 2, 4].map((start) => parseInt(hex.slice(start + 1, start + 3), 16) / 255)
    .map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4)
    .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
  const a = luminance(color), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5 ? color : fallback;
}
function Mark({ settings }: { settings?: SettingsFields }) {
  const [failed, setFailed] = useState('');
  return <span className="visitor-mark">{settings?.logo && settings.logo !== failed
    ? <img src={settings.logo} alt="" referrerPolicy="no-referrer" onError={() => setFailed(settings.logo)} /> : <Leaf size={22} strokeWidth={2.1} />}</span>;
}
function Header({ settings, page }: { settings?: SettingsFields; page: Route | 'missing' }) {
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [page]);
  return <header className="visitor-header">
    <div className="v-container v-header-inner">
      <a className="org-brand" href={href('home')}><Mark settings={settings} /><span>{settings?.organizationName ?? PRODUCT}
        <small>{settings ? PRODUCT : 'Ziyaretçi sitesi'}</small></span></a>
      {settings && <>
        <button className="menu-toggle" aria-expanded={menu} aria-controls="visitor-nav" aria-label={menu ? 'Menüyü kapat' : 'Menüyü aç'} onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button>
        <nav className={menu ? 'v-nav open' : 'v-nav'} id="visitor-nav" aria-label="Ana menü">
          {settings.menu.map((item) => <a key={item} aria-current={page === item ? 'page' : undefined} href={href(item)} onClick={() => setMenu(false)}>{PAGE_NAMES[item]}</a>)}
        </nav>
      </>}
      {DEMO && <span className="demo-mark"><span aria-hidden="true">●</span> Demo</span>}
    </div>
  </header>;
}
function Footer({ settings }: { settings?: SettingsFields }) {
  return <footer className="v-footer"><div className="v-container">
    <div className="v-footer-top">
      <div><a className="org-brand" href={href('home')}><Mark settings={settings} /><span>{settings?.organizationName ?? PRODUCT}</span></a>
        <p>{PRODUCT_NOTE}</p></div>
      <nav aria-label="Yasal metinler ve destek">
        {(Object.keys(LEGAL) as (keyof typeof LEGAL)[]).map((key) => <a key={key} href={href(key)}>{LEGAL[key]}</a>)}
        <a href={settings?.support || href('contact')}>Destek</a>
      </nav>
    </div>
    <div className="v-footer-base"><small>{COPYRIGHT}</small>
      {DEMO && <a href={withDemoOrg('/admin.html')}>Demo yönetim paneli <ArrowUpRight size={14} /></a>}</div>
  </div></footer>;
}
function Visual({ image, fallback, hero = false }: { image?: string; fallback: keyof typeof art; hero?: boolean }) {
  const [failed, setFailed] = useState('');
  const source = image && failed !== image ? image : fallback;
  const local = has(art, source);
  return <img className={hero ? 'hero-art' : 'card-art'} src={local ? art[source] : source}
    alt={hero && local ? SAMPLE_IMAGES[source] : ''} loading={hero || local ? 'eager' : 'lazy'}
    referrerPolicy="no-referrer" onError={() => setFailed(source)} />;
}
function EventsMeta({ item }: { item: PublicItem }) {
  return <div className="event-meta">
    {item.eventDate && <span><CalendarDays size={15} /><time dateTime={item.eventDate}>{displayDate(item.eventDate, true)}</time></span>}
    {item.location && <span><MapPin size={15} />{item.location}</span>}
  </div>;
}
function Card({ item, index }: { item: PublicItem; index: number }) {
  const isEvent = item.kind === 'event';
  return <article className="v-card">
    <a className="v-card-visual" href={href(isEvent ? 'events' : 'posts', item.id)} aria-label={item.title} tabIndex={-1}>
      <Visual image={item.image} fallback={(['local:garden', 'local:shore', 'local:workshop'] as const)[index % 3]} />
      <span className="v-tag">{isEvent ? 'ETKİNLİK' : 'PAYLAŞIM'}</span>
    </a>
    <div className="v-card-content">
      {isEvent ? <EventsMeta item={item} /> : <div className="event-meta"><span><Clock3 size={15} /><time dateTime={item.publishedAt}>{displayDate(item.publishedAt)}</time></span></div>}
      <h3><a href={href(isEvent ? 'events' : 'posts', item.id)}>{item.title}</a></h3>
      {item.summary && <p>{item.summary}</p>}
      <a className="v-card-link" href={href(isEvent ? 'events' : 'posts', item.id)} aria-label={item.title + ' ayrıntıları'}>Ayrıntılar <ArrowUpRight size={16} /></a>
    </div>
  </article>;
}
function CardList({ items, empty }: { items: PublicItem[]; empty: string }) {
  const [visible, setVisible] = useState(9);
  if (!items.length) return <div className="v-empty"><Compass size={25} /><p>{empty}</p></div>;
  return <><div className="v-card-grid">{items.slice(0, visible).map((item, index) => <Card key={item.id} item={item} index={index} />)}</div>
    {items.length > visible && <button type="button" className="v-button secondary" onClick={() => setVisible(visible + 9)}>Daha fazla göster</button>}</>;
}
function sortItems(items: PublicItem[], kind: ContentKind): PublicItem[] {
  return items.filter((item) => item.kind === kind).sort((a, b) => kind === 'event'
    ? a.eventDate.localeCompare(b.eventDate) || b.publishedAt.localeCompare(a.publishedAt)
    : b.publishedAt.localeCompare(a.publishedAt));
}
function Home({ snapshot }: { snapshot: PublicSnapshot }) {
  const { settings, items } = snapshot;
  const upcoming = sortItems(items, 'event').filter((item) => item.eventDate >= localDate()).slice(0, 3);
  const posts = sortItems(items, 'post').slice(0, 3);
  return <>
    <section className="v-container hero">
      <div className="hero-copy">
        <div className="v-eyebrow"><span className="eyebrow-line" /> {settings.organizationName}</div>
        <h1>{settings.tagline || settings.organizationName}</h1>
        {settings.introduction && <p>{settings.introduction}</p>}
        <div className="hero-actions">
          <a className="v-button" href={href('events')}>Etkinlikleri keşfet <ArrowDownRight size={19} /></a>
          <a className="v-text-button" href={href('about')}>Bizi tanıyın <ArrowRight size={17} /></a>
        </div>
      </div>
      <div className="hero-visual"><Visual fallback={settings.theme === 'forest' ? 'local:workshop' : 'local:garden'} hero />
        <span className="hero-caption"><Compass size={14} /> {DEMO ? 'TOPLULUKTAN BİR MANZARA' : 'KURULUŞ SİTESİ'}</span>
      </div>
    </section>
    <section className="v-content-band" aria-labelledby="upcoming">
      <div className="v-container v-section">
        <div className="v-section-head"><div><div className="v-eyebrow"><CalendarDays size={16} /> TAKVİM</div><h2 id="upcoming">Yaklaşan etkinlikler</h2></div>
          <a className="v-text-button" href={href('events')}>Tüm etkinlikler <ArrowUpRight size={17} /></a></div>
        <CardList items={upcoming} empty="Şu anda yaklaşan etkinlik bulunmuyor." />
      </div>
    </section>
    <section className="v-container v-section" aria-labelledby="recent-posts">
      <div className="v-section-head"><div><div className="v-eyebrow"><Leaf size={16} /> GÜNCEL</div><h2 id="recent-posts">Son paylaşımlar</h2></div>
        <a className="v-text-button" href={href('posts')}>Tüm paylaşımlar <ArrowUpRight size={17} /></a></div>
      <CardList items={posts} empty="Henüz yayımlanmış paylaşım bulunmuyor." />
    </section>
  </>;
}
function Inner({ snapshot, route }: { snapshot: PublicSnapshot; route: ReturnType<typeof currentRoute> }) {
  const { settings, items } = snapshot;
  const { page, id } = route;
  if (page === 'home') return <Home snapshot={snapshot} />;
  if (page === 'posts' || page === 'events') {
    const kind = page === 'posts' ? 'post' : 'event';
    const relevant = sortItems(items, kind);
    if (id) {
      const item = relevant.find((entry) => entry.id === id);
      if (!item) return <Missing />;
      return <article className="v-container v-inner">
        <a className="v-text-button" href={href(page)}><ArrowLeft size={16} /> {PAGE_NAMES[page]}</a>
        <h1>{item.title}</h1>
        {kind === 'event' ? <EventsMeta item={item} /> : <div className="event-meta"><Clock3 size={15} />{displayDate(item.publishedAt, true)}</div>}
        {item.summary && <p className="lead">{item.summary}</p>}
        {item.image && <div className="detail-image"><Visual image={item.image} fallback="local:workshop" /></div>}
        <p className="prose">{item.body || 'Bu içerik için ayrıntı eklenmemiş.'}</p>
      </article>;
    }
    return <section className="v-container v-section v-list">
      <div className="v-eyebrow"><span className="eyebrow-line" /> {settings.organizationName}</div><h1>{PAGE_NAMES[page]}</h1>
      <CardList key={page} items={relevant} empty={kind === 'event' ? 'Henüz yayımlanmış etkinlik bulunmuyor.' : 'Henüz yayımlanmış paylaşım bulunmuyor.'} />
    </section>;
  }
  if (page === 'missing') return <Missing />;
  const title = has(LEGAL, page) ? LEGAL[page] : PAGE_NAMES[page];
  return <section className="v-container v-inner">
    <div className="v-eyebrow"><span className="eyebrow-line" /> {settings.organizationName}</div>
    <h1>{title}</h1>
    {page === 'contact' ? <div className="contact-links">
      {settings.email && <a href={'mailto:' + settings.email}><Mail size={20} /> {settings.email}</a>}
      {settings.phone && <a href={'tel:' + settings.phone.replace(/[^+\d]/g, '')}><Phone size={20} /> {settings.phone}</a>}
      {settings.address && <p><MapPin size={20} /> {settings.address}</p>}
      {settings.socials.map((social, index) => <a key={index} href={social.url}><ArrowUpRight size={20} /> {social.label}</a>)}
      {!settings.email && !settings.phone && !settings.address && !settings.socials.length && <p>İletişim bilgileri henüz eklenmemiş.</p>}
    </div> : <p className="prose">{settings[page] || 'Bu sayfa için henüz metin yayımlanmamış.'}</p>}
  </section>;
}
function Missing() {
  return <div className="v-container v-inner"><h1>Sayfa bulunamadı</h1><p>Bağlantı artık yayımlanmıyor olabilir.</p><a className="v-button" href={href('home')}><ArrowLeft size={16} /> Ana sayfa</a></div>;
}

function Visitor() {
  const [route, setRoute] = useState(currentRoute);
  const [snapshot, setSnapshot] = useState<PublicSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checked, setChecked] = useState('');
  const request = useRef<AbortController | null>(null);
  const main = useRef<HTMLElement>(null);
  const reload = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    const timeout = setTimeout(() => controller.abort('timeout'), 15_000);
    try {
      const publication = await getPublication(controller.signal);
      if (request.current === controller) {
        setSnapshot(publication);
        setChecked(new Date().toISOString());
      }
    } catch (problem) {
      if (request.current === controller) {
        setError(problem instanceof AppError ? problem.message :
          'Yayın kaynağına ulaşılamadı. Bağlantınızı kontrol edip yeniden deneyin.');
      }
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const onHash = () => {
      if (location.hash === '#main-content') return;
      setRoute(currentRoute());
      window.scrollTo({ top: 0, behavior: 'instant' });
      main.current?.focus({ preventScroll: true });
    };
    window.addEventListener('hashchange', onHash);
    void reload();
    return () => { window.removeEventListener('hashchange', onHash); const old = request.current; request.current = null; old?.abort(); };
  }, [reload]);
  useEffect(() => {
    const title = route.id ? snapshot?.items.find((item) => item.id === route.id)?.title
      : has(LEGAL, route.page) ? LEGAL[route.page] : has(PAGE_NAMES, route.page) ? PAGE_NAMES[route.page] : 'Sayfa bulunamadı';
    document.title = [title, snapshot?.settings.organizationName, PRODUCT].filter(Boolean).join(' · ');
  }, [route, snapshot]);
  const settings = snapshot?.settings;
  const surface = settings?.theme === 'forest' ? '#f4f6eb' : '#f7f7ef';
  const colors = {
    '--v-paper': surface,
    '--v-ink': settings ? safeColor(settings.primary, surface, '#142b3a') : '#142b3a',
    '--v-accent': settings ? safeColor(safeColor(settings.accent, surface, '#00675f'), '#fffdf6', '#00675f') : '#00675f',
  } as CSSProperties;
  return <div className={'visitor ' + (settings?.theme === 'forest' ? 'forest' : '')} style={colors}>
    <a className="skip" href="#main-content" onClick={(event) => { event.preventDefault(); main.current?.focus(); }}>Ana içeriğe geç</a>
    <Header settings={settings} page={route.page} />
    <main id="main-content" tabIndex={-1} ref={main} aria-busy={loading}>
      {loading && snapshot && <div className="v-container v-state feedback" role="status">Yayın kontrol ediliyor. Son başarılı kontrol {displayTime(checked)}.</div>}
      {error && <div className="v-container v-state feedback error" role="alert">
        <strong>{error}</strong>
        {snapshot && <p>Son başarılı veri gösteriliyor. Son kontrol {displayTime(checked)}.</p>}
        <button className="v-button secondary" onClick={() => void reload()}><RefreshCw size={16} /> Yeniden dene</button>
      </div>}
      {snapshot ? <Inner snapshot={snapshot} route={route} /> : loading && <div className="v-container v-state" role="status">Yayın yükleniyor…</div>}
      {snapshot && <div className="v-container publication-note">
        <span>{loading ? 'Yayın kontrol ediliyor…' : 'Yayın güncellemesi ' + displayTime(snapshot.publishedAt)} · Sürüm {snapshot.version}</span>
        {!error && <button onClick={() => void reload()} disabled={loading}><RefreshCw size={15} /> Yenile</button>}
      </div>}
    </main>
    <Footer settings={settings} />
  </div>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Visitor /></StrictMode>);
