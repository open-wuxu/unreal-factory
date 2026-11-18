import { defineConfig } from "vite";

export default defineConfig({
  // 相对路径，方便将 dist 部署到任意子目录
  base: "./",
  server: {
    host: true,
    port: 5173,
  },
});
