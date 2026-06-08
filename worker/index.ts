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
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const AUTH_REALM = 'Adaca Red';
const NOINDEX = 'noindex, nofollow, noarchive, nosnippet';

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
};
