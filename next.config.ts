import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // vinext screens EVERY multipart POST (route handlers included, e.g. the
  // public /d/[form]/submit upload) against this server-action body limit
  // before dispatch — the 1 MB default 413s document uploads. The intake
  // accepts 20 MB of files; 25mb leaves multipart/form-field headroom.
  experimental: { serverActions: { bodySizeLimit: "25mb" } },
  // mammoth (DOCX → text in the extract step) ships CJS that vinext's dev
  // module runner can't transform; externalising it loads it via Node
  // instead. Dev-only knob — the Workers build bundles it regardless.
  serverExternalPackages: ["mammoth"],
};

export default nextConfig;
