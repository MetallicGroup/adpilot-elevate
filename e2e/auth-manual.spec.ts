import { test, expect } from "@playwright/test";
import { publishableClient, uniqueEmail, deleteUserByEmail } from "./helpers/supabase";

test.describe("Auth: email + parolă", () => {
  const password = "TestParola123!";

  test("register nou → redirect la /onboarding (onboarding incomplet)", async ({ page }) => {
    const email = uniqueEmail("signup");

    await page.goto("/auth");
    await expect(page.getByRole("heading", { name: /Creează cont/i })).toBeVisible();

    await page.getByPlaceholder("Nume complet").fill("E2E Test User");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Parolă").fill(password);
    await page.getByRole("button", { name: /Creează cont/i }).last().click();

    await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
    expect(page.url()).toContain("/onboarding");

    await deleteUserByEmail(email);
  });

  test("login user existent (onboarding incomplet) → /onboarding", async ({ page }) => {
    // Creăm userul prin API-ul Supabase, apoi ne logăm în UI.
    const email = uniqueEmail("signin");
    const sb = publishableClient();
    const { error } = await sb.auth.signUp({ email, password });
    expect(error).toBeNull();

    await page.goto("/auth");
    // Comută la modul "sign in"
    await page.getByRole("button", { name: /Autentifică-te/i }).click();

    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Parolă").fill(password);
    await page.getByRole("button", { name: /Intră în cont/i }).last().click();

    await page.waitForURL(/\/onboarding|\/dashboard/, { timeout: 30_000 });
    expect(page.url()).toMatch(/\/onboarding|\/dashboard/);

    await deleteUserByEmail(email);
  });
});
