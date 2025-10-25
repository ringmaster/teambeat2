#!/usr/bin/env node

import { createRequire } from "module";
import fetch from "node-fetch";

const require = createRequire(import.meta.url);
const { EventSource } = require("eventsource");

const CONFIG = {
	TARGET_CONNECTIONS: 45,
	BASE_URL: "http://localhost:5174", // Updated port for new dev server
	TEST_BOARD_ID: "load-test-board",
	ACTIVITY_INTERVAL: 2000, // ms between actions
	TEST_DURATION: 30000, // 5 minutes
};

class LoadTestUser {
	constructor(userId, eventTracker) {
		this.userId = userId;
		// Add timestamp to make users unique across test runs
		const timestamp = Date.now().toString().slice(-6);
		this.username = `testuser${userId}_${timestamp}`;
		this.eventSource = null;
		this.sessionCookie = null;
		this.isConnected = false;
		this.clientId = null;
		this.cardIds = [];
		this.columnIds = []; // Will be populated from actual board data
		this.eventTracker = eventTracker;
	}

	async authenticate() {
		try {
			// Try to register user first (registration will set cookie if successful)
			const registerResponse = await fetch(
				`${CONFIG.BASE_URL}/api/auth/register`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						email: `${this.username}@test.com`,
						name: this.username,
						password: "testpass123",
					}),
				},
			);

			console.log(
				`User ${this.userId} register response status: ${registerResponse.status}`,
			);

			if (registerResponse.ok) {
				// Registration successful, extract session cookie
				const cookies = registerResponse.headers.get("set-cookie");
				if (cookies) {
					this.sessionCookie = cookies.split(";")[0];
				}
				console.log(`✓ User ${this.userId} registered and authenticated`);
				return true;
			} else {
				const registerError = await registerResponse.text();
				console.log(
					`User ${this.userId} registration failed: ${registerError}`,
				);
				console.log(`Attempting login for existing user...`);
				// User might already exist, try login
				const loginResponse = await fetch(`${CONFIG.BASE_URL}/api/auth/login`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						email: `${this.username}@test.com`,
						password: "testpass123",
					}),
				});

				console.log(
					`User ${this.userId} login response status: ${loginResponse.status}`,
				);

				if (loginResponse.ok) {
					// Login successful, extract session cookie
					const cookies = loginResponse.headers.get("set-cookie");
					if (cookies) {
						this.sessionCookie = cookies.split(";")[0];
					}
					console.log(`✓ User ${this.userId} logged in and authenticated`);
					return true;
				} else {
					const loginError = await loginResponse.text();
					console.error(`✗ User ${this.userId} login failed:`, loginError);
					return false;
				}
			}
		} catch (error) {
			console.error(`✗ User ${this.userId} auth failed:`, error.message);
			return false;
		}
	}

	async connectSSE() {
		return new Promise((resolve, reject) => {
			try {
				// Create SSE connection with board ID
				const sseUrl = `${CONFIG.BASE_URL}/api/sse?boardId=${encodeURIComponent(CONFIG.TEST_BOARD_ID)}`;

				// Parse session cookie for headers
				const headers = {};
				if (this.sessionCookie) {
					headers["Cookie"] = this.sessionCookie;
				}

				this.eventSource = new EventSource(sseUrl, { headers });

				this.eventSource.onopen = () => {
					console.log(`✓ User ${this.userId} SSE connected`);
					this.isConnected = true;
				};

				this.eventSource.addEventListener("connected", (event) => {
					try {
						const data = JSON.parse(event.data);
						this.clientId = data.clientId;
						console.log(
							`✓ User ${this.userId} got client ID: ${this.clientId}`,
						);

						// Join the board after getting client ID
						this.joinBoard()
							.then(() => {
								resolve();
							})
							.catch(reject);
					} catch (error) {
						console.error(
							`User ${this.userId} connected event parse error:`,
							error.message,
						);
						reject(error);
					}
				});

				this.eventSource.onmessage = (event) => {
					try {
						const data = JSON.parse(event.data);
						this.handleMessage(data);
					} catch (error) {
						console.error(
							`User ${this.userId} message parse error:`,
							error.message,
						);
					}
				};

				this.eventSource.onerror = (error) => {
					console.error(`✗ User ${this.userId} SSE error:`, error);
					this.isConnected = false;
					reject(error);
				};

				// Timeout after 10 seconds
				setTimeout(() => {
					if (!this.isConnected || !this.clientId) {
						reject(new Error(`Connection timeout for user ${this.userId}`));
					}
				}, 10000);
			} catch (error) {
				console.error(`✗ User ${this.userId} SSE setup error:`, error.message);
				reject(error);
			}
		});
	}

	async joinBoard() {
		if (!this.clientId) {
			throw new Error(`No client ID for user ${this.userId}`);
		}

		try {
			const response = await fetch(`${CONFIG.BASE_URL}/api/sse`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: this.sessionCookie,
				},
				body: JSON.stringify({
					action: "join_board",
					clientId: this.clientId,
					boardId: CONFIG.TEST_BOARD_ID,
					userId: this.username,
				}),
			});

			if (!response.ok) {
				throw new Error(`Join board failed: ${response.status}`);
			}

			console.log(`✓ User ${this.userId} joined board`);
		} catch (error) {
			console.error(`✗ User ${this.userId} join board error:`, error.message);
			throw error;
		}
	}

	handleMessage(message) {
		// Debug: log all incoming SSE messages (except presence updates to reduce noise)
		if (message.type !== "presence_update") {
			console.log(
				`🔔 User ${this.userId} received SSE message:`,
				JSON.stringify(message),
			);
		}

		switch (message.type) {
			case "card_created":
				if (message.card && message.card.id) {
					this.eventTracker.recordEventReceived(
						"card_created",
						message.card.id,
						this.userId,
					);
					// Track the card if it has a group
					if (message.card.groupId) {
						console.log(
							`  📎 Card ${message.card.id} is in group ${message.card.groupId}`,
						);
					}
				} else {
					console.log(
						`⚠️ User ${this.userId} received card_created message without card:`,
						message,
					);
				}
				break;
			case "card_updated":
				if (message.card && message.card.id) {
					this.eventTracker.recordEventReceived(
						"card_moved",
						message.card.id,
						this.userId,
					);
					// Track group changes
					if (message.card.groupId) {
						console.log(
							`  📎 Card ${message.card.id} updated in group ${message.card.groupId}`,
						);
					}
				} else {
					console.log(
						`⚠️ User ${this.userId} received card_updated message without card:`,
						message,
					);
				}
				break;
			case "cards_grouped":
				console.log(
					`📎 Cards grouped: ${message.cardIds?.join(", ")} into group ${message.groupId}`,
				);
				if (message.groupId) {
					this.eventTracker.recordEventReceived(
						"cards_grouped",
						message.groupId,
						this.userId,
					);
				}
				break;
			case "card_grouped_onto":
				console.log(
					`📎 Card ${message.cardId} grouped onto ${message.targetCardId}`,
				);
				if (message.cardId) {
					this.eventTracker.recordEventReceived(
						"card_grouped_onto",
						message.cardId,
						this.userId,
					);
				}
				break;
			case "vote_changed":
				if (message.card_id) {
					this.eventTracker.recordEventReceived(
						"vote_changed",
						message.card_id,
						this.userId,
					);
				} else {
					console.log(
						`⚠️ User ${this.userId} received vote_changed message without card ID:`,
						message,
					);
				}
				break;
			case "user_joined":
				console.log(`👋 User ${message.user_id} joined the board`);
				break;
			case "user_left":
				console.log(`👋 User ${message.user_id} left the board`);
				break;
			case "presence_update":
				// Log less frequently to reduce noise
				if (Math.random() < 0.1) {
					// Only log 10% of presence updates
					console.log(`👤 Presence update from ${message.user_id}`);
				}
				break;
		}
	}

	async createCard() {
		if (!this.isConnected) {
			console.log(
				`⚠️ User ${this.userId} skipping card creation - not connected`,
			);
			return;
		}

		if (this.columnIds.length === 0) {
			console.log(
				`⚠️ User ${this.userId} skipping card creation - no columns available`,
			);
			return;
		}

		try {
			const randomColumn =
				this.columnIds[Math.floor(Math.random() * this.columnIds.length)];
			const cardContent = `Test card from user ${this.userId} at ${new Date().toISOString()}`;

			console.log(
				`🔄 User ${this.userId} attempting to create card in column ${randomColumn}`,
			);
			console.log(
				`🔐 Session cookie: ${this.sessionCookie ? "present" : "missing"}`,
			);

			const response = await fetch(
				`${CONFIG.BASE_URL}/api/boards/${CONFIG.TEST_BOARD_ID}/cards`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Cookie: this.sessionCookie,
					},
					body: JSON.stringify({
						columnId: randomColumn,
						content: cardContent,
					}),
				},
			);

			console.log(
				`User ${this.userId} create card response: ${response.status}`,
			);

			if (response.ok) {
				const cardData = await response.json();
				const card = cardData.card || cardData;
				this.cardIds.push(card.id);
				this.eventTracker.recordEventSent("card_created", card.id, this.userId);
				console.log(`✅ User ${this.userId} created card ${card.id}`);
			} else {
				const errorText = await response.text();
				console.error(
					`❌ User ${this.userId} failed to create card: ${response.status} - ${errorText}`,
				);
				console.error(
					`❌ Request details: Board=${CONFIG.TEST_BOARD_ID}, Column=${randomColumn}, Content length=${cardContent.length}`,
				);

				// If 403, check if session is valid
				if (response.status === 403) {
					const meResponse = await fetch(`${CONFIG.BASE_URL}/api/auth/me`, {
						headers: { Cookie: this.sessionCookie },
					});
					console.error(
						`❌ User ${this.userId} auth check response: ${meResponse.status}`,
					);
				}
			}
		} catch (error) {
			console.error(`❌ User ${this.userId} create card error:`, error.message);
		}
	}

	async moveCard() {
		if (!this.isConnected || this.cardIds.length === 0) {
			console.log(
				`⚠️ User ${this.userId} skipping card move - ${!this.isConnected ? "not connected" : "no cards available"}`,
			);
			return;
		}

		try {
			const randomCardId =
				this.cardIds[Math.floor(Math.random() * this.cardIds.length)];
			const randomColumn =
				this.columnIds[Math.floor(Math.random() * this.columnIds.length)];

			console.log(
				`🔄 User ${this.userId} moving card ${randomCardId} to column ${randomColumn}`,
			);

			const response = await fetch(
				`${CONFIG.BASE_URL}/api/cards/${randomCardId}/move`,
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Cookie: this.sessionCookie,
					},
					body: JSON.stringify({
						columnId: randomColumn,
					}),
				},
			);

			console.log(`User ${this.userId} move card response: ${response.status}`);

			if (response.ok) {
				this.eventTracker.recordEventSent(
					"card_moved",
					randomCardId,
					this.userId,
				);
				console.log(
					`✅ User ${this.userId} moved card ${randomCardId} to column ${randomColumn}`,
				);
			} else {
				const errorText = await response.text();
				console.error(
					`❌ User ${this.userId} failed to move card: ${response.status} - ${errorText}`,
				);
			}
		} catch (error) {
			console.error(`❌ User ${this.userId} move card error:`, error.message);
		}
	}

	async voteOnRandomCard() {
		if (!this.isConnected) {
			console.log(`⚠️ User ${this.userId} skipping vote - not connected`);
			return;
		}

		try {
			// Get current board state to find cards to vote on
			const response = await fetch(
				`${CONFIG.BASE_URL}/api/boards/${CONFIG.TEST_BOARD_ID}`,
				{
					headers: { Cookie: this.sessionCookie },
				},
			);

			if (response.ok) {
				const boardResponse = await response.json();
				const board = boardResponse.board || boardResponse;
				const allCards = [];

				// Collect all cards from all columns
				if (board.columns) {
					board.columns.forEach((column) => {
						if (column.cards) {
							allCards.push(...column.cards);
						}
					});
				}

				if (allCards.length > 0) {
					const randomCard =
						allCards[Math.floor(Math.random() * allCards.length)];
					console.log(`🔄 User ${this.userId} voting on card ${randomCard.id}`);

					const voteResponse = await fetch(
						`${CONFIG.BASE_URL}/api/cards/${randomCard.id}/vote`,
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								Cookie: this.sessionCookie,
							},
							body: JSON.stringify({}),
						},
					);

					console.log(
						`User ${this.userId} vote response: ${voteResponse.status}`,
					);

					if (voteResponse.ok) {
						this.eventTracker.recordEventSent(
							"vote_changed",
							randomCard.id,
							this.userId,
						);
						console.log(
							`✅ User ${this.userId} voted on card ${randomCard.id}`,
						);
					} else {
						const errorText = await voteResponse.text();
						console.error(
							`❌ User ${this.userId} failed to vote: ${voteResponse.status} - ${errorText}`,
						);
					}
				} else {
					console.log(
						`⚠️ User ${this.userId} skipping vote - no cards available`,
					);
				}
			} else {
				const errorText = await response.text();
				console.error(
					`❌ User ${this.userId} failed to fetch board for voting: ${response.status} - ${errorText}`,
				);
			}
		} catch (error) {
			console.error(`❌ User ${this.userId} vote error:`, error.message);
		}
	}

	async simulateActivity() {
		if (!this.isConnected) return;

		const activities = [
			() => this.createCard(),
			() => this.moveCard(),
			() => this.voteOnRandomCard(),
			() => this.updatePresence(),
			() => this.groupRandomCards(),
			() => this.groupCardOntoAnother(),
		];

		// Weight activities for realistic usage
		const weightedActivities = [
			...Array(3).fill(activities[0]), // 3x card creation
			activities[1], // 1x move card
			activities[2], // 1x vote
			activities[3], // 1x presence
			activities[4], // 1x group multiple cards
			activities[5], // 1x group card onto another
		];

		const randomActivity =
			weightedActivities[Math.floor(Math.random() * weightedActivities.length)];
		await randomActivity();
	}

	async groupRandomCards() {
		if (!this.isConnected) {
			console.log(`⚠️ User ${this.userId} skipping group cards - not connected`);
			return;
		}

		try {
			// Get current board state to find cards to group
			const response = await fetch(
				`${CONFIG.BASE_URL}/api/boards/${CONFIG.TEST_BOARD_ID}`,
				{
					headers: { Cookie: this.sessionCookie },
				},
			);

			if (response.ok) {
				const boardResponse = await response.json();
				const board = boardResponse.board || boardResponse;

				// Find cards in the same column that aren't already grouped
				let cardsToGroup = [];
				let targetColumnId = null;

				if (board.columns) {
					for (const column of board.columns) {
						if (column.cards && column.cards.length >= 2) {
							// Find ungrouped cards in this column
							const ungroupedCards = column.cards.filter((c) => !c.groupId);
							if (ungroupedCards.length >= 2) {
								// Select 2-4 random cards to group
								const numCards = Math.min(
									ungroupedCards.length,
									2 + Math.floor(Math.random() * 3),
								);
								cardsToGroup = ungroupedCards.slice(0, numCards);
								targetColumnId = column.id;
								break;
							}
						}
					}
				}

				if (cardsToGroup.length >= 2) {
					const groupId = crypto.randomUUID
						? crypto.randomUUID()
						: `group-${Date.now()}-${Math.random()}`;
					console.log(
						`🔄 User ${this.userId} grouping ${cardsToGroup.length} cards with group ID ${groupId}`,
					);

					const groupResponse = await fetch(
						`${CONFIG.BASE_URL}/api/boards/${CONFIG.TEST_BOARD_ID}/cards/group`,
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								Cookie: this.sessionCookie,
							},
							body: JSON.stringify({
								cardIds: cardsToGroup.map((c) => c.id),
								groupId: groupId,
							}),
						},
					);

					console.log(
						`User ${this.userId} group cards response: ${groupResponse.status}`,
					);

					if (groupResponse.ok) {
						this.eventTracker.recordEventSent(
							"cards_grouped",
							groupId,
							this.userId,
						);
						console.log(
							`✅ User ${this.userId} grouped ${cardsToGroup.length} cards`,
						);
					} else {
						const errorText = await groupResponse.text();
						console.error(
							`❌ User ${this.userId} failed to group cards: ${groupResponse.status} - ${errorText}`,
						);
					}
				} else {
					console.log(
						`⚠️ User ${this.userId} skipping group - not enough ungrouped cards available`,
					);
				}
			} else {
				const errorText = await response.text();
				console.error(
					`❌ User ${this.userId} failed to fetch board for grouping: ${response.status} - ${errorText}`,
				);
			}
		} catch (error) {
			console.error(`❌ User ${this.userId} group cards error:`, error.message);
		}
	}

	async groupCardOntoAnother() {
		if (!this.isConnected || this.cardIds.length === 0) {
			console.log(
				`⚠️ User ${this.userId} skipping group onto - ${!this.isConnected ? "not connected" : "no cards created"}`,
			);
			return;
		}

		try {
			// Get current board state to find a target card
			const response = await fetch(
				`${CONFIG.BASE_URL}/api/boards/${CONFIG.TEST_BOARD_ID}`,
				{
					headers: { Cookie: this.sessionCookie },
				},
			);

			if (response.ok) {
				const boardResponse = await response.json();
				const board = boardResponse.board || boardResponse;
				const allCards = [];

				// Collect all cards from all columns
				if (board.columns) {
					board.columns.forEach((column) => {
						if (column.cards) {
							allCards.push(...column.cards);
						}
					});
				}

				// Find a card we created that's not already grouped
				const ourCard = allCards.find(
					(c) => this.cardIds.includes(c.id) && !c.groupId,
				);

				if (ourCard && allCards.length > 1) {
					// Find another card in the same column to group onto
					const targetCard =
						allCards.find(
							(c) =>
								c.id !== ourCard.id &&
								c.columnId === ourCard.columnId &&
								c.groupId, // Prefer cards that are already grouped
						) ||
						allCards.find(
							(c) => c.id !== ourCard.id && c.columnId === ourCard.columnId,
						);

					if (targetCard) {
						console.log(
							`🔄 User ${this.userId} grouping card ${ourCard.id} onto ${targetCard.id}`,
						);

						const groupResponse = await fetch(
							`${CONFIG.BASE_URL}/api/cards/${ourCard.id}/group-onto`,
							{
								method: "POST",
								headers: {
									"Content-Type": "application/json",
									Cookie: this.sessionCookie,
								},
								body: JSON.stringify({
									targetCardId: targetCard.id,
								}),
							},
						);

						console.log(
							`User ${this.userId} group onto response: ${groupResponse.status}`,
						);

						if (groupResponse.ok) {
							this.eventTracker.recordEventSent(
								"card_grouped_onto",
								ourCard.id,
								this.userId,
							);
							console.log(
								`✅ User ${this.userId} grouped card ${ourCard.id} onto ${targetCard.id}`,
							);
						} else {
							const errorText = await groupResponse.text();
							console.error(
								`❌ User ${this.userId} failed to group card onto: ${groupResponse.status} - ${errorText}`,
							);
						}
					} else {
						console.log(
							`⚠️ User ${this.userId} skipping group onto - no suitable target card found`,
						);
					}
				} else {
					console.log(
						`⚠️ User ${this.userId} skipping group onto - no suitable cards available`,
					);
				}
			} else {
				const errorText = await response.text();
				console.error(
					`❌ User ${this.userId} failed to fetch board for group onto: ${response.status} - ${errorText}`,
				);
			}
		} catch (error) {
			console.error(`❌ User ${this.userId} group onto error:`, error.message);
		}
	}

	async updatePresence() {
		if (!this.isConnected || !this.clientId) return;

		try {
			// Send presence update via SSE POST endpoint
			const response = await fetch(`${CONFIG.BASE_URL}/api/sse`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: this.sessionCookie,
				},
				body: JSON.stringify({
					action: "presence_update",
					clientId: this.clientId,
					data: {
						activity: `editing_card_${Math.random().toString(36).substr(2, 9)}`,
					},
				}),
			});

			if (!response.ok) {
				console.error(
					`✗ User ${this.userId} presence update failed: ${response.status}`,
				);
			}
		} catch (error) {
			console.error(
				`✗ User ${this.userId} presence update error:`,
				error.message,
			);
		}
	}

	disconnect() {
		if (this.eventSource) {
			this.eventSource.close();
		}
		this.isConnected = false;
	}
}

