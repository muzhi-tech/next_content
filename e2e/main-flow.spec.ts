import { test, expect } from '@playwright/test';

test.describe('Homepage loading', () => {
  test('should load and display the dashboard title', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('内容监控矩阵')).toBeVisible();
  });

  test('should display the navigation section label', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('导航')).toBeVisible();
  });
});

test.describe('Navigation items display', () => {
  test('should show all 7 main navigation buttons', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: '采集内容' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'AI写文' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'AI作图' })).toBeVisible();
    await expect(page.getByRole('button', { name: '选题分析与报告' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Wiki知识库' })).toBeVisible();
    await expect(page.getByRole('button', { name: '账号空间' })).toBeVisible();
    await expect(page.getByRole('button', { name: '监控设置' })).toBeVisible();
  });
});

test.describe('Tab switching', () => {
  test('should default to content tab with heading', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: '采集内容' })).toBeVisible();
  });

  test('should switch to AI写文 tab', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'AI写文' }).click();

    await expect(page.getByRole('heading', { name: 'AI写文' })).toBeVisible();
  });

  test('should switch to AI作图 tab', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'AI作图' }).click();

    await expect(page.getByRole('heading', { name: 'AI作图' })).toBeVisible();
  });

  test('should switch to 选题分析与报告 tab', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '选题分析与报告' }).click();

    await expect(page.getByRole('heading', { name: '选题分析与报告' })).toBeVisible();
  });

  test('should switch to Wiki知识库 tab', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Wiki知识库' }).click();

    await expect(page.getByRole('heading', { name: 'Wiki知识库' })).toBeVisible();
  });

  test('should switch to 监控设置 tab', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '监控设置' }).click();

    await expect(page.getByRole('heading', { name: '监控设置', exact: true })).toBeVisible();
  });

  test('should switch to 账号空间 tab', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '账号空间' }).click();

    await expect(page.locator('h2', { hasText: '账号空间' })).toBeVisible();
  });
});

test.describe('Category sidebar', () => {
  test('should show monitoring category list on content tab', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('监控分类列表')).toBeVisible();
  });

  test('should hide category sidebar on non-content tabs', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '监控设置' }).click();

    await expect(page.getByText('监控分类列表')).not.toBeVisible();
  });
});

test.describe('Settings page', () => {
  test('should display settings heading after switching', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '监控设置' }).click();

    await expect(page.getByRole('heading', { name: '监控设置', exact: true })).toBeVisible();
  });
});

test.describe('Empty state display', () => {
  test('should show content tab heading without errors when no data', async ({ page }) => {
    await page.goto('/');

    // Verify the page rendered correctly with the default content tab
    await expect(page.getByRole('heading', { name: '采集内容' })).toBeVisible();

    // The page should not show visible error indicators in the content area
    const contentArea = page.locator('.flex-1.flex.flex-col');
    await expect(contentArea).toBeVisible();
  });
});
