import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.spec\.mjs/,
  timeout: 90000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5174",
    launchOptions: {
      args: [
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        // 本机 localhost 默认解析到 ::1；强制走 IPv4，避免命中其他占用
        // [::1]:5174 的开发服务器。对无此冲突的环境无副作用。
        "--host-resolver-rules=MAP localhost 127.0.0.1",
      ],
    },
  },
  webServer: {
    command: "npm run dev -- --port 5174 --strictPort",
    // 健康检查显式走 IPv4，与浏览器解析保持一致。
    url: "http://127.0.0.1:5174",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    {
      name: "chrome",
      use: {
        channel: "chrome",
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
