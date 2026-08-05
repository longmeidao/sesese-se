import { expect, test } from "@playwright/test";

test("home presents one artwork and primary navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "藏品", exact: true }),
  ).toBeVisible();
  await expect(page.locator("img").first()).toBeVisible();
});

test("archive remains usable without horizontal overflow", async ({ page }) => {
  await page.goto("/archive/");
  await expect(page.getByRole("heading", { name: "藏品" })).toBeVisible();
  await expect(page.locator('main a[href^="/"]').first()).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("about page exposes the collection statement", async ({ page }) => {
  await page.goto("/about/");
  await expect(page.locator("main")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /展示笔者心水之画作/ }),
  ).toBeVisible();
});
