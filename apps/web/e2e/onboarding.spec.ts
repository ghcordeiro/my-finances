import { expect, test } from "@playwright/test";

test.describe.serial("T-TEST-013 onboarding web", () => {
  const password = "e2e-password-9chars";
  let email = "";

  test("cadastro redireciona para shell autenticado", async ({ page }) => {
    email = `e2e_${Date.now()}@example.com`;
    await page.goto("/register");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(password);
    await page.getByLabel("Nome da organização").fill("Org E2E");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByTestId("shell-welcome")).toContainText("Olá");
  });

  test("login com o mesmo usuário", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByTestId("shell-welcome")).toContainText("Olá");
  });

  test("M1-T-009: smoke workspaces e contas após login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await page.locator("aside.mf-sidebar .mf-nav-link[href='/app/workspaces']").click();
    await expect(page.getByRole("heading", { name: "Workspaces" })).toBeVisible();
    await page.getByRole("link", { name: "Contas" }).first().click();
    await expect(page.getByRole("heading", { name: "Contas do workspace" })).toBeVisible();
  });
});
