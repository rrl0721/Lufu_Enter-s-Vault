// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import rehypeColors from './src/plugins/rehype-colors.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://lufusblog.top',
  integrations: [sitemap()],
  markdown: {
    rehypePlugins: [rehypeColors],
  },
});
