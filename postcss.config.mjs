/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // autoprefixer is deliberately absent rather than forgotten: Tailwind v4
    // runs Lightning CSS internally and prefixes as part of that, so keeping a
    // second prefixer here would be a slower no-op at best.
    "@tailwindcss/postcss": {},
  },
};

export default config;
