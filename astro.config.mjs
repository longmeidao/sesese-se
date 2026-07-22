import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://sesese.se',
  output: 'static',
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'viewport',
  },
});
