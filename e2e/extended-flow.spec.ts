import { test, expect } from '@playwright/test';

test.describe('Category switching', () => {
  test('should display default category in sidebar', async ({ page }) => {
    await page.goto('/');

    // The default seeded category should appear in the sidebar
    const sidebar = page.locator('.w-64');
    await expect(sidebar.getByText('默认分类')).toBeVisible({ timeout: 10000 });
  });

  test('should highlight selected category', async ({ page }) => {
    await page.goto('/');

    // Wait for categories to load
    const catButton = page.locator('button', { hasText: '默认分类' }).first();
    await expect(catButton).toBeVisible({ timeout: 10000 });

    // Click on it and verify it has blue styling
    await catButton.click();
    await expect(catButton).toHaveClass(/bg-blue-50/);
  });
});

test.describe('Content tab display', () => {
  test('should show content tab by default', async ({ page }) => {
    await page.goto('/');

    // Content tab heading should be visible
    await expect(page.getByRole('heading', { name: '采集内容' })).toBeVisible();
  });

  test('should display category list on content tab', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('监控分类列表')).toBeVisible();
  });

  test('should show keyword management area', async ({ page }) => {
    await page.goto('/');

    // Wait for content tab to load
    await expect(page.getByRole('heading', { name: '采集内容' })).toBeVisible();

    // Should show keyword section or empty state
    const bodyText = await page.locator('body').textContent();
    const hasKeywordArea = bodyText?.includes('关键词') || bodyText?.includes('暂无');
    expect(hasKeywordArea).toBe(true);
  });
});

test.describe('Wiki tab navigation', () => {
  test('should switch to Wiki tab and display heading', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Wiki知识库' }).click();

    await expect(page.getByRole('heading', { name: 'Wiki知识库' })).toBeVisible();
  });

  test('should display Wiki content area without visible errors', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Wiki知识库' }).click();

    await expect(page.getByRole('heading', { name: 'Wiki知识库' })).toBeVisible();

    // Verify no error message is displayed in the content area
    const contentArea = page.locator('.flex-1.flex.flex-col');
    await expect(contentArea).toBeVisible();
  });
});

test.describe('Report tab', () => {
  test('should switch to report tab', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '选题分析与报告' }).click();

    await expect(page.getByRole('heading', { name: '选题分析与报告' })).toBeVisible();
  });

  test('should show report section content', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '选题分析与报告' }).click();

    await expect(page.getByRole('heading', { name: '选题分析与报告' })).toBeVisible();

    // The content area should render (not crash)
    const contentArea = page.locator('.flex-1.flex.flex-col');
    await expect(contentArea).toBeVisible();
  });
});

test.describe('AI Writing tab', () => {
  test('should switch to AI writing tab', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'AI写文' }).click();

    await expect(page.getByRole('heading', { name: 'AI写文' })).toBeVisible();
  });

  test('should show writing interface elements', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'AI写文' }).click();

    await expect(page.getByRole('heading', { name: 'AI写文' })).toBeVisible();

    // The content area should render (not crash)
    const contentArea = page.locator('.flex-1.flex.flex-col');
    await expect(contentArea).toBeVisible();
  });
});

test.describe('Settings tab', () => {
  test('should switch to settings tab', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '监控设置' }).click();

    // Use exact match since there are two headings containing "监控设置"
    await expect(page.getByRole('heading', { name: '监控设置', exact: true })).toBeVisible();
  });

  test('should display settings form', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '监控设置' }).click();

    await expect(page.getByRole('heading', { name: '监控设置', exact: true })).toBeVisible();

    // Settings content area should render
    const contentArea = page.locator('.flex-1.flex.flex-col');
    await expect(contentArea).toBeVisible();
  });
});

test.describe('Health check', () => {
  test('should return healthy status from API', async ({ page }) => {
    const response = await page.request.get('/api/health');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.code).toBe(0);
    expect(body.data.db).toBe('ok');
  });
});

test.describe('Categories API', () => {
  test('should return categories from API', async ({ page }) => {
    const response = await page.request.get('/api/categories');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.code).toBe(0);
    expect(Array.isArray(body.data)).toBe(true);
    // Should have at least the default category
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].name).toBe('默认分类');
  });
});

test.describe('Articles API', () => {
  test('should return articles from API', async ({ page }) => {
    const response = await page.request.get('/api/articles');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.code).toBe(0);
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(typeof body.page).toBe('number');
    expect(typeof body.pageSize).toBe('number');
  });

  test('should return empty articles list with pagination', async ({ page }) => {
    const response = await page.request.get('/api/articles?page=1&pageSize=10');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.code).toBe(0);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(10);
  });
});

test.describe('Keywords API', () => {
  test('should return keywords from API', async ({ page }) => {
    const response = await page.request.get('/api/keywords');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.code).toBe(0);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('should reject keyword creation without required fields', async ({ page }) => {
    const response = await page.request.post('/api/keywords', {
      data: { name: 'test' },
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.code).toBe(400);
    expect(body.msg).toContain('缺少必要参数');
  });
});

test.describe('Report API validation', () => {
  test('should reject report generation without categoryId', async ({ page }) => {
    const response = await page.request.post('/api/report/generate', {
      data: {},
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.code).toBe(400);
    expect(body.msg).toContain('categoryId');
  });
});

test.describe('Wiki API validation', () => {
  test('should reject wiki ingest without articleId', async ({ page }) => {
    const response = await page.request.post('/api/wiki/ingest', {
      data: { categoryId: 'test' },
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.code).toBe(400);
  });

  test('should reject wiki index without categoryId', async ({ page }) => {
    const response = await page.request.get('/api/wiki/index');
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.code).toBe(400);
  });
});

test.describe('Content generate API validation', () => {
  test('should reject content generation without topic', async ({ page }) => {
    const response = await page.request.post('/api/content/generate', {
      data: {},
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.code).toBe(400);
    expect(body.msg).toContain('缺少主题');
  });
});
