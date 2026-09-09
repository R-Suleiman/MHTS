import { test, expect } from "@playwright/test";

const password = "A long and memorable test passphrase!";
test("registration, daily tracking, assessment, export, sign out, and sign in", async ({
  page,
}) => {
  const email = `journey-${crypto.randomUUID()}@example.com`;
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/university prototype|explore demo/i),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Preferred name").fill("Sam");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("checkbox", { name: /I am 18/ }).check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sam");
  await page.getByRole("button", { name: "Let’s check in" }).click();
  await page.getByRole("radio", { name: "Good", exact: true }).check();
  await page.getByLabel("Stress level").selectOption("2");
  await page.getByLabel("Energy level").selectOption("4");
  await page.getByLabel("How many hours").fill("7.5");
  await page.getByRole("button", { name: "Save check-in" }).click();
  await expect(
    page.getByRole("button", { name: "Update today’s check-in" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Update today’s check-in" }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Assessments", exact: true })
    .click();
  await page.getByRole("button", { name: "Start my first assessment" }).click();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  for (let i = 0; i < 9; i++) {
    await page
      .getByRole("radio")
      .nth(i < 5 ? 3 : 1)
      .check();
    await page
      .getByRole("button", { name: i === 8 ? "See my results" : "Continue" })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Your results", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".result-grid")).toContainText("60");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "For you", exact: true })
    .click();
  await page.getByRole("button", { name: "Mark as tried" }).first().click();
  await expect(
    page.getByRole("button", { name: "Tried it · undo" }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "My history" })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export history" }).click();
  expect((await download).suggestedFilename()).toMatch(/^mhts-.*json$/);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Your daily rhythm")).toHaveCount(0);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sam");
  await expect(
    page.getByRole("button", { name: "Update today’s check-in" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByText("Delete my account permanently", { exact: true })
    .click();
  await page.getByLabel("Confirm with your password").fill(password);
  await page
    .getByRole("checkbox", { name: /I understand that my account/ })
    .check();
  await page
    .getByRole("button", { name: "Delete account permanently", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
});

test("mobile authentication layout is usable and no demo entry point remains", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/auth-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({
    path: "test-results/auth-desktop.png",
    fullPage: true,
  });
});