class LoadTester {
	constructor() {
		this.users = [];
		this.stats = {
			connected: 0,
			errors: 0,
			cardsCreated: 0,
			cardsMoved: 0,
			votes: 0,
		};
		this.startTime = Date.now();
		this.columnIds = [];
		this.eventTracker = new EventTracker();
	}

	logDebugInfo() {
		console.log("\n🔍 Debug Information:");
		console.log(`Board ID: ${CONFIG.TEST_BOARD_ID}`);
		console.log(`Column IDs: ${JSON.stringify(this.columnIds)}`);
		console.log(
			`Connected users: ${this.users.filter((u) => u.isConnected).length}`,
		);
		console.log(
			`Active SSE connections: ${this.users.filter((u) => u.eventSource && u.eventSource.readyState === EventSource.OPEN).length}`,
		);
	}

	async testUserPermissions() {
		console.log("\n🔐 Testing user permissions...");

		if (this.users.length === 0) {
			console.log("❌ No users available for permission testing");
			return;
		}

		const testUser = this.users[0];

		// Test auth endpoint
		try {
			const meResponse = await fetch(`${CONFIG.BASE_URL}/api/auth/me`, {
				headers: { Cookie: testUser.sessionCookie },
			});
			console.log(`Auth check response: ${meResponse.status}`);
			if (meResponse.ok) {
				const userData = await meResponse.json();
				console.log(`User data:`, userData);
			}
		} catch (error) {
			console.log(`Auth check error:`, error.message);
		}

		// Test board access
		try {
			const boardResponse = await fetch(
				`${CONFIG.BASE_URL}/api/boards/${CONFIG.TEST_BOARD_ID}`,
				{
					headers: { Cookie: testUser.sessionCookie },
				},
			);
			console.log(`Board access response: ${boardResponse.status}`);
			if (!boardResponse.ok) {
				const errorText = await boardResponse.text();
				console.log(`Board access error:`, errorText);
			}
		} catch (error) {
			console.log(`Board access error:`, error.message);
		}
	}

