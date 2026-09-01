import Link from 'next/link';
import type { CSSProperties } from 'react';

const REPORTS = [
  { tid: '01', href: '/reports/risk-matrix', title: 'Risk matrix', desc: 'Likelihood × impact grid across the register.' },
  { tid: '02', href: '/reports/red-coverage', title: 'RED coverage', desc: 'Unmitigated and weakly-covered risks.' },
  { tid: '03', href: '/reports/portfolio', title: 'Portfolio', desc: 'Initiatives and the risks they cover.' },
  { tid: '04', href: '/reports/incidents', title: 'Incident analytics', desc: 'Severity and status breakdown.' },
];

export default function Page() {
  return (
    <div>
      <p className="eyebrow rv">Reports</p>
      <h1 className="view-title rv" style={{ '--i': 1 } as CSSProperties}>
        Reports
      </h1>
      <p className="lede rv" style={{ '--i': 2 } as CSSProperties}>
        Four fixed views onto the register: inherent exposure, RED coverage, portfolio reach and incident load.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 rv" style={{ '--i': 3 } as CSSProperties}>
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href} className="card">
            <div className="top">
              <span className="tid">{r.tid}</span>
            </div>
            <h3>{r.title}</h3>
            <p style={{ marginTop: 8, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{r.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
