'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * The site's motion system (website/src/scripts/canvas-2026.js), adapted.
 * Reveals (.rv), stroke draw-ins ([data-draw]) and figure count-ins
 * ([data-count]) — all gated on the .canvas-motion class the head script
 * sets before paint. Reduced motion / no JS ⇒ finished state, always.
 * Re-scans on every route change; everything runs once per element.
 */
export default function CanvasMotion() {
  const pathname = usePathname();

  useEffect(() => {
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const reveals = Array.from(
      document.querySelectorAll<HTMLElement>('.rv, [data-draw]'),
    ).filter((el) => !el.classList.contains('in'));
    const counts = Array.from(
      document.querySelectorAll<HTMLElement>('[data-count]'),
    ).filter((el) => !el.dataset.counted);

    function finalCount(el: HTMLElement): string {
      return `${el.dataset.count ?? ''}${el.dataset.suffix ?? ''}`;
    }

    // Hidden documents (background tabs) freeze CSS animation clocks —
    // entrances would hang mid-reveal and count-ins would show zeros.
    // A tool must never show wrong figures: render finished states instead.
    if (reduced || document.hidden || typeof IntersectionObserver === 'undefined') {
      for (const el of reveals) el.classList.add('in');
      for (const el of counts) {
        el.textContent = finalCount(el);
        el.dataset.counted = '1';
      }
      return;
    }

    // Let CSS animate stroke-dashoffset over a normalised path length.
    // (JSX-authored .draw elements should set pathLength themselves so the
    // attribute survives React re-renders; this covers static markup.)
    for (const wrap of document.querySelectorAll('[data-draw]')) {
      for (const s of wrap.querySelectorAll('.draw')) {
        if (!s.hasAttribute('pathLength')) s.setAttribute('pathLength', '1');
      }
    }

    function runCount(el: HTMLElement) {
      el.dataset.counted = '1';
      const target = Number(el.dataset.count ?? '0');
      const suffix = el.dataset.suffix ?? '';
      const t0 = performance.now();
      const dur = 900;
      function frame(now: number) {
        const t = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = `${Math.round(target * eased)}${suffix}`;
        if (t < 1) requestAnimationFrame(frame);
        else el.textContent = finalCount(el);
      }
      requestAnimationFrame(frame);
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          const el = en.target as HTMLElement;
          el.classList.add('in');
          if (el.dataset.count !== undefined && !el.dataset.counted) runCount(el);
          io.unobserve(el);
        }
      },
      // threshold 0 + bottom margin so tall or fast-scrolled elements
      // always fire (the site learned this the hard way).
      { threshold: 0, rootMargin: '0px 0px -60px 0px' },
    );

    for (const el of counts) el.textContent = '0';

    for (const el of [...reveals, ...counts]) {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) {
        // Above the fold: fast track, but only after styles have applied.
        el.classList.add('rv-fast');
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            el.classList.add('in');
            if (el.dataset.count !== undefined && !el.dataset.counted) runCount(el);
          }),
        );
      } else {
        io.observe(el);
      }
    }

    return () => io.disconnect();
  }, [pathname]);

  return null;
}