	async setupTestBoard() {
		console.log("Setting up test board...");
		console.log(`Base URL: ${CONFIG.BASE_URL}`);

		// Create a test user and board if needed
		try {
			const testUser = new LoadTestUser(0);
			const authResult = await testUser.authenticate();
			if (!authResult) {
				throw new Error("Failed to authenticate test user");
			}

			// Create a unique series name for this test run
			const timestamp = Date.now().toString().slice(-6);
			const seriesName = `Load Test Series ${timestamp}`;

			// First check if series exists or create it
			const seriesResponse = await fetch(`${CONFIG.BASE_URL}/api/series`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: testUser.sessionCookie,
				},
				body: JSON.stringify({
					name: seriesName,
					description: "Series for load testing",
				}),
			});

			console.log(`Series creation response: ${seriesResponse.status}`);

			let seriesId;
			if (seriesResponse.ok) {
				const seriesData = await seriesResponse.json();
				seriesId = seriesData.series?.id || seriesData.id;
				console.log(`✓ Created series with ID: ${seriesId}`);
			} else {
				const errorText = await seriesResponse.text();
				console.log(
					`Series creation error (${seriesResponse.status}): ${errorText}`,
				);
				console.log(`Cookies being sent: ${testUser.sessionCookie}`);
				console.log(
					`Request body was:`,
					JSON.stringify({
						name: seriesName,
						description: "Series for load testing",
					}),
				);

				// Try to get existing series
				const getSeriesResponse = await fetch(`${CONFIG.BASE_URL}/api/series`, {
					headers: { Cookie: testUser.sessionCookie },
				});
				console.log(`Get series response: ${getSeriesResponse.status}`);

				if (getSeriesResponse.ok) {
					const seriesListData = await getSeriesResponse.json();
					const seriesList = seriesListData.series || seriesListData;
					// Just use the first available series if creation failed
					if (seriesList && seriesList.length > 0) {
						seriesId = seriesList[0].id;
						console.log(`Using existing series: ${seriesId}`);
					}
				}
			}

