import vinext from "vinext";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@mdx-js/rollup";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => {
  // The cloudflare() plugin is only needed for `vinext build`/`deploy`.
  // At dev time it routes SSR through a workerd sandbox that's missing
  // globals like WeakRef and breaks the React RSC client.
  const isBuild = command === "build";
  return {
    resolve: { tsconfigPaths: true },
    plugins: [
      tailwindcss(),
      {
        enforce: "pre",
        ...mdx({
          remarkPlugins: [
            remarkGfm,
            remarkFrontmatter,
            [remarkMdxFrontmatter, { name: "meta" }],
          ],
        }),
      },
      vinext(),
      ...(isBuild
        ? [
            cloudflare({
              viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
            }),
          ]
        : []),
    ],
  };
});
