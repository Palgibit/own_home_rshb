import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Относительные пути: сайт работает и на GitHub Pages (/own_home_rshb/), и из file://
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Крупные библиотеки — отдельными файлами: браузер кэширует их между обновлениями сайта
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          mathjs: ["mathjs"],
          recharts: ["recharts"],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
