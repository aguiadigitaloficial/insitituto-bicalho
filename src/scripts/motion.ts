import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });
const all = <T extends Element = HTMLElement>(selector: string) => [...document.querySelectorAll<T>(selector)];
const revealed = new WeakSet<Element>();

export async function initMotion() {
  await document.fonts.ready;
  const media = gsap.matchMedia();
  media.add({ mobile: '(max-width:1199px)', desktop: '(min-width:1200px)', reduced: '(prefers-reduced-motion:reduce)' }, context => {
    const { mobile, reduced } = context.conditions!;
    document.body.dataset.motion = reduced ? 'reduced' : 'ready';
    // Interactive tweens may capture an in-flight press as their revert baseline.
    // Always restore the resting CTA before rebuilding or disabling motion.
    gsap.set('[data-booking-cta], [data-booking-cta] .brand-button-symbol', { clearProps: 'transform,backgroundColor' });
    if (reduced) return;
    const cleanups: (() => void)[] = [];
    const distance = mobile ? 14 : 42;
    const triggerFor = (element: Element) => ({ trigger: element.matches('.unit') ? element.closest('.units') || element : element, start: mobile ? 'top 82%' : 'top 92%', once: true, onLeave: (self: ScrollTrigger) => { self.animation?.progress(1); } });

    // Animate the heading as a whole so CSS owns its balanced, accessible lines.
    all('main h1, main section h2').filter(el => !el.closest('.legal')).forEach(heading => {
      if (revealed.has(heading)) return;
      const hero = !!heading.closest('.hero, .inner-hero');
      gsap.from(heading, { y: mobile ? 10 : 18, opacity: 0, duration: mobile ? .65 : .8, ease: 'power3.out',
        ...(hero ? { delay: .03 } : { scrollTrigger: triggerFor(heading) }),
        onComplete: () => { revealed.add(heading); },
      });
    });

    const hero = document.querySelector('.hero, .inner-hero');
    if (hero) {
      hero.querySelectorAll('.hero-copy>p, .hero-eyebrow, .hero-location, .inner-hero-copy>p').forEach((element, index) => {
        if (revealed.has(element)) return;
        gsap.from(element, { y: mobile ? 10 : 15, opacity: 0, duration: .55, ease: 'power2.out',
          ...(mobile ? { scrollTrigger: triggerFor(element) } : { delay: .15 + index * .055 }),
          onComplete: () => { revealed.add(element); },
        });
      });
    }
    // The reception photo and its attached base enter as one composed frame.
    const homeVisual = document.querySelector('.hero-visual');
    if (homeVisual && !revealed.has(homeVisual)) {
      gsap.from(homeVisual, { y: mobile ? 12 : 20, opacity: 0, duration: .65, ease: 'power3.out',
        ...(mobile ? { scrollTrigger: triggerFor(homeVisual) } : { delay: .12 }),
        onComplete: () => { revealed.add(homeVisual); },
      });
    }
    all('main .photo').filter(photo => !photo.matches('.hero-photo')).forEach(photo => {
      if (revealed.has(photo)) return;
      const heroPhoto = photo.matches('.hero-photo, .inner-hero-photo');
      const timeline = gsap.timeline({
        ...(heroPhoto && !mobile ? { delay: .12 } : { scrollTrigger: triggerFor(photo) }),
        onComplete: () => { revealed.add(photo); },
      });
      timeline.from(photo.querySelector('picture'), {
        ...(mobile ? { opacity: 0, y: 12 } : { clipPath: 'inset(8% 0 0 0 round 28px)', y: 28 }),
        duration: mobile ? .6 : .75, ease: 'power3.out',
      });
      timeline.from(photo.querySelector('img'), { scale: 1.035, duration: mobile ? .7 : .9, ease: 'power2.out' }, 0);
    });

    all('.institution-copy>p, .section-intro>p, .precision-intro>p, .section-heading>p, .area-card-copy, .unit, .service, .portrait-note').forEach((element, index) => {
      if (revealed.has(element)) return;
      const card = element.matches('.area-card-copy, .unit');
      gsap.from(element, { opacity: 0, y: card ? distance : mobile ? 10 : 18, x: card && !mobile ? (index % 2 ? 12 : -12) : 0, duration: card ? .7 : .55, ease: 'power3.out', scrollTrigger: triggerFor(element), onComplete: () => { revealed.add(element); } });
    });

    const steps = all('.digital-flow li');
    all<SVGPathElement>('.flow-connection path').forEach(path => {
      gsap.fromTo(path, { strokeDashoffset: 100 }, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: path.closest('li'), start: 'top 80%', end: 'bottom 45%', scrub: .35 } });
    });
    all<HTMLElement>('[data-booking-cta]').forEach((button, index) => {
      const circle = button.querySelector('.brand-button-symbol');
      const pressName = `pressCTA${index}`;
      context.add(pressName, () => {
        gsap.to(button, { scale: .97, backgroundColor: '#075266', duration: .12, overwrite: true });
        if (circle) gsap.to(circle, { scale: 1.09, rotation: -7, duration: .18, overwrite: true });
      });
      const releaseName = `releaseCTA${index}`;
      context.add(releaseName, () => {
        gsap.to(button, { scale: 1, backgroundColor: '#007c85', duration: .24, clearProps: 'transform,backgroundColor', overwrite: true });
        if (circle) gsap.to(circle, { scale: 1, rotation: 0, duration: .24, clearProps: 'transform', overwrite: true });
      });
      let pressed = false;
      const press = () => { pressed = true; context[pressName](); };
      const release = () => { if (pressed) { pressed = false; context[releaseName](); } };
      const keyboard = (event: KeyboardEvent) => { if (event.key === 'Enter') { press(); release(); } };
      button.addEventListener('pointerdown', press); button.addEventListener('keydown', keyboard);
      window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release);
      cleanups.push(() => { button.removeEventListener('pointerdown', press); button.removeEventListener('keydown', keyboard); window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release); });
    });
    context.add('animateChat', (event: CustomEvent<{ element: HTMLElement }>) => {
      gsap.fromTo(event.detail.element, { y: 9 }, { y: 0, duration: .2, clearProps: 'transform', overwrite: true });
    });
    const chatHandler = (event: Event) => context.animateChat(event);
    document.addEventListener('bicalho:chat-step', chatHandler);
    cleanups.push(() => document.removeEventListener('bicalho:chat-step', chatHandler));
    steps.forEach((step, index) => {
      ScrollTrigger.create({ trigger: step, start: mobile ? 'top 75%' : `top ${80-index*12}%`, end: 'bottom 20%',
        onEnter: () => step.classList.add('is-current'), onLeaveBack: () => step.classList.remove('is-current'),
      });
    });

    // Native details remain fully functional without JS. GSAP adds a short height transition.
    all<HTMLDetailsElement>('.faq-list details, .team-panel').forEach(details => {
      const summary = details.querySelector('summary')!;
      const body = details.querySelector<HTMLElement>('.faq-answer, .team-panel-content')!;
      let intendedOpen = details.open;
      let tween: gsap.core.Tween | undefined;
      const click = (event: Event) => {
        event.preventDefault();
        intendedOpen = !(tween?.isActive() ? intendedOpen : details.open);
        const height = details.getBoundingClientRect().height;
        tween?.kill();
        if (intendedOpen) details.open = true;
        body.inert = !intendedOpen;
        const target = intendedOpen ? summary.getBoundingClientRect().height + body.scrollHeight + 2 : summary.getBoundingClientRect().height + 2;
        gsap.set(details, { height, overflow: 'hidden' });
        tween = gsap.to(details, { height: target, duration: .23, ease: 'power2.inOut', onComplete: () => {
          details.open = intendedOpen; body.inert = false;
          gsap.set(details, { clearProps: 'height,overflow' }); ScrollTrigger.refresh();
        } });
      };
      const name = `accordion${cleanups.length}`;
      context.add(name, click);
      const handler = (event: Event) => context[name](event);
      summary.addEventListener('click', handler);
      cleanups.push(() => { summary.removeEventListener('click', handler); if (tween?.isActive()) details.open = intendedOpen; tween?.kill(); body.inert = false; gsap.set(details, { clearProps: 'height,overflow' }); });
    });

    const dialog = document.querySelector<HTMLDialogElement>('#booking-dialog')!;
    context.add('animateDialog', () => {
      if (dialog.open) gsap.fromTo(dialog, { y: 16, opacity: .4, scale: .98 }, { y: 0, opacity: 1, scale: 1, duration: .22, clearProps: 'transform,opacity', ease: 'power2.out' });
    });
    const dialogObserver = new MutationObserver(() => context.animateDialog());
    dialogObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] });
    const menu = document.querySelector<HTMLElement>('.mobile-nav')!;
    context.add('animateMenu', () => {
      if (!menu.hidden) gsap.fromTo(menu, { y: -8, opacity: .3 }, { y: 0, opacity: 1, duration: .2, clearProps: 'transform,opacity' });
    });
    const menuObserver = new MutationObserver(() => context.animateMenu());
    menuObserver.observe(menu, { attributes: true, attributeFilter: ['hidden'] });
    ScrollTrigger.refresh();
    return () => { dialogObserver.disconnect(); menuObserver.disconnect(); cleanups.forEach(cleanup => cleanup()); steps.forEach(step => step.classList.remove('is-current')); };
  });
  // Refresh document geometry after native details and image decodes as well.
  let refreshTimer: ReturnType<typeof setTimeout>;
  const refresh = () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 120); };
  document.addEventListener('toggle', refresh, true);
  all<HTMLImageElement>('img').forEach(img => { if (!img.complete) img.addEventListener('load', refresh, { once: true }); });
  let layoutWidth = document.documentElement.clientWidth;
  new ResizeObserver(() => {
    const width = document.documentElement.clientWidth;
    if (width !== layoutWidth) { layoutWidth = width; refresh(); }
  }).observe(document.documentElement);
}
