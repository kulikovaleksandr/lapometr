import { test, expect } from "@playwright/test";

test.describe("Полный сценарий приложения", () => {
  test("регистрация → создание питомца → отметка активности → дуэль", async ({ page }) => {
    // Открываем приложение
    await page.goto("/");

    // Проверяем, что отображается экран авторизации
    await expect(page.getByText("Лапометр")).toBeVisible();
    await expect(page.getByRole("button", { name: /демо/i })).toBeVisible();

    // Входим в демо-режим
    await page.getByRole("button", { name: /демо/i }).click();

    // Проверяем, что отображается главный экран с питомцем
    await expect(page.getByText("Булка")).toBeVisible();
    await expect(page.getByText("Кеша")).toBeVisible();

    // Проверяем наличие переключателя питомцев
    await expect(page.locator("select")).toBeVisible();

    // Проверяем наличие быстрых действий
    await expect(page.getByText("Быстрые действия")).toBeVisible();

    // Отмечаем активность
    const feedButton = page.getByRole("button", { name: /покормить/i }).first();
    await feedButton.click();

    // Проверяем, что открылась модалка
    await expect(page.getByText("Отметить активность")).toBeVisible();

    // Подтверждаем отметку
    await page.getByRole("button", { name: /сделано/i }).click();

    // Проверяем, что модалка закрылась
    await expect(page.getByText("Отметить активность")).not.toBeVisible();

    // Переходим в журнал
    await page.getByRole("link", { name: /журнал/i }).click();

    // Проверяем, что отображается журнал
    await expect(page.getByText("Журнал")).toBeVisible();

    // Переходим в дуэль
    await page.getByRole("link", { name: /дуэль/i }).click();

    // Проверяем, что отображается дуэль
    await expect(page.getByText("Дуэль")).toBeVisible();
    await expect(page.getByText("Максим")).toBeVisible();
    await expect(page.getByText("Алина")).toBeVisible();
  });

  test("демо-режим с готовыми данными", async ({ page }) => {
    await page.goto("/");

    // Входим в демо-режим
    await page.getByRole("button", { name: /демо/i }).click();

    // Проверяем наличие двух питомцев
    await expect(page.getByText("Булка")).toBeVisible();
    await expect(page.getByText("Кеша")).toBeVisible();

    // Проверяем наличие двух хозяев
    await expect(page.getByText("Максим")).toBeVisible();
    await expect(page.getByText("Алина")).toBeVisible();

    // Переключаемся между питомцами
    const select = page.locator("select");
    await select.selectOption({ label: /Кеша/i });

    // Проверяем, что отображается информация о Кеше
    await expect(page.getByText("Кеша")).toBeVisible();

    // Переключаемся обратно на Булку
    await select.selectOption({ label: /Булка/i });
    await expect(page.getByText("Булка")).toBeVisible();
  });

  test("навигация между экранами", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /демо/i }).click();

    // Проверяем главный экран
    await expect(page.getByText("Булка")).toBeVisible();

    // Переходим в журнал
    await page.getByRole("link", { name: /журнал/i }).click();
    await expect(page.getByText("Журнал")).toBeVisible();

    // Переходим в дуэль
    await page.getByRole("link", { name: /дуэль/i }).click();
    await expect(page.getByText("Дуэль")).toBeVisible();

    // Переходим в здоровье
    await page.getByRole("link", { name: /здоровье/i }).click();
    await expect(page.getByText("Вет-календарь")).toBeVisible();

    // Переходим в статистику
    await page.getByRole("link", { name: /статистика/i }).click();
    await expect(page.getByText("Статистика")).toBeVisible();

    // Переходим в настройки
    await page.getByRole("link", { name: /настройки/i }).click();
    await expect(page.getByText("Настройки")).toBeVisible();
  });
});
