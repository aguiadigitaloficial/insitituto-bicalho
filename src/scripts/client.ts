import { initAssistant } from './assistant';
const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector);
const $$ = <T extends Element = HTMLElement>(selector: string) => [...document.querySelectorAll<T>(selector)];

// Width descriptors must cover the complete photo behind a crop, not just its visible frame.
// Recheck when wrapping text, zoom, breakpoints or the team panel change that frame's size.
function updatePhotoSize(image: HTMLImageElement) {
  const width = image.clientWidth, height = image.clientHeight;
  if (!width || !height) return;
  const aspect = Number(image.getAttribute('width')) / Number(image.getAttribute('height'));
  const slot = Math.ceil(getComputedStyle(image).objectFit === 'cover' ? Math.max(width, height * aspect) : width);
  const sizes = `${slot}px`;
  if (image.sizes === sizes) return;
  image.closest('picture')?.querySelectorAll('source').forEach(source => { source.sizes = sizes; });
  image.sizes = sizes;
}
const photoImages = $$<HTMLImageElement>('.photo img');
if ('ResizeObserver' in window) {
  const photoObserver = new ResizeObserver(entries => entries.forEach(entry => updatePhotoSize(entry.target as HTMLImageElement)));
  photoImages.forEach(image => { updatePhotoSize(image); photoObserver.observe(image); });
}
const menu = $('.mobile-nav')!;
const menuButton = $<HTMLButtonElement>('.menu-toggle')!;
function closeMenu() { menu.setAttribute('hidden', ''); menuButton.setAttribute('aria-expanded', 'false'); menuButton.setAttribute('aria-label', 'Abrir menu'); updateBar(); }
menuButton.addEventListener('click', () => {
  const opening = menuButton.getAttribute('aria-expanded') !== 'true';
  menu.toggleAttribute('hidden', !opening); menuButton.setAttribute('aria-expanded', String(opening)); menuButton.setAttribute('aria-label', opening ? 'Fechar menu' : 'Abrir menu'); updateBar();
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.hasAttribute('hidden')) { closeMenu(); menuButton.focus(); } });
document.addEventListener('click', event => { if (!(event.target as HTMLElement).closest('.site-header')) closeMenu(); });
menu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
matchMedia('(min-width:1200px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

const dialog = $<HTMLDialogElement>('#booking-dialog')!;
// Explicit wrapping also covers browsers that move focus to browser chrome at the dialog boundary.
$$<HTMLDialogElement>('dialog').forEach(modal => modal.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const controls = [...modal.querySelectorAll<HTMLElement>('a[href], button, textarea, input, select, [tabindex]')]
    .filter(control => control.tabIndex >= 0 && !control.hasAttribute('disabled') && control.getClientRects().length > 0);
  if (!controls.length) return;
  const first = controls[0], last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}));
let bookingTrigger: HTMLElement | null = null;
let bookingPosition = 'dialog';
$$<HTMLAnchorElement>('[data-booking]').forEach(link => link.addEventListener('click', event => {
  if (!dialog.showModal) return;
  event.preventDefault(); bookingTrigger = link; bookingPosition = link.dataset.position || 'content'; closeMenu(); dialog.showModal(); document.body.classList.add('modal-open'); updateBar();
}));
$('.dialog-close')?.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
dialog.addEventListener('close', () => {
  document.body.classList.remove('modal-open'); updateBar();
  const fallback = menuButton.getClientRects().length ? menuButton : $('#primary-booking');
  (bookingTrigger?.getClientRects().length ? bookingTrigger : fallback)?.focus({ preventScroll: true });
});

const bar = $('.mobile-cta')!;
const launcher = $('.assistant-launcher')!;
const support = $<HTMLDialogElement>('#support-dialog')!;
const notice = $('.cookie-notice')!;
let heroPassed = false;
let unitsVisible = false;
let footerVisible = false;
let clearanceFrame = 0;
const captionAreas = $$('.hero-image-base, .portrait-note');
const pageActions = $$('main a, main button, main summary, .site-footer a, .site-footer button, .hero-image-base, .portrait-note');
function overlaps(rect: DOMRect, target: Element) {
  const box = target.getBoundingClientRect();
  return box.width > 0 && box.height > 0 && box.left < rect.right && box.right > rect.left && box.top < rect.bottom && box.bottom > rect.top;
}
function updateLauncherClearance() {
  clearanceFrame = 0;
  // Attached photo captions need the same clearance as interactive content.
  bar.toggleAttribute('data-obstructed', !bar.hidden && captionAreas.some(caption => overlaps(bar.getBoundingClientRect(), caption)));
  if (launcher.hidden || document.activeElement === launcher) {
    launcher.removeAttribute('data-obstructed');
    return;
  }
  const helper = launcher.getBoundingClientRect();
  const obstructed = pageActions.some(action => overlaps(helper, action));
  launcher.toggleAttribute('data-obstructed', obstructed);
}
function scheduleLauncherClearance() {
  if (!clearanceFrame) clearanceFrame = requestAnimationFrame(updateLauncherClearance);
}
function updateBar() {
  const blocked = dialog.open || support.open || !notice.hasAttribute('hidden') || !menu.hidden;
  const visible = heroPassed && !unitsVisible && !footerVisible && !blocked;
  bar.toggleAttribute('hidden', !visible);
  launcher.toggleAttribute('hidden', blocked);
  document.body.classList.toggle('booking-dock-visible', visible);
  document.body.classList.toggle('footer-visible', footerVisible);
  document.body.classList.toggle('units-visible', unitsVisible);
  scheduleLauncherClearance();
}
initAssistant(updateBar);
window.addEventListener('scroll', scheduleLauncherClearance, { passive: true });
window.addEventListener('resize', scheduleLauncherClearance);
if ('IntersectionObserver' in window) {
  const primary = $('#primary-booking');
  if (primary) new IntersectionObserver(entries => { const entry = entries[0]; heroPassed = !entry.isIntersecting && entry.boundingClientRect.top < $('.site-header')!.getBoundingClientRect().height; updateBar(); }, { threshold: 0, rootMargin: `-${$('.site-header')!.getBoundingClientRect().height}px 0px 0px 0px` }).observe(primary);
  const units = $('#unidades');
  if (units) new IntersectionObserver(entries => { unitsVisible = entries[0].isIntersecting; updateBar(); }, { threshold: .05 }).observe(units);
  const footer = $('.site-footer');
  if (footer) new IntersectionObserver(entries => { footerVisible = entries[0].isIntersecting; updateBar(); }, { threshold: 0 }).observe(footer);
}

