import { test, expect } from "@playwright/test";
import {
  publishableClient,
  adminClient,
  uniqueEmail,
  seedCompleteOnboarding,
  deleteUserByEmail,
} from "./helpers/supabase";

const password = "TestParola123!";
const hasServiceRole = !!process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

test.describe("Redirect după login în funcție de onboarding", () => {
  test("user cu onboarding INCOMPLET → /onboarding", async ({ page }) => {
    const email = uniqueEmail("incomplet");
    const sb = publishableClient();
    const { error } = await sb.auth.signUp({ email, password });
    expect(error).toBeNull();

    await page.goto("/auth");
    await page.getByRole("button", { name: /Autentifică-te/i }).click();
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Parolă").fill(password);
    await page.getByRole("button", { name: /Intră în cont/i }).last().click();

    await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
    expect(page.url()).toContain("/onboarding");

    await deleteUserByEmail(email);
  });

  test("user cu onboarding COMPLET → /dashboard", async ({ page }) => {
    test.skip(!hasServiceRole, "Necesită E2E_SUPABASE_SERVICE_ROLE_KEY pentru seed.");

    const email = uniqueEmail("complet");
    const sb = publishableClient();
    const { data, error } = await sb.auth.signUp({ email, password });
    expect(error).toBeNull();
    const userId = data.user?.id;
    expect(userId).toBeTruthy();

    // Seed: Meta connection activă + subscription sandbox trialing
    await seedCompleteOnboarding(userId!);

    await page.goto("/auth");
    await page.getByRole("button", { name: /Autentifică-te/i }).click();
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Parolă").fill(password);
    await page.getByRole("button", { name: /Intră în cont/i }).last().click();

    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    expect(page.url()).toContain("/dashboard");

    // Cleanup: subscriptions + meta_connections + user
    const admin = adminClient();
    await admin.from("subscriptions").delete().eq("user_id", userId!);
    await admin.from("meta_connections").delete().eq("user_id", userId!);
    await deleteUserByEmail(email);
  });

  test("home '/' cu sesiune activă → redirect corect", async ({ page }) => {
    // User incomplet: home ar trebui să te ducă la /onboarding.
    const email = uniqueEmail("home");
    const sb = publishableClient();
    const { error } = await sb.auth.signUp({ email, password });
    expect(error).toBeNull();

    // Log in prin UI ca să setăm sesiunea în localStorage-ul browser-ului.
    await page.goto("/auth");
    await page.getByRole("button", { name: /Autentifică-te/i }).click();
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Parolă").fill(password);
    await page.getByRole("button", { name: /Intră în cont/i }).last().click();
    await page.waitForURL(/\/onboarding|\/dashboard/, { timeout: 30_000 });

    // Acum navigăm la home explicit — index.tsx ar trebui să ne redirecționeze înapoi.
    await page.goto("/");
    await page.waitForURL(/\/onboarding|\/dashboard/, { timeout: 15_000 });
    expect(page.url()).toMatch(/\/onboarding|\/dashboard/);

    await deleteUserByEmail(email);
  });
});
