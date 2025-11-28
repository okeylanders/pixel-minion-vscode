/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/presentation/webview/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  // Disable preflight as we use VSCode's base styles
  corePlugins: {
    preflight: false,
  },
};
