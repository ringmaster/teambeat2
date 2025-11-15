import { expect, test } from "@playwright/test";
import { CoreTestHelper } from "./fixtures/core-helpers";
import { TestDatabase } from "./fixtures/test-db";

test.describe("Complete UI Workflow", () => {
  let testDb: TestDatabase;
  let adminUser: { email: string; password: string; name: string; id: string };

  test.beforeAll(async () => {
    // Initialize test database and helper
    testDb = new TestDatabase(process.env.DATABASE_URL);

    // ONLY API CALL: Create admin user via API (not through UI registration)
    const adminEmail = `admin-ui-${Date.now()}@test.com`;
    const adminPassword = "password123";
    const adminName = "UI Test Admin";

    const userId = await testDb.createTestUser(
      adminEmail,
      adminPassword,
      adminName,
    );

    adminUser = {
      email: adminEmail,
      password: adminPassword,
      name: adminName,
      id: userId,
    };
  });

  test("complete UI workflow from login to review", async ({ browser }) => {
    // Increase timeout for this comprehensive test
    test.setTimeout(120000); // 2 minutes

    // Create browser context (will use for login)
    const context = await browser.newContext();
    const page = await context.newPage();

    const sceneDropdown = page.locator(".scene-dropdown-container");
    const seriesName = `UI Test Series ${Date.now()}`;
    const discussSceneMenu = page
      .locator("button")
      .filter({ hasText: /^Discuss$/ });
    const cardForNotes = page.getByLabel("Select Card").nth(0);
    const brainstormSceneMenu = page
      .locator("button")
      .filter({ hasText: /^Brainstorm$/ });

    try {
      // ==========================================
      // STEP 1: Login through UI
      // ==========================================
      await test.step("Login through UI", async () => {
        console.log("Step 1: Login through UI");
        await page.goto("/login");

        // Fill login form
        await page.fill("input#email", adminUser.email);
        await page.fill("input#password", adminUser.password);
        await page.click('button[type="submit"]');

        // Wait for redirect to dashboard
        await page.waitForURL("/");
        await expect(page.locator("h1").first()).toBeVisible();

        console.log("✓ Login successful");
      });

      // ==========================================
      // STEP 2: Create a new series through UI
      // ==========================================
      await test.step("Create new series through UI", async () => {
        console.log("Step 2: Create new series through UI");

        // Look for the "Create New Series" button or input
        const createSeriesButton = page.locator(
          'button:has-text("Create Series"), button:has-text("New Series"), [data-testid="create-series"]',
        );

        // If there's a button, click it to reveal the input
        if (await createSeriesButton.isVisible().catch(() => false)) {
          await createSeriesButton.click();
          await page.waitForTimeout(200);
        }

        // Look for the series name input field
        const seriesInput = page
          .locator(
            'input[placeholder*="series" i], input[placeholder*="name" i], #newSeriesInput, [data-testid="series-name-input"]',
          )
          .first();
        await expect(seriesInput).toBeVisible();

        await seriesInput.fill(seriesName);

        // Submit the form (press Enter or click submit button)
        const submitButton = page
          .locator(
            'button:has-text("Create"), button[type="submit"], [data-testid="submit-series"]',
          )
          .first();

        if (await submitButton.isVisible().catch(() => false)) {
          await submitButton.click();
        } else {
          await seriesInput.press("Enter");
        }

        // Wait for series to appear
        await expect(page.locator(`text=${seriesName}`)).toBeVisible();

        console.log("✓ Series created");
      });

      // ==========================================
      // STEP 3: Create a new board through UI
      // ==========================================

      await test.step("Create new board through UI", async () => {
        console.log("Step 3: Create new board through UI");

        // Find the series card and expand it (series are collapsed by default)
        const seriesCard = page.locator(".series-card", {
          hasText: seriesName,
        });
        await expect(seriesCard).toBeVisible();

        // Check if the board name input is already visible
        const boardNameInputInSeries = seriesCard
          .locator('input[type="text"]')
          .first();
        const isInputVisible = await boardNameInputInSeries
          .isVisible()
          .catch(() => false);

        // Only click the expand button if the input is not visible
        if (!isInputVisible) {
          const expandButton = seriesCard.locator(
            'button[aria-label*="Expand"], .collapse-toggle-icon',
          );
          await expandButton.click();
          await page.waitForTimeout(500);
        }

        // Now ensure the board creation form is visible
        await expect(boardNameInputInSeries).toBeVisible();

        const boardName = `UI Test Board ${Date.now()}`;
        await boardNameInputInSeries.fill(boardName);

        // Submit the board creation form (usually there's a button next to the input)
        const createButton = seriesCard
          .locator(
            'button:has-text("Create"), button[aria-label*="Add"], button[type="submit"]',
          )
          .first();
        await createButton.click();

        // Wait for board to be created and navigate to it
        await page.waitForURL(/\/board\//);

        // Use a quick template to set up the board
        await page
          .getByRole("button", { name: "Quick Setup with Templates" })
          .click();

        await page
          .getByRole("button", { name: "Start, Stop, Continue Focus" })
          .click();

        console.log("✓ Board created, navigated to board");

        // Wait for board to fully load
        await expect(page.locator("h1")).toContainText("Board");

        await expect(
          page.getByRole("heading", { name: "Start, Stop, Continue" }),
        ).toBeVisible();
      });

      // ==========================================
      // STEP 4: Add cards to different columns through UI
      // ==========================================

      await test.step("Add cards through UI", async () => {
        console.log("Step 4: Add cards through UI");

        // Move to the scene with columns if not already there
        await page.getByTestId("next-scene-button").click();

        // Wait for columns to load
        await expect(page.locator(".column").first()).toBeVisible();

        // Add card to first column
        const firstTextarea = page
          .getByRole("region", { name: "Column: Start" })
          .getByPlaceholder("Add a card...");
        await firstTextarea.fill("Implement automated testing");
        await firstTextarea.press("Enter");

        // Wait for card to appear
        await expect(
          page.locator("text=Implement automated testing"),
        ).toBeVisible();

        console.log("✓ First card added");

        // Add card to second column
        const secondTextarea = page
          .getByRole("region", { name: "Column: Stop" })
          .getByPlaceholder("Add a card...");
        await secondTextarea.fill("Manual testing processes");
        await secondTextarea.press("Enter");

        await expect(
          page.locator("text=Manual testing processes"),
        ).toBeVisible();

        console.log("✓ Second card added");

        // Add card to third column
        const thirdTextarea = page
          .getByRole("region", { name: "Column: Continue" })
          .getByPlaceholder("Add a card...");
        await thirdTextarea.fill("Code reviews and pair programming");
        await thirdTextarea.press("Enter");

        await expect(
          page.locator("text=Code reviews and pair programming"),
        ).toBeVisible();

        console.log("✓ Third card added");

        // Add another card to first column for grouping later
        await firstTextarea.fill("Set up CI/CD pipeline");
        await firstTextarea.press("Enter");

        await expect(page.locator("text=Set up CI/CD pipeline")).toBeVisible();

        console.log("✓ Fourth card added");
      });

      // ==========================================
      // STEP 5: Add comment to a card through UI
      // ==========================================
      await test.step("Add comment through UI", async () => {
        console.log("Step 5: Add comment through UI");

        // Commenting is not available in this scene, move to next scene
        await page.getByTestId("next-scene-button").click();

        // Click on the first card menu to open details
        await page
          .getByRole("article", { name: "Card: Implement automated" })
          .getByLabel("Card menu")
          .click();

        // Click on the comment menu
        await page.getByRole("button", { name: "💬 Add Comment" }).click();

        // Look for comment input (could be in modal or sidebar)
        const commentInput = page.getByRole("textbox", {
          name: "Add a comment...",
        });

        // expect comment input to be visible
        await expect(commentInput).toBeVisible();

        await commentInput.fill("This will save us hours each week!");

        // Submit comment
        const commentButton = page.getByRole("button", {
          name: "Submit comment",
        });

        await commentButton.click();

        // Wait for comment to appear
        await expect(
          page.locator("text=This will save us hours each week!"),
        ).toBeVisible();

        console.log("✓ Comment added");

        // Close the card detail view
        const closeButton = page.locator(
          'button:has-text("Close"), [aria-label="Close"], .modal-close',
        );
        if (await closeButton.isVisible().catch(() => false)) {
          await closeButton.click();
          await page.waitForTimeout(300);
        } else {
          // Try clicking outside the modal
          await page.keyboard.press("Escape");
          await page.waitForTimeout(300);
        }
      });

      // ==========================================
      // STEP 6: Add reaction to a card through UI
      // ==========================================
      await test.step("Add reaction through UI", async () => {
        console.log("Step 6: Add reaction through UI");

        await page
          .getByRole("article", { name: "Card: Manual testing processes" })
          .getByLabel("Card menu")
          .click();

        // Expect the heart reaction button to be visible and click it
        // Locate the menu item that has the label "Love"
        const heartReaction = page.getByTitle("Love");
        await expect(heartReaction).toBeVisible();
        await heartReaction.click();

        // Wait for reaction to appear
        // Let's wait for a moment to allow background tasks to process
        await page.waitForTimeout(500);

        const heartReactji = page.getByRole("button", { name: "❤️" });
        await expect(heartReactji).toBeVisible();

        console.log("✓ Reaction added");

        // ==========================================
        // STEP 7: Change scene through UI
        // ==========================================
        console.log("Step 7: Change scene through UI");

        await expect(sceneDropdown).toBeVisible();

        // Click a different scene from dropdown
        await sceneDropdown.hover();
        const prioritizeSceneMenu = page
          .locator("button")
          .filter({ hasText: /^Prioritize$/ });
        prioritizeSceneMenu.waitFor();
        await expect(prioritizeSceneMenu).toBeVisible();
        await prioritizeSceneMenu.click();
        await expect(page.getByText("Prioritize")).toBeVisible();

        // Click a different scene from dropdown
        await sceneDropdown.hover();

        discussSceneMenu.waitFor();
        await expect(discussSceneMenu).toBeVisible();
        await discussSceneMenu.click();
        await expect(page.getByText("Discuss")).toBeVisible();

        console.log("✓ Scene changed via dropdown");
      });

      // ==========================================
      // STEP 8: Vote on cards through UI
      // ==========================================

      await test.step("Vote on cards through UI", async () => {
        console.log("Step 8: Vote on cards through UI");

        // Click a voting scene from dropdown
        await sceneDropdown.hover();
        const prioritizeSceneMenu2 = page
          .locator("button")
          .filter({ hasText: /^Prioritize$/ });
        prioritizeSceneMenu2.waitFor();
        await expect(prioritizeSceneMenu2).toBeVisible();
        await prioritizeSceneMenu2.click();
        await expect(page.getByText("Prioritize")).toBeVisible();

        // Look for vote buttons on first card
        const firstCard = page.getByRole("article", {
          name: "Card: Implement automated",
        });
        const fisrtCardUpvote = firstCard.locator(".vote-arrow-up");

        await fisrtCardUpvote.click();
        await page.waitForTimeout(300);

        const firstCardVoteCount = page
          .getByRole("article", { name: "Card: Implement automated" })
          .getByLabel("Toggle vote for {itemID}");
        await expect(firstCardVoteCount).toHaveText("1");

        console.log("✓ Vote added");

        // Vote on another card
        const secondCard = page.getByRole("article", {
          name: "Card: Manual testing processes",
        });
        const secondCardUpvote = secondCard.locator(".vote-arrow-up");

        await secondCardUpvote.click();
        await page.waitForTimeout(300);

        const secondCardVoteCount = page
          .getByRole("article", { name: "Card: Manual testing processes" })
          .getByLabel("Toggle vote for {itemID}");
        await expect(secondCardVoteCount).toHaveText("1");

        console.log("✓ Second vote added");

        // Downvote the first card
        const firstCardDownvote = firstCard.locator(".vote-arrow-down");

        await firstCardDownvote.click();
        await page.waitForTimeout(300);

        await expect(firstCardVoteCount).toHaveText("0");

        console.log("✓ Vote removed");

        // Click the vote count to toggle a vote on and off
        await firstCardVoteCount.click();
        await page.waitForTimeout(300);
        await expect(firstCardVoteCount).toHaveText("1");

        await firstCardVoteCount.click();
        await page.waitForTimeout(300);
        await expect(firstCardVoteCount).toHaveText("0");

        console.log("✓ Vote toggled via count");
      });

      // ==========================================
      // STEP 9: Group cards through drag and drop
      // ==========================================
      await test.step("Group cards through drag and drop", async () => {
        console.log("Step 9: Group cards through drag and drop");

        // Switch to Brainstorn scene
        await sceneDropdown.hover();
        brainstormSceneMenu.waitFor();
        await expect(brainstormSceneMenu).toBeVisible();
        await brainstormSceneMenu.click();
        await expect(page.getByText("Brainstorm")).toBeVisible();

        // Wait for the .voting-toolbar to disappear
        await page.waitForSelector(".voting-toolbar", { state: "hidden" });

        await page.waitForTimeout(1000);

        // Wait for all Svelte animations to complete
        await page.waitForFunction(() => {
          const elements = document.querySelectorAll(".add-card-section");
          return Array.from(elements).every((element) => {
            const style = window.getComputedStyle(element);
            // Check if transition or animation duration is set to 0 or not applied
            return (
              !style.transitionDuration ||
              style.transitionDuration === "0s" ||
              !style.animationDuration ||
              style.animationDuration === "0s"
            );
          });
        });

        console.log("Voting toolbar is hidden");

        // Find two cards to group
        const sourceCard = page.locator(".card", {
          hasText: "Set up CI/CD pipeline",
        });
        const targetCard = page.locator(".card", {
          hasText: "Implement automated testing",
        });
        await sourceCard.dragTo(targetCard);

        await page.waitForTimeout(500);

        await expect(page.locator(".subordinate-cards")).toBeVisible();

        console.log("✓ Cards grouped");
      });

      // ==========================================
      // STEP 10: Move card to different column through drag and drop
      // ==========================================

      await test.step("Move card to different column", async () => {
        console.log("Step 10: Move card to different column");

        // Find a card and a different column
        const cardToMove = page.getByRole("article", {
          name: "Card: Manual testing processes",
        });
        const targetColumn = page.getByRole("region", {
          name: "Column Continue - Drop zone",
        });

        cardToMove.dragTo(targetColumn);

        await page.waitForTimeout(50);

        await expect(targetColumn).toContainText("Manual testing processes");

        console.log("✓ Card moved to different column");
      });

      // ==========================================
      // STEP 11: Add note to a card through UI
      // ==========================================

      await test.step("Add note to card through UI", async () => {
        console.log("Step 11: Add note to card through UI");

        // Navigate back to Discuss scene
        await sceneDropdown.hover();
        discussSceneMenu.waitFor();
        await discussSceneMenu.click();
        await expect(page.getByText("Discuss")).toBeVisible();

        // Click on a card to open details
        await cardForNotes.click();
        await page.waitForTimeout(500);

        // Look for notes textarea
        const notesTextarea = page.locator(".notes-editor");

        await notesTextarea.fill(
          "Action Item: Set up automated test suite\n- Unit tests\n- Integration tests\n- E2E tests",
        );

        // Save notes
        const saveNotesButton = page.locator('button:has-text("Save")');

        await saveNotesButton.click();
        await page.waitForTimeout(300);

        // Switch to other card and back to verify notes saved
        await page.getByLabel("Select Card").nth(1).click();
        await notesTextarea.waitFor();
        await expect(notesTextarea).toHaveValue("");

        await cardForNotes.click();
        await page.waitForTimeout(500);
        await expect(notesTextarea).toHaveValue(/Action Item/);

        console.log("✓ Notes added");
      });

      // ==========================================
      // STEP 12: Promote comment to agreement through UI
      // ==========================================
      await test.step("Promote comment to agreement through UI", async () => {
        console.log("Step 12: Promote comment to agreement through UI");

        // Click on a card to open details
        await cardForNotes.click();
        page.locator(".card-content-display").waitFor();

        // Create a new comment
        const commentField = page.locator(".comment-input");
        commentField.fill("This is a comment to be promoted");
        await commentField.press("Enter");
        await page.waitForTimeout(500);

        // Promote the comment we just added
        const promotionButton = page.locator(".agreement-toggle", {
          hasText: "Promote",
        });
        await expect(promotionButton).toBeVisible();
        await promotionButton.click();

        // Verify the comment is now an agreement
        const demoteButton = page.locator(".agreement-toggle", {
          hasText: "Demote",
        });
        await expect(demoteButton).toBeVisible();

        console.log("✓ Comment promoted to agreement");
      });

      // ==========================================
      // STEP 13: Copy review to clipboard through UI
      // ==========================================

      await test.step("Copy review to clipboard through UI", async () => {
        console.log("Step 13: Copy review to clipboard through UI");

        // Navigate to review scene
        await sceneDropdown.hover();
        const reviewSceneMenu = page
          .locator("button")
          .filter({ hasText: /^Plan Actions$/ });
        reviewSceneMenu.waitFor();
        await expect(reviewSceneMenu).toBeVisible();
        await reviewSceneMenu.click();
        await expect(page.getByText("Plan Actions")).toBeVisible();

        // Look for copy button
        const copyButton = page.locator("button.copy-action");

        // Grant clipboard permissions
        await context.grantPermissions(["clipboard-read", "clipboard-write"]);

        await copyButton.click();

        // Wait for success notification
        const toastLocator = page.locator(".toast");
        toastLocator.waitFor();
        await expect(toastLocator).toContainText("Copied to clipboard");

        console.log("✓ Review copied to clipboard");
      });

      // ==========================================
      // FINAL VERIFICATION: Verify data persisted
      // ==========================================

      await test.step("Final verification: Check data persistence", async () => {
        console.log("Final verification: Check data persistence");

        // Reload the page
        await page.reload();

        // Verify board is still loaded
        page.locator("h1").waitFor();
        await expect(page.locator("h1")).toContainText("Board");

        // Return to Brainstorm scene to check cards
        await sceneDropdown.hover();
        brainstormSceneMenu.waitFor();
        await brainstormSceneMenu.click();
        await expect(page.getByText("Brainstorm")).toBeVisible();

        // Verify we can see at least one of our cards
        const anyCard = page.locator("text=Implement automated testing");
        await expect(anyCard.first()).toBeVisible();

        console.log("✓ Data persisted after reload");
      });

      console.log("✅ Comprehensive UI workflow test completed successfully");
    } finally {
      await page.close();
      await context.close();
    }
  });
});
