import cargoPreset from "@cargo-ai/app-sdk/tailwind-preset";
import type { Config } from "tailwindcss";

const config: Config = {
  presets: [cargoPreset],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "./node_modules/@cargo-ai/app-sdk/build/**/*.js",
  ],
};

export default config;