			if (seriesId) {
				// Create or ensure test board exists
				const boardResponse = await fetch(`${CONFIG.BASE_URL}/api/boards`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Cookie: testUser.sessionCookie,
					},
					body: JSON.stringify({
						name: `Load Test Board ${timestamp}`,
						seriesId: seriesId,
					}),
				});

				console.log(`Board creation response: ${boardResponse.status}`);

				if (boardResponse.ok) {
					const boardData = await boardResponse.json();
					const board = boardData.board || boardData;
					console.log(`Created board:`, board.id);
					CONFIG.TEST_BOARD_ID = board.id;

					// Set up board with basic template
					const templateResponse = await fetch(
						`${CONFIG.BASE_URL}/api/boards/${board.id}/setup-template`,
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								Cookie: testUser.sessionCookie,
							},
							body: JSON.stringify({
								template: "basic",
							}),
						},
					);

					console.log(`Template setup response: ${templateResponse.status}`);

					if (templateResponse.ok) {
						console.log("✓ Board template setup successful");

						// Set board to active status
						const activateResponse = await fetch(
							`${CONFIG.BASE_URL}/api/boards/${board.id}`,
							{
								method: "PATCH",
								headers: {
									"Content-Type": "application/json",
									Cookie: testUser.sessionCookie,
								},
								body: JSON.stringify({
									status: "active",
								}),
							},
						);

						console.log(
							`Board activation response: ${activateResponse.status}`,
						);

						if (activateResponse.ok) {
							console.log("✓ Board set to active status");
						} else {
							console.log("⚠ Failed to activate board, but continuing anyway");
						}

						// Get updated board data with columns
						const updatedBoardResponse = await fetch(
							`${CONFIG.BASE_URL}/api/boards/${board.id}`,
							{
								headers: { Cookie: testUser.sessionCookie },
							},
						);

						console.log(
							`Updated board fetch response: ${updatedBoardResponse.status}`,
						);

						if (updatedBoardResponse.ok) {
							const updatedBoardData = await updatedBoardResponse.json();
							const updatedBoard = updatedBoardData.board || updatedBoardData;
							if (updatedBoard.columns && updatedBoard.columns.length > 0) {
								this.columnIds = updatedBoard.columns.map((col) => col.id);
								console.log(
									`✓ Found ${this.columnIds.length} columns for testing`,
								);
								console.log(
									`✓ Board status: ${updatedBoard.status || "unknown"}`,
								);

								// Check scene permissions
								const currentScene = updatedBoard.scenes?.find(
									(s) => s.id === updatedBoard.currentSceneId,
								);
								if (currentScene) {
									console.log(
										`✓ Current scene: "${currentScene.title}" (${currentScene.mode})`,
									);
									console.log(
										`  - Can add cards: ${currentScene.allowAddCards ? "Yes" : "No"}`,
									);
									console.log(
										`  - Can move cards: ${currentScene.allowMoveCards ? "Yes" : "No"}`,
									);
									console.log(
										`  - Can vote: ${currentScene.allowVoting ? "Yes" : "No"}`,
									);

									// Update scene to ensure testing permissions if needed
									if (
										!currentScene.allowAddCards ||
										!currentScene.allowMoveCards
									) {
										console.log(
											"⚠ Scene permissions need updating for testing...",
										);
										const updateSceneResponse = await fetch(
											`${CONFIG.BASE_URL}/api/boards/${board.id}/scenes/${currentScene.id}`,
											{
												method: "PATCH",
												headers: {
													"Content-Type": "application/json",
													Cookie: testUser.sessionCookie,
												},
												body: JSON.stringify({
													allowAddCards: true,
													allowEditCards: true,
													allowMoveCards: true,
													allowGroupCards: true,
													allowVoting: true,
												}),
											},
										);

										if (updateSceneResponse.ok) {
											console.log("✓ Scene permissions updated for testing");
										} else {
											console.log(
												"⚠ Failed to update scene permissions, continuing anyway",
											);
										}
									}
								} else {
									console.log("⚠ No current scene found");
								}
							} else {
								console.log(`⚠ No columns found in updated board`);
							}
						} else {
							console.log(`⚠ Failed to fetch updated board data`);
						}
					} else {
						console.log(`⚠ Template setup failed`);
					}

					console.log("✓ Test board ready with ID:", CONFIG.TEST_BOARD_ID);
					console.log("✓ Available columns:", this.columnIds.length);
				} else {
					console.log("⚠ Board creation failed, proceeding anyway");
				}
			} else {
				console.log("⚠ No series ID available, cannot create board");
				console.log(
					"⚠ Will attempt to use existing boards or create dummy columns",
				);
				// Set some default column IDs for basic testing if setup fails
				this.columnIds = ["default-col-1", "default-col-2", "default-col-3"];
			}
		} catch (error) {
			console.log(
				"⚠ Test board setup failed, proceeding anyway:",
				error.message,
			);
			console.log("⚠ Error stack:", error.stack);
			// Set some default column IDs for basic testing if setup fails
			this.columnIds = ["default-col-1", "default-col-2", "default-col-3"];
		}
	}

	async spawnUsers() {
		console.log(`\nSpawning ${CONFIG.TARGET_CONNECTIONS} users...`);

		for (let i = 1; i <= CONFIG.TARGET_CONNECTIONS; i++) {
			const user = new LoadTestUser(i, this.eventTracker);
			// Share column IDs with all users
			user.columnIds = this.columnIds;

			try {
				console.log(`🔄 Setting up user ${i}...`);
				const authSuccess = await user.authenticate();
				if (!authSuccess) {
					console.error(`❌ Failed to authenticate user ${i}`);
					this.stats.errors++;
					continue;
				}

				await user.connectSSE();
				this.users.push(user);
				this.stats.connected++;

				// Start activity simulation for this user
				user.activityInterval = setInterval(
					() => {
						user.simulateActivity();
					},
					CONFIG.ACTIVITY_INTERVAL + Math.random() * 1000,
				); // Stagger activities

				console.log(
					`✅ User ${i} setup complete (${this.stats.connected}/${CONFIG.TARGET_CONNECTIONS})`,
				);
			} catch (error) {
				console.error(`❌ Failed to setup user ${i}:`, error.message);
				console.error(`❌ Error details:`, error);
				this.stats.errors++;
			}

			// Stagger connection attempts
			if (i < CONFIG.TARGET_CONNECTIONS) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}

		console.log(
			`\n✓ Connected ${this.stats.connected}/${CONFIG.TARGET_CONNECTIONS} users`,
		);
		if (this.stats.errors > 0) {
			console.log(`✗ ${this.stats.errors} connection failures`);
		}
	}

	startMonitoring() {
		console.log("\n🔍 Starting monitoring...\n");

		this.monitoringInterval = setInterval(() => {
			const uptime = Math.round((Date.now() - this.startTime) / 1000);
			const activeConnections = this.users.filter((u) => u.isConnected).length;

			console.log(
				`[${uptime}s] Active: ${activeConnections}/${CONFIG.TARGET_CONNECTIONS} | Errors: ${this.stats.errors}`,
			);
		}, 10000); // Every 10 seconds
	}

	async run() {
		console.log("🚀 Starting TeamBeat SSE Load Test");
		console.log(`Target: ${CONFIG.TARGET_CONNECTIONS} concurrent connections`);
		console.log(`Duration: ${CONFIG.TEST_DURATION / 1000}s`);
		console.log(`Activity interval: ${CONFIG.ACTIVITY_INTERVAL}ms\n`);

		await this.setupTestBoard();

		// Display board URL prominently FIRST before spawning users
		const boardUrl = `${CONFIG.BASE_URL}/board/${CONFIG.TEST_BOARD_ID}`;
		console.log("\n");
		console.log("═".repeat(70));
		console.log("═".repeat(70));
		console.log("");
		console.log("   🔗 OPEN THIS URL IN YOUR BROWSER TO WATCH THE TEST:");
		console.log("");
		console.log(`   ${boardUrl}`);
		console.log("");
		console.log("═".repeat(70));
		console.log("═".repeat(70));
		console.log("\n");
		console.log("⏳ Starting user connections in 3 seconds...\n");

		// Give user time to open the URL
		await new Promise((resolve) => setTimeout(resolve, 3000));

		await this.spawnUsers();
		this.logDebugInfo();
		await this.testUserPermissions();
		this.startMonitoring();

		// Run for specified duration
		await new Promise((resolve) => setTimeout(resolve, CONFIG.TEST_DURATION));

		console.log("\n🏁 Test completed, cleaning up...");
		this.cleanup();
	}

	cleanup() {
		// Stop all intervals
		if (this.monitoringInterval) {
			clearInterval(this.monitoringInterval);
		}

		// Disconnect all users
		this.users.forEach((user) => {
			if (user.activityInterval) {
				clearInterval(user.activityInterval);
			}
			user.disconnect();
		});

		const duration = Math.round((Date.now() - this.startTime) / 1000);

		// Generate event tracking report
		const eventReport = this.eventTracker.generateReport(this.stats.connected);

		console.log(`\n📊 Final Stats:`);
		console.log(`Duration: ${duration}s`);
		console.log(`Peak connections: ${this.stats.connected}`);
		console.log(`Total errors: ${this.stats.errors}`);
		console.log(
			`Success rate: ${((this.stats.connected / CONFIG.TARGET_CONNECTIONS) * 100).toFixed(1)}%`,
		);

		console.log(`\n📡 SSE Event Delivery Report:`);
		console.log(`Events sent: ${eventReport.totalSent}`);
		console.log(`Events received: ${eventReport.totalReceived}`);
		console.log(`Overall accuracy: ${eventReport.overallAccuracy.toFixed(1)}%`);

		for (const eventType in eventReport.byType) {
			const typeReport = eventReport.byType[eventType];
			console.log(
				`  ${eventType}: ${typeReport.accuracy.toFixed(1)}% (${typeReport.received}/${typeReport.expected})`,
			);
			if (typeReport.missed > 0) {
				console.log(`    Missed events: ${typeReport.missed}`);
			}
		}
	}
}

