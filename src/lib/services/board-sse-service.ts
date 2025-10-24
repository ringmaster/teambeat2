/**
 * Board SSE Service
 * Manages Server-Sent Events connection and message handling for boards
 */

import { SSEClient } from '$lib/client/sse-client';
import type { BoardStore } from '$lib/stores/board-state.svelte';
import * as boardApi from './board-api';

export type SSEConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error' | 'limit_exceeded';

export interface SSEMessageHandlers {
	onPresencePing?: () => void;
	onRefreshPresence?: (reason: string) => void;
	onLoadPresentModeData?: () => void;
	onReloadAllCards?: () => void;
	onLoadConnectedUsers?: () => void;
	onLoadVotingStats?: () => void;
	onLoadUserVotingData?: () => void;
	onTimerUpdate?: (timerRef: any, data: any) => void;
}

export interface BoardSSEServiceConfig {
	boardId: string;
	boardStore: BoardStore;
	handlers: SSEMessageHandlers;
	maxReconnectAttempts?: number;
	onConnectionStateChange?: (state: SSEConnectionState, errorMessage?: string) => void;
	onClientIdReceived?: (clientId: string) => void;
}

export class BoardSSEService {
	private eventSource: SSEClient | null = null;
	private config: BoardSSEServiceConfig;
	private clientId: string | null = null;
	private reconnectAttempts: number = 0;

	constructor(config: BoardSSEServiceConfig) {
		this.config = config;
	}

	/**
	 * Connect to SSE endpoint
	 */
	connect() {
		this.updateConnectionState('connecting');

		try {
			const sseUrl = `/api/sse`;
			this.eventSource = new SSEClient({
				url: sseUrl,
				method: 'POST',
				body: {
					type: 'sse_connect',
					boardId: this.config.boardId
				},
				reconnectInterval: 3000,
				maxReconnectAttempts: this.config.maxReconnectAttempts || 10
			});

			this.eventSource.onopen = () => {
				console.log('SSE connected');
				this.updateConnectionState('connected');
				this.reconnectAttempts = 0;
			};

			this.eventSource.addEventListener('connected', (event) => {
				try {
					const data = JSON.parse(event.data);
					this.clientId = data.clientId;
					console.log('SSE client ID:', this.clientId);

					if (this.config.onClientIdReceived) {
						this.config.onClientIdReceived(this.clientId);
					}

					// Join the board to receive updates
					if (this.config.boardStore.user) {
						this.joinBoard(this.config.boardStore.user.id);
					}
				} catch (error) {
					console.error('Failed to parse SSE connected message:', error);
				}
			});

			this.eventSource.addEventListener('error', (event) => {
				try {
					const data = JSON.parse(event.data);
					if (data.error === 'Connection limit exceeded') {
						this.updateConnectionState('limit_exceeded', 'Too many connections open. Please close other browser tabs or windows viewing this board, then refresh this page.');
						this.close();
					}
				} catch (error) {
					console.error('Failed to parse SSE error message:', error);
				}
			});

			this.eventSource.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					console.log('SSE message received:', {
						type: data.type,
						board_id: data.board_id,
						timestamp: data.timestamp,
						data: data
					});
					this.handleMessage(data);
				} catch (error) {
					console.error('Failed to parse SSE message:', error);
				}
			};

			this.eventSource.onerror = (error) => {
				console.error('SSE error:', error);

				// Check if this is a connection limit error
				if (error?.message && (error.message.includes('Connection limit exceeded') || error.message.includes('Too many SSE connections'))) {
					this.updateConnectionState('limit_exceeded', 'Too many connections open. Please close other browser tabs or windows viewing this board, then refresh this page.');
					return;
				}

				// For other errors, set error state - the SSE client handles reconnection
				this.updateConnectionState('error');
			};

			this.eventSource.onreconnect = (attempt, maxAttempts) => {
				console.log(`SSE reconnecting: attempt ${attempt}/${maxAttempts}`);
				this.reconnectAttempts = attempt;
				this.updateConnectionState('error');
			};

