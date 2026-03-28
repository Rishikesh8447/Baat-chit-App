import { expect, test } from "@playwright/test";

const apiBaseUrl = "http://127.0.0.1:5001/api/test/e2e";

const users = {
  alice: {
    fullName: "Alice QA",
    email: "alice.qa@example.com",
    password: "Password123",
  },
  bob: {
    fullName: "Bob QA",
    email: "bob.qa@example.com",
    password: "Password123",
  },
};

async function resetTestData(request) {
  const response = await request.post(`${apiBaseUrl}/reset`);
  expect(response.ok()).toBeTruthy();
}

async function seedUsers(request, options = {}) {
  const payload = {
    users: [users.alice, users.bob],
    directMessages: options.directMessages || [],
  };

  const response = await request.post(`${apiBaseUrl}/seed`, {
    data: payload,
  });
  expect(response.ok()).toBeTruthy();
}

async function signupViaUi(page, user) {
  await page.goto("/signup");
  await page.getByTestId("signup-fullName").fill(user.fullName);
  await page.getByTestId("signup-email").fill(user.email);
  await page.getByTestId("signup-password").fill(user.password);
  await page.getByTestId("signup-submit").click();
}

async function loginViaUi(page, user) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(user.email);
  await page.getByTestId("login-password").fill(user.password);
  await page.getByTestId("login-submit").click();
}

async function openDirectChat(page, user) {
  await page.getByTestId(`contact-${user.email}`).click();
}

test.describe("chat app critical flows", () => {
  test("signup and login flow", async ({ page, request }) => {
    await resetTestData(request);

    await signupViaUi(page, users.alice);
    await expect(page.getByTestId("logout-button")).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    await page.getByTestId("logout-button").click();
    await expect(page).toHaveURL(/\/login$/);

    await loginViaUi(page, users.alice);
    await expect(page.getByTestId("logout-button")).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("sending and receiving direct messages", async ({ browser, request }) => {
    await resetTestData(request);
    await seedUsers(request);

    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    await loginViaUi(alicePage, users.alice);
    await loginViaUi(bobPage, users.bob);

    await openDirectChat(alicePage, users.bob);
    await openDirectChat(bobPage, users.alice);

    await alicePage.getByTestId("message-input").fill("Hello from Alice");
    await alicePage.getByTestId("send-message").click();

    await expect(alicePage.getByText("Hello from Alice")).toBeVisible();
    await expect(bobPage.getByText("Hello from Alice")).toBeVisible();

    await aliceContext.close();
    await bobContext.close();
  });

  test("pagination loads older messages when scrolling up", async ({ page, request }) => {
    await resetTestData(request);

    const seededMessages = Array.from({ length: 30 }, (_, index) => ({
      senderEmail: index % 2 === 0 ? users.alice.email : users.bob.email,
      receiverEmail: index % 2 === 0 ? users.bob.email : users.alice.email,
      text: `Seed message ${index + 1}`,
      createdAt: new Date(Date.now() - (30 - index) * 60_000).toISOString(),
      updatedAt: new Date(Date.now() - (30 - index) * 60_000).toISOString(),
    }));

    await seedUsers(request, { directMessages: seededMessages });
    await loginViaUi(page, users.alice);
    await openDirectChat(page, users.bob);

    await expect(page.getByText("Seed message 30")).toBeVisible();
    await expect(page.getByText("Seed message 1")).toHaveCount(0);

    const messageList = page.getByTestId("message-list");
    await messageList.evaluate((node) => {
      node.scrollTop = 0;
      node.dispatchEvent(new Event("scroll"));
    });

    await expect(page.getByText("Seed message 1")).toBeVisible();
  });

  test("socket reconnect restores chat state and receives messages sent while offline", async ({ browser, request }) => {
    await resetTestData(request);
    await seedUsers(request);

    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    await loginViaUi(alicePage, users.alice);
    await loginViaUi(bobPage, users.bob);

    await openDirectChat(alicePage, users.bob);
    await openDirectChat(bobPage, users.alice);

    await expect(alicePage.getByTestId("connection-status")).toContainText("Online");

    await aliceContext.setOffline(true);
    await expect(alicePage.getByTestId("connection-status")).toContainText(/Reconnecting|Offline/);

    await bobPage.getByTestId("message-input").fill("Delivered after reconnect");
    await bobPage.getByTestId("send-message").click();
    await expect(bobPage.getByText("Delivered after reconnect")).toBeVisible();

    await aliceContext.setOffline(false);
    await expect(alicePage.getByTestId("connection-status")).toContainText("Online");
    await expect(alicePage.getByText("Delivered after reconnect")).toBeVisible();

    await aliceContext.close();
    await bobContext.close();
  });
});