// Handle graceful shutdown
process.on("SIGINT", () => {
	console.log("\n\n⏹ Interrupted by user, cleaning up...");
	process.exit(0);
});

class EventTracker {
	constructor() {
		this.sentEvents = new Map(); // eventId -> { type, cardId, userId, timestamp }
		this.receivedEvents = new Map(); // eventId -> Set of userIds who received it
	}

	recordEventSent(eventType, cardId, senderId) {
		const eventId = `${eventType}_${cardId}_${Date.now()}_${senderId}`;
		this.sentEvents.set(eventId, {
			type: eventType,
			cardId,
			senderId,
			timestamp: Date.now(),
		});

		// Initialize received tracking
		this.receivedEvents.set(eventId, new Set());
		return eventId;
	}

	recordEventReceived(eventType, cardId, receiverId) {
		// Find matching sent event (most recent for this card/type combination)
		let matchingEventId = null;
		let latestTimestamp = 0;

		for (const [eventId, eventData] of this.sentEvents) {
			if (
				eventData.type === eventType &&
				eventData.cardId === cardId &&
				eventData.timestamp > latestTimestamp
			) {
				matchingEventId = eventId;
				latestTimestamp = eventData.timestamp;
			}
		}

		if (matchingEventId) {
			this.receivedEvents.get(matchingEventId).add(receiverId);
			console.log(
				`📨 Event received: ${eventType} for card ${cardId} by user ${receiverId} (matched to ${matchingEventId})`,
			);
		} else {
			console.log(
				`⚠️ Unmatched event received: ${eventType} for card ${cardId} by user ${receiverId}`,
			);
		}
	}