			this.eventSource.onclose = () => {
				console.log('SSE connection closed');
				// Only called when max reconnection attempts exhausted
				this.updateConnectionState('disconnected');
			};
		} catch (error) {
			console.error('Failed to create SSE connection:', error);
			this.updateConnectionState('error');
		}
	}

	/**
	 * Close the SSE connection
	 */
	close() {
		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}
	}

	/**
	 * Join a board to receive updates
	 */
	async joinBoard(userId: string) {
		if (!this.clientId) return;

		try {
			await fetch('/api/sse', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					action: 'join_board',
					clientId: this.clientId,
					boardId: this.config.boardId,
					userId
				})
			});
		} catch (error) {
			console.error('Failed to join board:', error);
		}
	}

	/**
	 * Send presence update
	 */
	async sendPresenceUpdate(activity: any) {
		if (!this.clientId) return;

		try {
			await fetch('/api/sse', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					action: 'presence_update',
					clientId: this.clientId,
					data: activity
				})
			});
		} catch (error) {
			console.error('Failed to send presence update:', error);
		}
	}

	/**
	 * Get client ID
	 */
	getClientId(): string | null {
		return this.clientId;
	}

	/**
	 * Update connection state and notify listeners
	 */
	private updateConnectionState(state: SSEConnectionState, errorMessage?: string) {
		if (this.config.onConnectionStateChange) {
			this.config.onConnectionStateChange(state, errorMessage);
		}
	}

	/**
	 * Handle incoming SSE message
	 */
	private handleMessage(data: any) {
		const store = this.config.boardStore;

		switch (data.type) {
			case 'presence_ping':
				this.config.handlers.onPresencePing?.();
				break;

			case 'card_created':
				store.addCard(data.card);
				// Sort cards by sequence and creation time
				const sortedCards = [...store.cards].sort((a, b) => {
					const aSeq = a.seq ?? 0;
					const bSeq = b.seq ?? 0;
					if (aSeq !== bSeq) return aSeq - bSeq;
					return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
				});
				store.setCards(sortedCards);
				break;

			case 'card_updated':
				store.updateCard(data.card.id, data.card);
				// Sort after update
				const sortedCardsAfterUpdate = [...store.cards].sort((a, b) => {
					const aSeq = a.seq ?? 0;
					const bSeq = b.seq ?? 0;
					if (aSeq !== bSeq) return aSeq - bSeq;
					return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
				});
				store.setCards(sortedCardsAfterUpdate);
				break;

			case 'card_deleted':
				store.removeCard(data.card_id);
				break;

			case 'scene_changed':
				if (store.board && data.scene) {
					const previousScene = store.currentScene;
					const wasVotingAllowed = previousScene?.allowVoting || false;
					const wereVotesVisible = previousScene?.showVotes || false;

					// Update current scene
					store.setCurrentScene(data.scene);
					store.updateBoard({ currentSceneId: data.scene.id });

					// Update the scene data in the board's scenes array
					if (store.board.scenes) {
						const sceneIndex = store.board.scenes.findIndex((s: any) => s.id === data.scene.id);
						if (sceneIndex !== -1) {
							store.updateScene(data.scene.id, data.scene);
						}
					}

					// Refresh presence if voting-related features changed
					const isVotingNowAllowed = data.scene.allowVoting || false;
					const areVotesNowVisible = data.scene.showVotes || false;

					if ((!wasVotingAllowed && isVotingNowAllowed) || (!wereVotesVisible && areVotesNowVisible)) {
						this.config.handlers.onRefreshPresence?.('voting_enabled');
						this.config.handlers.onLoadUserVotingData?.();
					}

					// Handle mode switching
					if (data.scene.mode === 'present') {
						if (data.present_mode_data) {
							store.setCards(data.present_mode_data.visible_cards);
							if (data.present_mode_data.selected_card) {
								store.updateScene(data.scene.id, { selectedCardId: data.present_mode_data.selected_card.id });
							}
						} else {
							this.config.handlers.onLoadPresentModeData?.();
						}
					} else if (previousScene?.mode === 'present' && data.scene.mode !== 'present') {
						if (data.all_cards) {
							store.setCards(data.all_cards);
						} else {
							this.config.handlers.onReloadAllCards?.();
						}
					}
				}
				break;

			case 'update_presentation':
				if (store.currentScene?.mode === 'present') {
					// Update selected card ID
					if (data.card_id !== undefined) {
						store.updateScene(store.currentScene.id, { selectedCardId: data.card_id });
					}

					// Use present mode data from SSE if available
					if (data.present_mode_data) {
						// Intelligently update cards to preserve object identity
						const newCards = data.present_mode_data.visible_cards;
						const cardMap = new Map(store.cards.map((c) => [c.id, c]));

						const updatedCards = newCards.map((newCard: any) => {
							const existingCard = cardMap.get(newCard.id);
							if (existingCard && JSON.stringify(existingCard) === JSON.stringify(newCard)) {
								return existingCard;
							}
							return newCard;
						});
						store.setCards(updatedCards);

						if (data.present_mode_data.selected_card) {
							store.updateScene(store.currentScene.id, { selectedCardId: data.present_mode_data.selected_card.id });
						}

						// Update notes lock status
						store.setNotesLockStatus(data.present_mode_data.notes_lock);

						// Only update comments/agreements if they changed
						if (data.present_mode_data.comments) {
							const newComments = data.present_mode_data.comments;
							const commentsChanged = store.comments.length !== newComments.length || !store.comments.every((c, i) => c.id === newComments[i]?.id);
							if (commentsChanged) {
								store.setComments(newComments);
							}
						}

						if (data.present_mode_data.agreements) {
							const newAgreements = data.present_mode_data.agreements;
							const agreementsChanged = store.agreements.length !== newAgreements.length || !store.agreements.every((a, i) => a.id === newAgreements[i]?.id);
							if (agreementsChanged) {
								store.setAgreements(newAgreements);
							}
						}
					} else {
						this.config.handlers.onLoadPresentModeData?.();
					}
				}
				break;

			case 'board_updated':
				if (data.board_id === this.config.boardId) {
					const oldBlameFreeMode = store.board?.blameFreeMode;
					store.updateBoard(data.board);

					if (oldBlameFreeMode !== data.board.blameFreeMode) {
						window.dispatchEvent(new CustomEvent('reload_agreements'));
					}
				}
				break;

			case 'columns_updated':
				if (store.board && data.columns) {
					store.updateBoard({ columns: data.columns, allColumns: data.columns });
				}
				break;

			case 'presence_update':
			case 'user_joined':
			case 'user_left':
				if (data.presence_data) {
					store.setConnectedUsers(data.presence_data.connected_users_count);
					store.processVotingData({ voting_stats: data.presence_data.voting_stats });
				} else {
					this.config.handlers.onLoadConnectedUsers?.();
					this.config.handlers.onLoadVotingStats?.();
				}
				break;

			case 'vote_changed':
				// Update card vote count
				if (data.card_id && data.vote_count !== undefined) {
					store.updateCard(data.card_id, { voteCount: data.vote_count });
				}

				// Process voting data
				store.processVotingData({
					votes_by_card: data.user_voting_data?.votes_by_card,
					voting_stats: data.voting_stats
				});
				break;

			case 'voting_stats_updated':
				store.processVotingData({ voting_stats: data.voting_stats });

				// If votes were cleared, reset all votes
				if (data.votes_cleared) {
					store.clearUserVotes();
					store.clearAllVotes();
					const resetCards = store.cards.map((card) => ({ ...card, voteCount: 0 }));
					store.setCards(resetCards);
				}
				break;

			case 'all_votes_updated':
				store.processVotingData({
					all_votes_by_card: data.all_votes_by_card,
					voting_stats: data.voting_stats
				});

				if (data.votes_cleared) {
					store.clearUserVotes();
				}
				break;

			case 'agreements_updated':
				if (data.board_id === this.config.boardId) {
					store.setAgreements(data.agreements || []);
					window.dispatchEvent(new CustomEvent('agreements_updated', {
						detail: data.agreements
					}));
				}
				break;

			case 'scene_updated':
				if (data.scene_id && store.currentScene?.id === data.scene_id && store.currentScene?.mode === 'survey') {
					window.dispatchEvent(new CustomEvent('scene_updated', {
						detail: { sceneId: data.scene_id }
					}));
				}
				break;

			case 'timer_update': {
				const payload = data.data;
				if (payload) {
					store.setPollVotes(payload.votes || {});
					store.setTimerTotalVotes(payload.totalUsers || 0);

					if (this.config.handlers.onTimerUpdate) {
						this.config.handlers.onTimerUpdate(null, payload);
					}

					// Update local board state for consistency
					store.updateBoard({
						timerStart: payload.timer_start,
						timerDuration: payload.timer_passed + payload.timer_remaining
					});
				}
				break;
			}
		}
	}
}

/**
 * Create a board SSE service instance
 */
export function createBoardSSEService(config: BoardSSEServiceConfig): BoardSSEService {
	return new BoardSSEService(config);
}
