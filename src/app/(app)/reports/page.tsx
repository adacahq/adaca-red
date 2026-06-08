import Link from 'next/link';
import { ArrowRightIcon } from '@heroicons/react/20/solid';

const REPORTS = [
  { href: '/reports/risk-matrix', title: 'Risk matrix', desc: 'Likelihood × impact grid across the register.' },
  { href: '/reports/red-coverage', title: 'RED coverage', desc: 'Unmitigated and weakly-covered risks.' },
  { href: '/reports/portfolio', title: 'Portfolio', desc: 'Initiatives and the risks they cover.' },
  { href: '/reports/incidents', title: 'Incident analytics', desc: 'Severity and status breakdown.' },
];

export default function Page() {
  return (
    <div className="">
      <h1 style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
        Reports
      </h1>
      <div
        className="mt-6 grid grid-cols-1 md:grid-cols-2"
        style={{ borderTop: '1px solid var(--line)', borderLeft: '1px solid var(--line)' }}
      >
        {REPORTS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="index-card group flex flex-col gap-3 p-8"
            style={{ borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}
          >
            <h2 style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.015em', margin: 0 }}>
              {r.title}
            </h2>
            <p className="text-[14px]" style={{ color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>
              {r.desc}
            </p>
            <span className="mt-auto pt-2">
              <ArrowRightIcon
                className="h-4 w-4 transition-transform group-hover:translate-x-1"
                style={{ color: 'var(--accent)' }}
                aria-hidden
              />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
