/**
 * Cloudflare Worker entry — HTTP Basic Auth gate over the vinext SSR
 * handler, plus image optimization. Adapted from the vinext-generated
 * template (see node_modules/vinext/dist/deploy.js, generateAppRouterWorkerEntry).
 *
 * Auth secrets are set via:
 *   wrangler secret put BASIC_AUTH_USERNAME --name adaca-red
 *   wrangler secret put BASIC_AUTH_PASSWORD --name adaca-red
 */
import {
  handleImageOptimization,
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
} from 'vinext/server/image-optimization';
import handler from 'vinext/server/app-router-entry';
import { createServiceClient, runSweep } from '../src/lib/purge/run';

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  ASSETS: Fetcher;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: {
          format: string;
          quality: number;
        }): Promise<{ response(): Response }>;
      };
    };
  };
  BASIC_AUTH_USERNAME: string;
  BASIC_AUTH_PASSWORD: string;
  // Public-surface abuse protection (see wrangler.jsonc unsafe.bindings);
  // absent in dev, where the limiters are skipped.
  SUBMIT_RATE_LIMITER?: RateLimiter;
  PUMP_RATE_LIMITER?: RateLimiter;
  // Purge cron (scheduled handler). VITE_SUPABASE_URL is baked in at build;
  // the service key is a secret binding.
  SUPABASE_SERVICE_ROLE_KEY?: string;
  /** Canonical public origin for report links in cron-driven runs. */
  PUBLIC_ORIGIN?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const AUTH_REALM = 'Adaca Red';
const NOINDEX = 'noindex, nofollow, noarchive, nosnippet';

/**
 * The public no-login surface (docs/workflow-forms-plan.md §4): /d/* pages
 * plus the static assets they load. Everything else stays behind Basic Auth.
 * Assets are content-hashed build artifacts — nothing sensitive.
 */
function isPublicPath(path: string): boolean {
  return (
    path === '/d' ||
    path.startsWith('/d/') ||
    path.startsWith('/assets/') ||
    path === '/favicon.ico'
  );
}

/** Per-IP rate limits on the public write endpoints (no-op when unbound). */
async function publicRateLimited(request: Request, env: Env, path: string): Promise<boolean> {
  if (request.method !== 'POST') return false;
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (path.startsWith('/d/s/')) {
    // Status-page pump: sequential ~1/s while a run is live.
    const res = await env.PUMP_RATE_LIMITER?.limit({ key: ip });
    return res ? !res.success : false;
  }
  if (path.endsWith('/submit')) {
    const res = await env.SUBMIT_RATE_LIMITER?.limit({ key: ip });
    return res ? !res.success : false;
  }
  return false;
}

function unauthorized(): Response {
  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${AUTH_REALM}"`,
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Robots-Tag': NOINDEX,
    },
  });
}

function isAuthorized(request: Request, env: Env): boolean {
  // If no credentials are configured, leave the gate open (local/dev parity).
  if (!env.BASIC_AUTH_USERNAME && !env.BASIC_AUTH_PASSWORD) return true;
  const header = request.headers.get('Authorization');
  if (!header || !header.startsWith('Basic ')) return false;
  let decoded: string;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }
  const idx = decoded.indexOf(':');
  if (idx === -1) return false;
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  return user === env.BASIC_AUTH_USERNAME && pass === env.BASIC_AUTH_PASSWORD;
}

function withNoIndex(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', NOINDEX);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    // robots.txt is publicly readable so bots see the Disallow.
    if (url.pathname === '/robots.txt') {
      const asset = await env.ASSETS.fetch(
        new Request(new URL('/robots.txt', request.url)),
      );
      return withNoIndex(asset);
    }

    // Public no-login surface: skips Basic Auth, gets rate limits instead.
    if (isPublicPath(url.pathname)) {
      if (await publicRateLimited(request, env, url.pathname)) {
        return withNoIndex(
          new Response(JSON.stringify({ error: 'Too many requests — please slow down.' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      const response = await handler.fetch(request, env, ctx);
      return withNoIndex(response);
    }

    // Everything else is behind Basic Auth.
    if (!isAuthorized(request, env)) {
      return unauthorized();
    }

    // Image optimization (same as vinext's auto-generated template).
    if (url.pathname === '/_vinext/image') {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const imageResponse = await handleImageOptimization(
        request,
        {
          fetchAsset: (path) =>
            env.ASSETS.fetch(new Request(new URL(path, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await env.IMAGES.input(body)
              .transform(width > 0 ? { width } : {})
              .output({ format, quality });
            return result.response();
          },
        },
        allowedWidths,
      );
      return withNoIndex(imageResponse);
    }

    // Delegate everything else to vinext; tag the response.
    const response = await handler.fetch(request, env, ctx);
    return withNoIndex(response);
  },

  /**
   * Hourly sweep (wrangler.jsonc triggers.crons): pumps abandoned workflow
   * runs to completion and hard-purges nodes past their retention clock
   * (whole node: row + revisions + documents + storage objects).
   */
  async scheduled(_event: unknown, env: Env, ctx: ExecutionContext): Promise<void> {
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      console.warn('purge sweep skipped: SUPABASE_SERVICE_ROLE_KEY not set');
      return;
    }
    const origin = env.PUBLIC_ORIGIN ?? 'http://localhost:3000';
    const db = createServiceClient(import.meta.env.VITE_SUPABASE_URL, serviceKey);
    ctx.waitUntil(
      runSweep(db, origin)
        .then((r) =>
          console.log(
            `sweep: pumped ${r.pumpedUnits} units across ${r.pumpedRuns} runs; ` +
              `purged ${r.purgedSubmissions} submissions + ${r.purgedAssessments} assessments ` +
              `(${r.removedObjects} objects)` +
              (r.errors.length ? `; errors: ${r.errors.join(' | ')}` : ''),
          ),
        )
        .catch((err) => console.error('sweep failed', err)),
    );
  },
};
