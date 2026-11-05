import { test, expect } from "@playwright/test";

test("boots and renders a non-blank canvas", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("/");
  await page.waitForFunction(() => window.__bund?.ready === true, null, { timeout: 60000 });
  await page.waitForTimeout(500);
  await expect(page.locator("#scene")).toBeVisible();
  const shot = await page.screenshot({ path: "test-results/task-01.png" });
  expect(shot.length).toBeGreaterThan(20000);
  expect(errors.filter((e) => !e.includes("favicon"))).toEqual([]);
});
