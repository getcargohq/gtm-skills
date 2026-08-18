import react from "@vitejs/plugin-react";
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";
import { defineConfig } from "vite";

// Cargo Hosting bakes VITE_APP_BASE_PATH into the env so apps can be served
// from a subpath in dev. In production deployments base="/" works because each
// app gets its own subdomain.
const base =
  process.env["VITE_APP_BASE_PATH"] !== undefined
    ? process.env["VITE_APP_BASE_PATH"]
    : "/";

export default defineConfig({
  plugins: [react()],
  base,
  css: {
    postcss: {
      plugins: [tailwindcss, autoprefixer],
    },
  },
});
