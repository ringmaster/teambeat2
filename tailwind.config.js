/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {}
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('daisyui')
  ],
  daisyui: {
    themes: [
      {
        "graphite-azure": {
          "color-scheme": "light",
          "primary": "#1E3A8A",
          "primary-content": "#ECF4FF",
          "secondary": "#2563EB",
          "secondary-content": "#F8FAFF",
          "accent": "#60A5FA",
          "accent-content": "#F5FAFF",
          "neutral": "#374151",
          "neutral-content": "#F3F4F6",
          "base-100": "#D1D5DB",
          "base-200": "#E5E7EB",
          "base-300": "#F3F4F6",
          "base-content": "#111827",
          "info": "#60A5FA",
          "success": "#10B981",
          "warning": "#F59E0B",
          "error": "#EF4444",
          "--rounded-box": "0.25rem",
          "--rounded-btn": "0.5rem",
          "--rounded-badge": "0.25rem",
          "--tab-radius": "0.5rem"
        }
      }
    ],
    darkTheme: "graphite-azure",
    base: true,
    styled: true,
    utils: true,
    prefix: "",
    logs: true,
    themeRoot: ":root"
  }
};