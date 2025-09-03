#!/usr/bin/env node

import WebSocket from 'ws';
import fetch from 'node-fetch';

const CONFIG = {
  TARGET_CONNECTIONS: 45,
  BASE_URL: 'http://localhost:5173',
  WS_URL: 'ws://localhost:5173/ws',
  TEST_BOARD_ID: 'load-test-board',
  ACTIVITY_INTERVAL: 2000, // ms between actions
  TEST_DURATION: 300000, // 5 minutes
};

class LoadTestUser {
  constructor(userId) {
    this.userId = userId;
    this.username = `testuser${userId}`;
    this.ws = null;
    this.sessionCookie = null;
    this.isConnected = false;
    this.cardIds = [];
    this.columnIds = []; // Will be populated from actual board data
  }

  async authenticate() {
    try {
      // Register/login user
      const response = await fetch(`${CONFIG.BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: this.username,
          password: 'testpass123'
        })
      });

      if (response.status === 401) {
        // User doesn't exist, register
        await fetch(`${CONFIG.BASE_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: this.username,
            password: 'testpass123',
            email: `${this.username}@test.com`
          })
        });
      }

      // Extract session cookie
      const cookies = response.headers.get('set-cookie');
      if (cookies) {
        this.sessionCookie = cookies.split(';')[0];
      }

      console.log(`✓ User ${this.userId} authenticated`);
      return true;
    } catch (error) {
      console.error(`✗ User ${this.userId} auth failed:`, error.message);
      return false;
    }
  }

  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      const headers = {};
      if (this.sessionCookie) {
        headers.Cookie = this.sessionCookie;
      }

      this.ws = new WebSocket(CONFIG.WS_URL, { headers });

      this.ws.on('open', () => {
        console.log(`✓ User ${this.userId} WebSocket connected`);
        this.isConnected = true;
        
        // Join the test board
        this.ws.send(JSON.stringify({
          type: 'join_board',
          board_id: CONFIG.TEST_BOARD_ID
        }));
        
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
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
        if (message.card && message.card.user_id !== this.userId) {
          console.log(`User ${this.userId} saw card created by ${message.card.user_id}`);
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
          column_id: randomColumn,
          content: cardContent
        })
      });

      if (response.ok) {
        const card = await response.json();
        this.cardIds.push(card.id);
        console.log(`✓ User ${this.userId} created card ${card.id}`);
      } else {
        console.error(`✗ User ${this.userId} failed to create card: ${response.status}`);
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
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': this.sessionCookie
        },
        body: JSON.stringify({
          column_id: randomColumn,
          position: 0
        })
      });

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
        const board = await response.json();
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
      await testUser.authenticate();
      
      // First check if series exists or create it
      const seriesResponse = await fetch(`${CONFIG.BASE_URL}/api/series`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': testUser.sessionCookie
        },
        body: JSON.stringify({
          name: 'Load Test Series',
          description: 'Series for load testing'
        })
      });

      let seriesId;
      if (seriesResponse.ok) {
        const series = await seriesResponse.json();
        seriesId = series.id;
      } else {
        // Try to get existing series
        const getSeriesResponse = await fetch(`${CONFIG.BASE_URL}/api/series`, {
          headers: { 'Cookie': testUser.sessionCookie }
        });
        if (getSeriesResponse.ok) {
          const seriesList = await getSeriesResponse.json();
          const existingSeries = seriesList.find(s => s.name === 'Load Test Series');
          if (existingSeries) {
            seriesId = existingSeries.id;
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
            name: 'Load Test Board',
            series_id: seriesId
          })
        });

        if (boardResponse.ok) {
          const board = await boardResponse.json();
          CONFIG.TEST_BOARD_ID = board.id;
          // Update column IDs from actual board
          if (board.columns && board.columns.length > 0) {
            this.columnIds = board.columns.map(col => col.id);
          }
          console.log('✓ Test board ready with ID:', CONFIG.TEST_BOARD_ID);
        } else {
          console.log('⚠ Test board setup unclear, proceeding anyway');
        }
      }
    } catch (error) {
      console.log('⚠ Test board setup failed, proceeding anyway:', error.message);
    }
  }

  async spawnUsers() {
    console.log(`\nSpawning ${CONFIG.TARGET_CONNECTIONS} users...`);
    
    for (let i = 1; i <= CONFIG.TARGET_CONNECTIONS; i++) {
      const user = new LoadTestUser(i);
      // Share column IDs with all users
      user.columnIds = this.columnIds;
      
      try {
        await user.authenticate();
        await user.connectWebSocket();
        this.users.push(user);
        this.stats.connected++;
        
        // Start activity simulation for this user
        user.activityInterval = setInterval(() => {
          user.simulateActivity();
        }, CONFIG.ACTIVITY_INTERVAL + (Math.random() * 1000)); // Stagger activities
        
      } catch (error) {
        console.error(`Failed to setup user ${i}:`, error.message);
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