#!/usr/bin/env node

import WebSocket from 'ws';
import fetch from 'node-fetch';

const CONFIG = {
  TARGET_CONNECTIONS: 45,
  BASE_URL: 'http://localhost:5173',
  WS_URL: 'ws://localhost:8080',
  TEST_BOARD_ID: 'load-test-board',
  ACTIVITY_INTERVAL: 2000, // ms between actions
  TEST_DURATION: 300000, // 5 minutes
};

class LoadTestUser {
  constructor(userId) {
    this.userId = userId;
    // Add timestamp to make users unique across test runs
    const timestamp = Date.now().toString().slice(-6);
    this.username = `testuser${userId}_${timestamp}`;
    this.ws = null;
    this.sessionCookie = null;
    this.isConnected = false;
    this.cardIds = [];
    this.columnIds = []; // Will be populated from actual board data
  }

  async authenticate() {
    try {
      // Try to register user first (registration will set cookie if successful)
      const registerResponse = await fetch(`${CONFIG.BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `${this.username}@test.com`,
          name: this.username,
          password: 'testpass123'
        })
      });

      console.log(`User ${this.userId} register response status: ${registerResponse.status}`);

      if (registerResponse.ok) {
        // Registration successful, extract session cookie
        const cookies = registerResponse.headers.get('set-cookie');
        if (cookies) {
          this.sessionCookie = cookies.split(';')[0];
        }
        console.log(`✓ User ${this.userId} registered and authenticated`);
        return true;
      } else {
        const registerError = await registerResponse.text();
        console.log(`User ${this.userId} registration failed: ${registerError}`);
        console.log(`Attempting login for existing user...`);
        // User might already exist, try login
        const loginResponse = await fetch(`${CONFIG.BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: `${this.username}@test.com`,
            password: 'testpass123'
          })
        });

        console.log(`User ${this.userId} login response status: ${loginResponse.status}`);

