import { defineConfig } from 'vitest/config';

/**
 * Unit tests target the PURE modules (token rendering, retention policy,
 * verdict math, schema derivation, form-config logic) — no Supabase, no
 * network, no Workers runtime. The authoritative typecheck remains
 * `npm run build` (vinext); this config deliberately avoids the vinext/
 * cloudflare plugins.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
