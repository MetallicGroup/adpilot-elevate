import { test, expect } from "@playwright/test";

const googleEmail = process.env.E2E_GOOGLE_EMAIL;
const googlePassword = process.env.E2E_GOOGLE_PASSWORD;
const hasGoogleCreds = !!(googleEmail && googlePassword);

test.describe("Auth: Google", () => {
  test("login cu Google → redirect la /onboarding sau /dashboard", async ({
    page,
    context,
  }) => {
    test.skip(
      !hasGoogleCreds,
      "Setează E2E_GOOGLE_EMAIL și E2E_GOOGLE_PASSWORD pentru acest test.",
    );

    await page.goto("/auth");
    await expect(page.getByRole("button", { name: /Continuă cu Google/i })).toBeVisible();

    // Lovable broker deschide un popup cu Google.
    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("button", { name: /Continuă cu Google/i }).click(),
    ]);

    await popup.waitForLoadState("domcontentloaded");

    // Completează formularul Google. AVERTISMENT: Google detectează frecvent
    // automatizarea și blochează login-ul cu "Acces blocat" — dacă asta se
    // întâmplă, testul va face timeout. Folosește un cont DEDICAT pentru teste
    // și marchează-l ca "trust this device" înainte.
    try {
      await popup.getByLabel(/Email|Adresă/i).fill(googleEmail!);
      await popup.getByRole("button", { name: /Next|Înainte|Continuă/i }).click();
      await popup.getByLabel(/Password|Parolă/i).fill(googlePassword!, { timeout: 30_000 });
      await popup.getByRole("button", { name: /Next|Înainte|Continuă/i }).click();
    } catch (err) {
      test.fail(
        true,
        `Google login UI a eșuat — probabil Google a blocat automatizarea sau a schimbat DOM-ul. Original: ${err}`,
      );
    }

    // După popup, pagina principală trebuie să ajungă în app.
    await page.waitForURL(/\/onboarding|\/dashboard/, { timeout: 60_000 });
    expect(page.url()).toMatch(/\/onboarding|\/dashboard/);
  });
});
