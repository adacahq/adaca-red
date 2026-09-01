'use client';

import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { RunProgress } from '@/lib/workflows/types';

const PUMP_LOOPS = 4;
const EXECUTED_DELAY_MS = 200;
const IDLE_DELAY_MS = 1500;
const MAX_TRANSIENT_ERRORS = 5;

/**
 * Drives the workflow while the submitter waits: N concurrent loops each
 * POST to ./advance, so independent units (the per-principle assess calls,
 * the report sections) execute in parallel server-side instead of strictly
 * one at a time. Each call performs at most one unit of work and reports
 * whether it actually claimed one (`executed`) — a loop that finds nothing
 * claimable backs off further than one that just did work, so the loops
 * settle around however many units are genuinely available concurrently
 * without hammering the server once a step narrows to its last unit. The
 * cron sweeps runs whose tab was closed.
 */
export default function RunStatus({
  submissionId,
  stages,
  showDetail,
}: {
  submissionId: string;
  /** Ordered stage list, derived from the workflow's steps; absent = today's single-line status. */
  stages?: { label: string }[];
  /** Live sub-unit detail line ("part N of M") under the current stage; absent = today's UI. */
  showDetail?: boolean;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [stalled, setStalled] = useState(false);
  const running = useRef(false);

  useEffect(() => {
    if (running.current) return;
    running.current = true;
    let cancelled = false;
    let finished = false;
    let transientErrors = 0;

    async function pump() {
      while (!cancelled && !finished) {
        let p: RunProgress | null = null;
        try {
          const res = await fetch(`/d/s/${submissionId}/advance`, { method: 'POST' });
          if (res.ok) {
            p = (await res.json()) as RunProgress;
            transientErrors = 0;
          } else if (res.status === 404) {
            finished = true;
            setStalled(true);
            return;
          } else {
            transientErrors += 1;
          }
        } catch {
          transientErrors += 1;
        }

        if (transientErrors >= MAX_TRANSIENT_ERRORS) {
          finished = true;
          setStalled(true);
          return;
        }
        if (p) {
          setProgress(p);
          if (p.status === 'done') {
            // No token = terminal misconfig (e.g. workflow shrank under the
            // run) — still stop the loops instead of polling a done run
            // forever; the interrupted notice is the honest fallback.
            finished = true;
            if (p.reportToken) router.push(`/d/r/${p.reportToken}`);
            else setStalled(true);
            return;
          }
          if (p.status === 'failed') {
            finished = true;
            return;
          }
        }
        await new Promise((r) => setTimeout(r, p?.executed ? EXECUTED_DELAY_MS : IDLE_DELAY_MS));
      }
    }

    for (let i = 0; i < PUMP_LOOPS; i++) void pump();
    return () => {
      cancelled = true;
      // Reset the mount guard so a StrictMode dev remount (which cancels
      // this mount's loops) still gets pumping loops on the second mount.
      running.current = false;
    };
  }, [submissionId, router]);

  const failed = progress?.status === 'failed';
  const pct = Math.round((progress?.progress ?? 0) * 100);

  if (failed || stalled) {
    return (
      <div
        className="alert"
        style={{ flexDirection: 'column', gap: 8, borderColor: 'color-mix(in srgb, var(--crit) 30%, transparent)' }}
      >
        <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--crit)' }}>
          Assessment interrupted
        </p>
        <p className="text-[15px]" style={{ lineHeight: 1.7 }}>
          We couldn&rsquo;t finish assessing your documents just now. Your submission is
          safe and will be retried automatically. Keep this page open or check back
          soon; if it still hasn&rsquo;t completed after a while, please submit again.
        </p>
      </div>
    );
  }

  const stepIndex = progress?.stepIndex ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: 15, color: 'var(--muted)' }}>
          {progress?.stepLabel ?? 'Starting'}
        </span>
        <span className="mono" style={{ fontSize: 14, color: 'var(--muted)' }}>{pct}%</span>
      </div>
      <div className="pbar">
        <i style={{ '--w': `${pct}%` } as CSSProperties} />
      </div>
      <p className="mt-4 text-[15px]" style={{ color: 'var(--muted)' }}>
        <span className="spin" aria-hidden style={{ marginRight: 8 }} />
        Assessing on evidence only: every finding is traceable to your documents.
      </p>
      {stages && stages.length > 0 && (
        <div className="wsteps">
          {stages.map((s, i) => {
            const state = i < stepIndex ? 'done' : i === stepIndex ? 'current' : 'pending';
            return (
              <Fragment key={i}>
                <div className={`ws${state === 'current' ? ' on' : ''}${state === 'done' ? ' done' : ''}`}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <span>{s.label}</span>
                </div>
                {i < stages.length - 1 && <div className="wl" />}
              </Fragment>
            );
          })}
        </div>
      )}
      {showDetail && (progress?.subTotal ?? 0) > 1 && (
        <p className="mt-2 text-[13px]" style={{ color: 'var(--muted)' }}>
          Part {Math.min((progress?.subDone ?? 0) + 1, progress?.subTotal ?? 1)} of {progress?.subTotal}
        </p>
      )}
    </div>
  );
}
