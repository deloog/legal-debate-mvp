import { test, expect } from "@playwright/test";

test.describe("Basic E2E Tests", () => {
  test("should load home page", async ({ page }) => {
    await page.goto("/");

    // Check if the page loads successfully
    await expect(page).toHaveTitle(/Legal Debate MVP/);
  });

  test("should have proper meta tags", async ({ page }) => {
    await page.goto("/");

    // Check for meta description
    const metaDescription = await page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute("content");
  });

  test("should be responsive", async ({ page }) => {
    await page.goto("/");

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator("body")).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator("body")).toBeVisible();
  });
});