// Basic navigation is independent from the optional animation bundle.
import('./motion').then(module => module.initMotion()).catch(() => {
  document.body.dataset.motion = 'unavailable';
});
// Attribution stays in the URL before consent. Only named campaign parameters are propagated.
const campaignKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const campaign: Record<string, string> = {};
const currentUrl = new URL(location.href);
for (const key of campaignKeys) { const value = currentUrl.searchParams.get(key); if (value) campaign[key] = value.slice(0, 120); }
$$<HTMLAnchorElement>('a[href]').forEach(link => {
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || link.getAttribute('href')?.startsWith('#')) return;
  for (const [key, value] of Object.entries(campaign)) url.searchParams.set(key, value);
  link.href = `${url.pathname}${url.search}${url.hash}`;
});

type Consent = 'granted' | 'denied';
type AnalyticsWindow = Window & typeof globalThis & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; [key: string]: unknown };
const analyticsWindow = window as AnalyticsWindow;
const gaId = document.body.dataset.gaId || '';
const gaEnabled = /^G-[A-Z0-9]+$/.test(gaId);
let consent: Consent | null = null;
let analyticsStarted = false;
const consentKey = 'bicalho-consent-v1';
try { const saved = JSON.parse(localStorage.getItem(consentKey) || 'null'); if (saved && Date.now() - saved.at < 180 * 86400000 && ['granted', 'denied'].includes(saved.value)) consent = saved.value; } catch { /* Storage may be unavailable; choices still work in memory. */ }
function clearAnalyticsCookies() {
  for (const item of document.cookie.split(';')) {
    const name = item.trim().split('=')[0];
    if (!/^_ga(?:_|$)/.test(name)) continue;
    document.cookie = `${name}=; Max-Age=0; path=/`;
    const labels = location.hostname.split('.');
    for (let i = 0; i < labels.length - 1; i++) document.cookie = `${name}=; Max-Age=0; path=/; domain=.${labels.slice(i).join('.')}`;
  }
}
function startAnalytics() {
  if (!gaEnabled || consent !== 'granted' || analyticsStarted) return;
  analyticsStarted = true;
  analyticsWindow[`ga-disable-${gaId}`] = false;
  analyticsWindow.dataLayer = analyticsWindow.dataLayer || [];
  analyticsWindow.gtag = function (..._args: unknown[]) { analyticsWindow.dataLayer!.push(arguments); };
  const gtag = analyticsWindow.gtag;
  gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  gtag('js', new Date());
  const cleanLocation = new URL(location.pathname, location.origin).href;
  gtag('config', gaId, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, page_location: cleanLocation, page_referrer: document.referrer ? new URL(document.referrer).origin : '' });
  gtag('event', 'page_view', { page_location: cleanLocation, page_title: document.title, ...(campaign.utm_source ? { campaign_source: campaign.utm_source } : {}), ...(campaign.utm_medium ? { campaign_medium: campaign.utm_medium } : {}), ...(campaign.utm_campaign ? { campaign_name: campaign.utm_campaign } : {}) });
  const script = document.createElement('script'); script.async = true; script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`; document.head.append(script);
}
function saveConsent(value: Consent) {
  const previous = consent; consent = value;
  try { localStorage.setItem(consentKey, JSON.stringify({ value, at: Date.now() })); } catch { /* In-memory consent remains valid for this page. */ }
  notice.hidden = true; updateBar();
  $('#consent-status')!.textContent = value === 'granted' ? 'Preferências salvas. Cookies de análise permitidos.' : 'Preferências salvas. Cookies de análise recusados.';
  if (value === 'denied') { analyticsWindow[`ga-disable-${gaId}`] = true; clearAnalyticsCookies(); if (previous === 'granted' && analyticsStarted) location.reload(); }
  else startAnalytics();
}
$$<HTMLButtonElement>('[data-consent]').forEach(button => button.addEventListener('click', () => saveConsent(button.dataset.consent as Consent)));
$$('[data-cookie-settings]').forEach(button => button.addEventListener('click', () => { notice.hidden = false; updateBar(); notice.querySelector<HTMLButtonElement>('button')?.focus(); }));
// No disruptive consent banner on a preview with no analytics configured.
if (gaEnabled && consent === null) notice.hidden = false;
if (consent === 'granted') startAnalytics();
document.addEventListener('click', event => {
  const link = (event.target as Element).closest<HTMLAnchorElement>('a[data-whatsapp]');
  if (!link || consent !== 'granted' || !gaEnabled || !analyticsWindow.gtag) return;
  analyticsWindow.gtag('event', 'whatsapp_click', {
    unit: link.dataset.whatsapp,
    placement: link.dataset.position === 'dialog' ? bookingPosition : link.dataset.position,
    transport_type: 'beacon',
  });
});
updateBar();
