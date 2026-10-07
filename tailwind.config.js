/** @type {import("tailwindcss").Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lab: {
          bg: "#F7F6F2",
          black: "#2B2B2E",
          red: "#A33A31",
          light: "#E7E6E1",
          gray: "#C2C1BB",
          grayDark: "#888783",
          dark: "#535356"
        }
      },
      fontFamily: {
        sans: ["'Asta Sans'", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
      }
    },
  },
  plugins: [],
};