	generateReport(totalConnectedUsers) {
		const report = {
			totalSent: this.sentEvents.size,
			totalReceived: 0,
			overallAccuracy: 0,
			byType: {},
		};

		const typeCounts = {};

		for (const [eventId, eventData] of this.sentEvents) {
			const eventType = eventData.type;
			const expectedReceivers = totalConnectedUsers - 1; // All users except sender
			const actualReceivers = this.receivedEvents.get(eventId).size;

			if (!typeCounts[eventType]) {
				typeCounts[eventType] = {
					sent: 0,
					expectedTotal: 0,
					receivedTotal: 0,
				};
			}

			typeCounts[eventType].sent++;
			typeCounts[eventType].expectedTotal += expectedReceivers;
			typeCounts[eventType].receivedTotal += actualReceivers;

			report.totalReceived += actualReceivers;
		}

		// Calculate overall accuracy
		const totalExpected = Object.values(typeCounts).reduce(
			(sum, type) => sum + type.expectedTotal,
			0,
		);
		report.overallAccuracy =
			totalExpected > 0 ? (report.totalReceived / totalExpected) * 100 : 100;

		// Calculate per-type accuracy
		for (const [eventType, counts] of Object.entries(typeCounts)) {
			report.byType[eventType] = {
				sent: counts.sent,
				expected: counts.expectedTotal,
				received: counts.receivedTotal,
				missed: counts.expectedTotal - counts.receivedTotal,
				accuracy:
					counts.expectedTotal > 0
						? (counts.receivedTotal / counts.expectedTotal) * 100
						: 100,
			};
		}

		return report;
	}
}

// Run the load test
const tester = new LoadTester();
tester.run().catch(console.error);
