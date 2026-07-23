import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

/* eslint-config-next ships flat config directly on Next 16 — no FlatCompat. */
const config = [
  ...nextCoreWebVitals,
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
];

export default config;
