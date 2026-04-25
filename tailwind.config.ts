import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        shift: {
          recruit: { bg: "#fef2f2", border: "#f87171", text: "#991b1b" },
          hq: { bg: "#eff6ff", border: "#60a5fa", text: "#1e3a8a" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