        if (loginResponse.ok) {
          // Login successful, extract session cookie
          const cookies = loginResponse.headers.get('set-cookie');
          if (cookies) {
            this.sessionCookie = cookies.split(';')[0];
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

  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      // Extract session ID from cookie for WebSocket authentication
      let sessionId = null;
      if (this.sessionCookie) {
        const match = this.sessionCookie.match(/session=([^;]+)/);
        if (match) {
          sessionId = match[1];
        }
      }

      const wsUrl = sessionId ? `${CONFIG.WS_URL}?session=${sessionId}` : CONFIG.WS_URL;
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        console.log(`✓ User ${this.userId} WebSocket connected`);
        this.isConnected = true;

        // Join the test board
        this.ws.send(JSON.stringify({
          type: 'join_board',
          board_id: CONFIG.TEST_BOARD_ID,
          user_id: this.username
        }));

        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error(`User ${this.userId} message parse error:`, error.message);
        }
      });

      this.ws.on('close', () => {
        console.log(`✗ User ${this.userId} WebSocket disconnected`);
        this.isConnected = false;
      });

      this.ws.on('error', (error) => {
        console.error(`✗ User ${this.userId} WebSocket error:`, error.message);
        reject(error);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error(`Connection timeout for user ${this.userId}`));
        }
      }, 10000);
    });
  }

  handleMessage(message) {
    switch (message.type) {
      case 'card_created':
        // Track cards created by others
        if (message.card && message.card.userId !== this.username) {
          console.log(`User ${this.userId} saw card created by ${message.card.userId}`);
        }
        break;
      case 'card_moved':
        console.log(`User ${this.userId} saw card moved`);
        break;
      case 'vote_changed':
        console.log(`User ${this.userId} saw vote change on card ${message.card_id}`);
        break;
    }
  }

  async createCard() {
    if (!this.isConnected) return;

    try {
      const randomColumn = this.columnIds[Math.floor(Math.random() * this.columnIds.length)];
      const cardContent = `Test card from user ${this.userId} at ${new Date().toISOString()}`;

      const response = await fetch(`${CONFIG.BASE_URL}/api/boards/${CONFIG.TEST_BOARD_ID}/cards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': this.sessionCookie
        },
        body: JSON.stringify({
          columnId: randomColumn,
          content: cardContent
        })
      });

      console.log(`User ${this.userId} create card response: ${response.status}`);

      if (response.ok) {
        const cardData = await response.json();
        const card = cardData.card || cardData;
        this.cardIds.push(card.id);
        console.log(`✓ User ${this.userId} created card ${card.id}`);
      } else {
        const errorText = await response.text();
        console.error(`✗ User ${this.userId} failed to create card: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error(`✗ User ${this.userId} create card error:`, error.message);
    }
  }

  async moveCard() {
    if (!this.isConnected || this.cardIds.length === 0) return;

    try {
      const randomCardId = this.cardIds[Math.floor(Math.random() * this.cardIds.length)];
      const randomColumn = this.columnIds[Math.floor(Math.random() * this.columnIds.length)];

      const response = await fetch(`${CONFIG.BASE_URL}/api/cards/${randomCardId}/move`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': this.sessionCookie
        },
        body: JSON.stringify({
          columnId: randomColumn
        })
      });

      console.log(`User ${this.userId} move card response: ${response.status}`);

      if (response.ok) {
        console.log(`✓ User ${this.userId} moved card ${randomCardId} to column ${randomColumn}`);
      } else {
        console.error(`✗ User ${this.userId} failed to move card: ${response.status}`);
      }
    } catch (error) {
      console.error(`✗ User ${this.userId} move card error:`, error.message);
    }
  }

  async voteOnRandomCard() {
    if (!this.isConnected) return;

    try {
      // Get current board state to find cards to vote on
      const response = await fetch(`${CONFIG.BASE_URL}/api/boards/${CONFIG.TEST_BOARD_ID}`, {
        headers: { 'Cookie': this.sessionCookie }
      });

      if (response.ok) {
        const boardResponse = await response.json();
        const board = boardResponse.board || boardResponse;
        const allCards = [];

        // Collect all cards from all columns
        if (board.columns) {
          board.columns.forEach(column => {
            if (column.cards) {
              allCards.push(...column.cards);
            }
          });
        }

        if (allCards.length > 0) {
          const randomCard = allCards[Math.floor(Math.random() * allCards.length)];

          const voteResponse = await fetch(`${CONFIG.BASE_URL}/api/cards/${randomCard.id}/vote`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': this.sessionCookie
            },
            body: JSON.stringify({})
          });

          console.log(`User ${this.userId} vote response: ${voteResponse.status}`);

          if (voteResponse.ok) {
            console.log(`✓ User ${this.userId} voted on card ${randomCard.id}`);
          }
        }
      }
    } catch (error) {
      console.error(`✗ User ${this.userId} vote error:`, error.message);
    }
  }

  async simulateActivity() {
    if (!this.isConnected) return;

    const activities = [
      () => this.createCard(),
      () => this.moveCard(),
      () => this.voteOnRandomCard(),
      () => this.updatePresence()
    ];

    // Weight card creation higher for more content
    const weightedActivities = [
      ...Array(3).fill(activities[0]), // 3x card creation
      activities[1], // 1x move card
      activities[2], // 1x vote
      activities[3]  // 1x presence
    ];

    const randomActivity = weightedActivities[Math.floor(Math.random() * weightedActivities.length)];
    await randomActivity();
  }

  async updatePresence() {
    if (!this.isConnected || !this.ws) return;

    try {
      // Send presence update via WebSocket instead of HTTP
      this.ws.send(JSON.stringify({
        type: 'presence_update',
        board_id: CONFIG.TEST_BOARD_ID,
        user_id: this.username,
        activity: `editing_card_${Math.random().toString(36).substr(2, 9)}`
      }));
    } catch (error) {
      console.error(`✗ User ${this.userId} presence update error:`, error.message);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
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
      votes: 0
    };
    this.startTime = Date.now();
    this.columnIds = [];
  }

  async setupTestBoard() {
    console.log('Setting up test board...');

    // Create a test user and board if needed
    try {
      const testUser = new LoadTestUser(0);
      const authResult = await testUser.authenticate();
      if (!authResult) {
        throw new Error('Failed to authenticate test user');
      }

      // Create a unique series name for this test run
      const timestamp = Date.now().toString().slice(-6);
      const seriesName = `Load Test Series ${timestamp}`;

      // First check if series exists or create it
      const seriesResponse = await fetch(`${CONFIG.BASE_URL}/api/series`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': testUser.sessionCookie
        },
        body: JSON.stringify({
          name: seriesName,
          description: 'Series for load testing'
        })
      });

      console.log(`Series creation response: ${seriesResponse.status}`);

      let seriesId;
      if (seriesResponse.ok) {
        const seriesData = await seriesResponse.json();
        seriesId = seriesData.series?.id || seriesData.id;
        console.log(`✓ Created series with ID: ${seriesId}`);
      } else {
        const errorText = await seriesResponse.text();
        console.log(`Series creation error (${seriesResponse.status}): ${errorText}`);
        console.log(`Cookies being sent: ${testUser.sessionCookie}`);
        console.log(`Request body was:`, JSON.stringify({ name: seriesName, description: 'Series for load testing' }));

        // Try to get existing series
        const getSeriesResponse = await fetch(`${CONFIG.BASE_URL}/api/series`, {
          headers: { 'Cookie': testUser.sessionCookie }
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
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': testUser.sessionCookie
          },
          body: JSON.stringify({
            name: `Load Test Board ${timestamp}`,
            seriesId: seriesId
          })
        });

        console.log(`Board creation response: ${boardResponse.status}`);

        if (boardResponse.ok) {
          const boardData = await boardResponse.json();
          const board = boardData.board || boardData;
          console.log(`Created board:`, board.id);
          CONFIG.TEST_BOARD_ID = board.id;

          // Set up board with basic template
          const templateResponse = await fetch(`${CONFIG.BASE_URL}/api/boards/${board.id}/setup-template`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': testUser.sessionCookie
            },
            body: JSON.stringify({
              template: 'basic'
            })
          });

          console.log(`Template setup response: ${templateResponse.status}`);

          if (templateResponse.ok) {
            console.log('✓ Board template setup successful');

            // Get updated board data with columns
            const updatedBoardResponse = await fetch(`${CONFIG.BASE_URL}/api/boards/${board.id}`, {
              headers: { 'Cookie': testUser.sessionCookie }
            });

            console.log(`Updated board fetch response: ${updatedBoardResponse.status}`);

            if (updatedBoardResponse.ok) {
              const updatedBoardData = await updatedBoardResponse.json();
              const updatedBoard = updatedBoardData.board || updatedBoardData;
              if (updatedBoard.columns && updatedBoard.columns.length > 0) {
                this.columnIds = updatedBoard.columns.map(col => col.id);
                console.log(`✓ Found ${this.columnIds.length} columns for testing`);
              } else {
                console.log(`⚠ No columns found in updated board`);
              }
            } else {
              console.log(`⚠ Failed to fetch updated board data`);
            }
          } else {
            console.log(`⚠ Template setup failed`);
          }

          console.log('✓ Test board ready with ID:', CONFIG.TEST_BOARD_ID);
          console.log('✓ Available columns:', this.columnIds.length);
        } else {
          console.log('⚠ Board creation failed, proceeding anyway');
        }
      } else {
        console.log('⚠ No series ID available, cannot create board');
        console.log('⚠ Will attempt to use existing boards or create dummy columns');
        // Set some default column IDs for basic testing if setup fails
        this.columnIds = ['default-col-1', 'default-col-2', 'default-col-3'];
      }
    } catch (error) {
      console.log('⚠ Test board setup failed, proceeding anyway:', error.message);
      console.log('⚠ Error stack:', error.stack);
      // Set some default column IDs for basic testing if setup fails
      this.columnIds = ['default-col-1', 'default-col-2', 'default-col-3'];
    }
  }

  async spawnUsers() {
    console.log(`\nSpawning ${CONFIG.TARGET_CONNECTIONS} users...`);

    for (let i = 1; i <= CONFIG.TARGET_CONNECTIONS; i++) {
      const user = new LoadTestUser(i);
      // Share column IDs with all users
      user.columnIds = this.columnIds;

      try {
        const authSuccess = await user.authenticate();
        if (!authSuccess) {
          console.error(`Failed to authenticate user ${i}`);
          this.stats.errors++;
          continue;
        }

        await user.connectWebSocket();
        this.users.push(user);
        this.stats.connected++;

        // Start activity simulation for this user
        user.activityInterval = setInterval(() => {
          user.simulateActivity();
        }, CONFIG.ACTIVITY_INTERVAL + (Math.random() * 1000)); // Stagger activities

      } catch (error) {
        console.error(`Failed to setup user ${i}:`, error.message);
        console.error(`Error details:`, error);
        this.stats.errors++;
      }

      // Stagger connection attempts
      if (i < CONFIG.TARGET_CONNECTIONS) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`\n✓ Connected ${this.stats.connected}/${CONFIG.TARGET_CONNECTIONS} users`);
    if (this.stats.errors > 0) {
      console.log(`✗ ${this.stats.errors} connection failures`);
    }
  }

  startMonitoring() {
    console.log('\n🔍 Starting monitoring...\n');

    this.monitoringInterval = setInterval(() => {
      const uptime = Math.round((Date.now() - this.startTime) / 1000);
      const activeConnections = this.users.filter(u => u.isConnected).length;

      console.log(`[${uptime}s] Active: ${activeConnections}/${CONFIG.TARGET_CONNECTIONS} | Errors: ${this.stats.errors}`);

    }, 10000); // Every 10 seconds
  }

  async run() {
    console.log('🚀 Starting TeamBeat Load Test');
    console.log(`Target: ${CONFIG.TARGET_CONNECTIONS} concurrent connections`);
    console.log(`Duration: ${CONFIG.TEST_DURATION / 1000}s`);
    console.log(`Activity interval: ${CONFIG.ACTIVITY_INTERVAL}ms\n`);

    await this.setupTestBoard();
    await this.spawnUsers();
    this.startMonitoring();

    // Run for specified duration
    await new Promise(resolve => setTimeout(resolve, CONFIG.TEST_DURATION));

    console.log('\n🏁 Test completed, cleaning up...');
    this.cleanup();
  }

  cleanup() {
    // Stop all intervals
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Disconnect all users
    this.users.forEach(user => {
      if (user.activityInterval) {
        clearInterval(user.activityInterval);
      }
      user.disconnect();
    });

    const duration = Math.round((Date.now() - this.startTime) / 1000);
    console.log(`\n📊 Final Stats:`);
    console.log(`Duration: ${duration}s`);
    console.log(`Peak connections: ${this.stats.connected}`);
    console.log(`Total errors: ${this.stats.errors}`);
    console.log(`Success rate: ${((this.stats.connected / CONFIG.TARGET_CONNECTIONS) * 100).toFixed(1)}%`);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⏹ Interrupted by user, cleaning up...');
  process.exit(0);
});

// Run the load test
const tester = new LoadTester();
tester.run().catch(console.error);
