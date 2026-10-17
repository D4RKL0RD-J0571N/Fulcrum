import { test, expect } from '@playwright/test';

test.describe('Fulcrum Order-Specific Material Planning E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads application shell, disclaimer banner, and initial pick list', async ({ page }) => {
    // Check Top Bar & Branding
    await expect(page.locator('header')).toContainText('Fulcrum');
    await expect(page.locator('header')).toContainText('MU Collection & Material Planner');

    // Check Disclaimer Banner
    await expect(page.locator('main')).toContainText('Offline Stock Observations');
    await expect(page.locator('main')).toContainText('Stock is not guaranteed, reserved, or live-synchronized');

    // Check Physical MU Collection Plan heading
    await expect(page.locator('h2:has-text("Physical Manipulation Units to Collect")')).toBeVisible();
    await expect(page.locator('text=1524289001').first()).toBeVisible();
    await expect(page.locator('text=EC07A').first()).toBeVisible();
    await expect(page.locator('text=MU #502900').first()).toBeVisible();
  });

  test('toggles between dark and light themes smoothly', async ({ page }) => {
    const themeBtn = page.locator('header button:has-text("Light"), header button:has-text("Dark")');
    await expect(themeBtn).toBeVisible();

    const html = page.locator('html');
    const wasDark = await html.evaluate(el => el.classList.contains('dark'));

    // Click to toggle
    await themeBtn.click();
    const isDarkAfter = await html.evaluate(el => el.classList.contains('dark'));
    expect(isDarkAfter).toBe(!wasDark);

    // Click again to toggle back
    await themeBtn.click();
    const isDarkFinal = await html.evaluate(el => el.classList.contains('dark'));
    expect(isDarkFinal).toBe(wasDark);
  });

  test('selecting/deselecting orders updates calculation scope and pick plan', async ({ page }) => {
    // Navigate to Orders tab
    await page.click('button:has-text("Orders")');

    // Check orders list visible
    await expect(page.locator('table').getByText('000815296')).toBeVisible();
    await expect(page.locator('table').getByText('000815297')).toBeVisible();
    await expect(page.locator('table').getByText('000815298')).toBeVisible();

    // Check that 000815298 is currently unchecked (by default 296 and 297 are selected)
    const checkboxes = page.locator('table input[type="checkbox"]');
    await expect(checkboxes).toHaveCount(3);

    // Toggle order 000815298 on
    await checkboxes.nth(2).check();

    // Return to MU Pick Plan
    await page.click('button:has-text("MU Pick Plan")');

    // Scope should now show 3 of 3 orders
    await expect(page.locator('text=3 of 3 orders')).toBeVisible();

    // Shortages table should now appear because 000815298 requests 6 units of 1524289004 but only 4 were observed
    await expect(page.locator('text=Shortages / Uncovered Material Demand')).toBeVisible();
    await expect(page.locator('text=-2u').first()).toBeVisible();
  });

  test('recording and refreshing an observation supersedes older count', async ({ page }) => {
    // Navigate to Stock Observations tab
    await page.click('button:has-text("Stock Observations")');

    // Find the observation for 1524289001 at EC07A and click Refresh
    const row = page.locator('tr:has-text("1524289001"):has-text("EC07A")');
    await expect(row).toBeVisible();
    await row.locator('button:has-text("Refresh")').click();

    // Modal opens with pre-filled SKU and location
    await expect(page.locator('h3:has-text("Record Stock Observation")')).toBeVisible();

    // Update quantity to 10
    const qtyInput = page.locator('input[type="number"]');
    await qtyInput.fill('10');

    // Submit form
    await page.click('button:has-text("Save Observation")');

    // Modal closes and refreshed quantity of 10u is visible in table
    await expect(page.locator('h3:has-text("Record Stock Observation")')).not.toBeVisible();
    await expect(page.locator('tr:has-text("1524289001"):has-text("EC07A")')).toContainText('10u');
  });

  test('creates a new order with material requirement lines and recalculates', async ({ page }) => {
    await page.click('button:has-text("Orders")');

    // Open New Order modal
    await page.click('button:has-text("New Order")');
    await expect(page.locator('h3:has-text("Create Fulfillment Order")')).toBeVisible();

    // Fill in order details
    await page.fill('input[placeholder*="000815299"]', 'ORD-999001');

    // First line
    const skuInput = page.locator('input[placeholder="Material SKU"]').first();
    await skuInput.fill('1524289001');
    const qtyInput = page.locator('input[type="number"]').first();
    await qtyInput.fill('2');

    // Submit
    await page.click('button:has-text("Save Order")');

    // Verify order created in table
    await expect(page.locator('table').getByText('ORD-999001')).toBeVisible();

    // Return to MU Pick Plan and verify recalculation allocates for new order
    await page.click('button:has-text("MU Pick Plan")');
    await expect(page.locator('text=ORD-999001').first()).toBeVisible();
  });

  test('inspects historical run snapshot without mutating previous results', async ({ page }) => {
    // Navigate to Runs history tab
    await page.click('button:has-text("Runs")');

    const firstRunBtn = page.locator('button:has-text("Inspect Snapshot")').first();
    await expect(firstRunBtn).toBeVisible();
    await firstRunBtn.click();

    // Should navigate to Pick Plan with historical warning banner
    await expect(page.locator('text=Viewing Historical Frozen Plan Snapshot')).toBeVisible();

    // Return to latest current plan button works
    await page.click('button:has-text("Return to Latest Current Plan")');
    await expect(page.locator('text=Viewing Historical Frozen Plan Snapshot')).not.toBeVisible();
  });

  test('floor collection checklist toggles task progress without recalculating or mutating plan', async ({ page }) => {
    // Floor checklist progress bar is visible
    await expect(page.locator('text=Floor Collection Checklist:')).toBeVisible();
    await expect(page.locator('text=0 / 3 units collected')).toBeVisible();

    // Initial KPI pieces allocated
    await expect(page.locator('text=/ 11 requested')).toBeVisible();

    // Check first MU collection task
    const firstTaskCheck = page.locator('input[aria-label*="Mark task"]').first();
    await firstTaskCheck.check();

    // Progress updates to 1 / 3 units collected
    await expect(page.locator('text=1 / 3 units collected')).toBeVisible();

    // KPI pieces allocated remains exactly the same (no stock decrement or recalculation)
    await expect(page.locator('text=/ 11 requested')).toBeVisible();

    // Reset checklist works
    await page.click('button:has-text("Reset Checklist")');
    await expect(page.locator('text=0 / 3 units collected')).toBeVisible();
  });

  test('detects and displays conflicting MU location warning banner and readiness alert', async ({ page }) => {
    // Navigate to Stock Observations tab
    await page.click('button:has-text("Stock Observations")');

    // Add an observation for MU 502900 at a conflicting location (e.g. EB99Z instead of EC07A)
    await page.click('button:has-text("Record Stock Observation")');
    await expect(page.locator('h3:has-text("Record Stock Observation")')).toBeVisible();

    await page.fill('input[placeholder*="1524289001"]', '1524289004');
    await page.fill('input[placeholder*="502900"]', '502900');
    await page.fill('input[placeholder*="EC07A"]', 'EB99Z');
    await page.click('button:has-text("Save Observation")');

    // Navigate to Orders tab and select 000815298 (which requires 1524289004)
    await page.click('button:has-text("Orders")');
    const orderCheckboxes = page.locator('table input[type="checkbox"]');
    await orderCheckboxes.nth(2).check();

    // Return to MU Pick Plan
    await page.click('button:has-text("MU Pick Plan")');

    // Prominent Readiness banner must appear
    await expect(page.locator('text=Plan Not Ready for Floor Collection')).toBeVisible();
    await expect(page.locator('text=Resolution Required').first()).toBeVisible();

    // The card for MU #502900 displays LOCATION CONFLICT
    await expect(page.locator('text=LOCATION CONFLICT: Reported at')).toBeVisible();

    // Physical MU count remains 1 for 502900 (not duplicated)
    await expect(page.locator('text=MU #502900')).toHaveCount(1);
  });
});
