// @ts-check
import { test, expect } from '@playwright/test'

// Skip if E2E_BASE_URL not set (unit CI doesn't run E2E)
test.skip(!process.env['E2E_BASE_URL'], 'E2E_BASE_URL not set — skipped in unit CI')

const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:3000'

test('home page returns 200 — REQ-150', async ({ page }) => {
  const response = await page.goto(`${BASE_URL}/`)
  expect(response?.status()).toBe(200)
})

test('auth: unauthenticated /admin redirects to /login — REQ-150', async ({ page }) => {
  await page.goto(`${BASE_URL}/admin`)
  await expect(page).toHaveURL(/\/login/)
})

test('form submission: contact form renders — REQ-150', async ({ page }) => {
  await page.goto(`${BASE_URL}/contact`)
  await expect(page.locator('[data-testid="contact-form"]')).toBeVisible()
})

test('booking flow: calendar page accessible — REQ-150', async ({ page }) => {
  const response = await page.goto(`${BASE_URL}/booking`)
  // Accept 200 (booking exists) or 404 (booking not configured for this agency)
  expect([200, 404]).toContain(response?.status())
})

// Phase 11 deferred: live erasure form presence — REQ-150, 11-VERIFICATION.md line 29
test('ccpa: erasure form visible — REQ-150 + Phase 11 deferred', async ({ page }) => {
  await page.goto(`${BASE_URL}/privacy/erasure`)
  await expect(page.locator('[data-testid="erasure-request-form"]')).toBeVisible()
})
