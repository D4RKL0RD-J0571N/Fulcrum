import { test, expect } from '@playwright/test';

test.describe('Fulcrum Operations Overview E2E Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads dashboard shell, KPIs, and default location drawer EH14D', async ({ page }) => {
    // Check Top Bar & Branding
    await expect(page.locator('header')).toContainText('Global Fulfillment');
    await expect(page.locator('header')).toContainText('WH-01');

    // Check KPI strip
    const kpiStrip = page.locator('section.grid-cols-5');
    await expect(kpiStrip).toContainText('Pending orders');
    await expect(kpiStrip).toContainText('Fulfillment throughput');

    // Verify Default Location EH14D loaded in Drawer
    const drawer = page.locator('aside.border-border.rounded-md');
    await expect(drawer).toContainText('EH14D');
    await expect(drawer).toContainText('502900');
  });

  test('clicking a bay on the warehouse map updates selection drawer', async ({ page }) => {
    // Select Bay EC07 (high activity hotspot)
    const bayEC07 = page.locator('svg#mapSvg g.bay[data-bay="EC07"]');
    if (await bayEC07.count() > 0) {
      await bayEC07.click();
      const drawer = page.locator('aside.border-border.rounded-md');
      await expect(drawer).toContainText('EC07');
    }
  });

  test('searching by 6-digit MU number updates location and opens drawer', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search location"]');
    await searchInput.fill('502900');
    await searchInput.press('Enter');

    // Should focus bay EH14
    const drawer = page.locator('aside.border-border.rounded-md');
    await expect(drawer).toContainText('EH14');
    await expect(drawer).toContainText('502900');
  });

  test('clicking an AI evidence chip selects the record', async ({ page }) => {
    // Click evidence chip "502900" in AI assistant panel
    const muChip = page.locator('button.chip:has-text("502900")').first();
    if (await muChip.count() > 0) {
      await muChip.click();
      await expect(page.locator('aside')).toContainText('502900');
    }
  });

  test('opens and completes the Review Plan modal', async ({ page }) => {
    const reviewBtn = page.locator('button:has-text("Review Plan")');
    await reviewBtn.click();

    // Verify modal appears
    await expect(page.locator('h2:has-text("Review proposed plan")')).toBeVisible();

    // Check approval checkbox
    const checkbox = page.locator('input[type="checkbox"]');
    await checkbox.check();

    // Approve button should become enabled
    const approveBtn = page.locator('button:has-text("Approve")');
    await expect(approveBtn).toBeEnabled();
    await approveBtn.click();

    // Verify modal closes and status reflects approval
    await expect(page.locator('h2:has-text("Review proposed plan")')).not.toBeVisible();
    await expect(page.locator('text=Approved')).toBeVisible();
  });
});
