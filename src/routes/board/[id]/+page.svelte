<script lang="ts">
import { onDestroy, onMount } from "svelte";
import { SvelteMap, SvelteSet } from "svelte/reactivity";
import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import { page } from "$app/stores";
import { SSEClient } from "$lib/client/sse-client.js";
import AgreementsScene from "$lib/components/AgreementsScene.svelte";
import BoardColumns from "$lib/components/BoardColumns.svelte";
import BoardConfigPage from "$lib/components/BoardConfigPage.svelte";
import BoardHeader from "$lib/components/BoardHeader.svelte";
import BoardSetup from "$lib/components/BoardSetup.svelte";
import CommentModal from "$lib/components/CommentModal.svelte";
import HealthSurvey from "$lib/components/HealthSurvey.svelte";
import PollDropdown, {
	type PollConfig,
} from "$lib/components/PollDropdown.svelte";
import PresentMode from "$lib/components/PresentMode.svelte";
import QuadrantScene from "$lib/components/QuadrantScene.svelte";
import ReviewScene from "$lib/components/ReviewScene.svelte";
import ScorecardScene from "$lib/components/ScorecardScene.svelte";
import StaticScene from "$lib/components/StaticScene.svelte";
import Timer from "$lib/components/Timer.svelte";
import Icon from "$lib/components/ui/Icon.svelte";
import Modal from "$lib/components/ui/Modal.svelte";
import * as boardApi from "$lib/services/board-api";
import { toastStore } from "$lib/stores/toast";
import { evaluateDisplayRule } from "$lib/utils/display-rule-context";
import { getSceneCapability } from "$lib/utils/scene-capability";

interface Props {
	data: {
		board: any;
		cards: any[];
		agreements: any[];
		templates: any[];
		user: any;
		userRole: string;
		lastHealthCheckDate: string | null;
		scorecardCountsByScene: Record<string, number>;
		pageTitle: string;
		description: string;
	};
}

interface VotingData {
	votes_by_card?: Record<string, number>;
	all_votes_by_card?: Record<string, number>;
	voting_stats?: {
		totalUsers: number;
		activeUsers: number;
		usersWhoVoted: number;
		usersWhoHaventVoted: number;
		totalVotesCast: number;
		maxPossibleVotes: number;
		remainingVotes: number;
		maxVotesPerUser: number;
	};
}

const { data }: Props = $props();

let board: any = $state(data.board);
let cards: any[] = $state(data.cards);
let user: any = $state(data.user);
let userRole = $state(data.userRole);
let notesLockStatus = $state(null);
let loading = $state(false);
let eventSource: SSEClient | null = null;
let boardId = $state("");
let clientId = $state("");

// SSE Connection Health Monitoring
let sseConnectionState = $state<
	"connecting" | "connected" | "disconnected" | "error" | "limit_exceeded"
>("disconnected");
let sseReconnectAttempts = $state(0);
let sseMaxReconnectAttempts = $state(10);
let sseErrorMessage = $state<string | null>(null);

// UI State
let newCardContentByColumn = new SvelteMap<string, string>();
let showSceneDropdown = $state(false);
let showBoardConfig = $state(false);
let showTemplateSelector = $state(false);

// Edit Card Modal State
let showEditCardModal = $state(false);
let editingCard = $state<any>(null);
let editCardContent = $state("");

// Comment Modal State
let showCommentModal = $state(false);
let commentingCard = $state<any>(null);

// Drag and Drop State
let draggedCardId = $state("");
let draggedSceneId = $state("");
let draggedColumnId = $state("");
let dragOverSceneId = $state("");
let sceneDropPosition = $state("");
let dragOverSceneEnd = $state(false);
let dragOverColumnId = $state("");
let columnDropPosition = $state("");
let dragOverColumnEnd = $state(false);
let cardDropTargetColumnId = $state("");
let dragOverCardId = $state("");
let cardDropPosition = $state(""); // "above" or "below"
let cardSequenceDropIndex = $state<number | null>(null);

// Grouping State
let groupingMode = $state(false);
let selectedCards = new SvelteSet<string>();

// Voting State
let votingAllocation = $state<{
	currentVotes: number;
	maxVotes: number;
	remainingVotes: number;
	canVote: boolean;
} | null>(null);
let userVotesByCard = new SvelteMap<string, number>(); // cardId -> user votes on that card
let allVotesByCard = new SvelteMap<string, number>(); // cardId -> total votes on that card (when votes visible)

// Voting toolbar state
let connectedUsers = $state(0);
let votingStats = $state<{
	totalUsers: number;
	usersWhoVoted: number;
	usersWhoHaventVoted: number;
	totalVotesCast: number;
	maxPossibleVotes: number;
	remainingVotes: number;
	maxVotesPerUser: number;
	activeUsers: number;
} | null>(null);

// Comment state for present mode
let comments = $state<any[]>([]);
let agreements = $state<any[]>(data.agreements);
let lastHealthCheckDate = $state<string | null>(data.lastHealthCheckDate);
let scorecardCountsByScene = $state<Record<string, number>>(
	data.scorecardCountsByScene || {},
);

// Poll/Timer state
let showPollDropdown = $state(false);
let timerVisible = $state(false);
let hasActiveTimer = $derived(
	board?.timerStart && board?.timerDuration ? true : false,
);
let timerRef: any = $state(null);
let pollType = $state<PollConfig["type"]>("timer");
let pollQuestion = $state("");
let pollChoices = $state<string[]>([]);
let pollVotes = $state<Record<string, number>>({});
let timerTotalVotes = $state(0);
let pendingTimerInit = $state<{
	remaining: number;
	elapsed: number;
} | null>(null);

// Calculate if user has votes available (same value for all cards on the board)
let hasVotes = $derived(votingAllocation?.canVote ?? false);

// Load user voting data when board and user are ready
$effect(() => {
	if (boardId && user?.id && !loading) {
		loadUserVotingData();
	}
});

// Initialize timer when component is ready
$effect(() => {
	// If we have a pending timer initialization and the timer ref is now available, initialize it
	if (pendingTimerInit && timerRef) {
		timerRef.setTimer(pendingTimerInit.remaining, pendingTimerInit.elapsed);
		pendingTimerInit = null;
	}
});

// Templates
let templates: any[] = $state(data.templates);

onMount(async () => {
	boardId = $page.params.id!;

	try {
		// Set current scene if available, checking display rules
		// Scenes are already loaded in board.scenes from server
		if (board.currentSceneId && board.scenes) {
			const requestedScene = board.scenes.find(
				(s: any) => s.id === board.currentSceneId,
			);

			// Check if the current scene should be displayed
			if (
				requestedScene &&
				evaluateDisplayRule(
					requestedScene,
					board,
					cards,
					agreements,
					lastHealthCheckDate,
					scorecardCountsByScene,
				)
			) {
				currentScene = requestedScene;
			} else {
				// Find the first valid scene
				for (const scene of board.scenes) {
					if (
						evaluateDisplayRule(
							scene,
							board,
							cards,
							agreements,
							lastHealthCheckDate,
							scorecardCountsByScene,
						)
					) {
						currentScene = scene;
						// Update the board's current scene
						await boardApi.changeScene(boardId, scene.id);
						break;
					}
				}
			}
		}

		// Ensure board.columns contains all columns for proper client-side filtering
		if (board.allColumns) {
			board.columns = board.allColumns;
		}

		// Load cards based on the current scene mode
		if (currentScene?.mode === "present") {
			// For Present mode, reload with filtered/sorted cards
			await loadPresentModeData();
		}

		// Initialize timer from board data if active
		if (board.timerStart && board.timerDuration) {
			const start = new Date(board.timerStart).getTime();
			const now = Date.now();
			const elapsed = Math.floor((now - start) / 1000);
			const remaining = Math.max(0, board.timerDuration - elapsed);

			if (remaining > 0) {
				timerVisible = true;
				// Store the timer init data to be used when the Timer component is ready
				pendingTimerInit = { remaining, elapsed };
			}
		}

		// Set up SSE connection
		setupSSE();
	} catch (error) {
		console.error("Error loading board:", error);
	}
});

onDestroy(() => {
	if (eventSource) {
		eventSource.close();
	}
});

function setupSSE() {
	// Set connecting state
	sseConnectionState = "connecting";

	try {
		// Create SSE connection using POST request
		const sseUrl = `/api/sse`;
		eventSource = new SSEClient({
			url: sseUrl,
			method: "POST",
			body: {
				type: "sse_connect",
				boardId: boardId,
			},
			reconnectInterval: 3000,
			maxReconnectAttempts: sseMaxReconnectAttempts,
		});

		eventSource.onopen = () => {
			console.log("SSE connected");
			sseConnectionState = "connected";
			sseReconnectAttempts = 0;
		};

		eventSource.addEventListener("connected", (event) => {
			try {
				const data = JSON.parse(event.data);
				clientId = data.clientId;
				console.log("SSE client ID:", clientId);

				// Join the board to receive updates
				if (user) {
					joinBoard(boardId, user.id);
				}
			} catch (error) {
				console.error("Failed to parse SSE connected message:", error);
			}
		});

		eventSource.addEventListener("error", (event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.error === "Connection limit exceeded") {
					sseConnectionState = "limit_exceeded";
					sseErrorMessage =
						"Too many connections open. Please close other browser tabs or windows viewing this board, then refresh this page.";
					// Don't attempt reconnection for limit exceeded errors
					if (eventSource) {
						eventSource.close();
						eventSource = null;
					}
				}
			} catch (error) {
				console.error("Failed to parse SSE error message:", error);
			}
		});

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				console.log("SSE message received:", {
					type: data.type,
					board_id: data.board_id,
					timestamp: data.timestamp,
					data: data,
				});
				handleSSEMessage(data);
			} catch (error) {
				console.error("Failed to parse SSE message:", error);
			}
		};

		eventSource.onerror = (error) => {
			console.error("SSE error:", error);

			// Check if this is a connection limit error
			if (
				error?.message &&
				(error.message.includes("Connection limit exceeded") ||
					error.message.includes("Too many SSE connections"))
			) {
				sseConnectionState = "limit_exceeded";
				sseErrorMessage =
					"Too many connections open. Please close other browser tabs or windows viewing this board, then refresh this page.";
				return;
			}

			// For other errors, set error state - the SSE client handles reconnection
			sseConnectionState = "error";
		};

		eventSource.onreconnect = (attempt, maxAttempts) => {
			console.log(`SSE reconnecting: attempt ${attempt}/${maxAttempts}`);
			sseReconnectAttempts = attempt;
			sseMaxReconnectAttempts = maxAttempts;
			sseConnectionState = "error";
		};

		eventSource.onclose = () => {
			console.log("SSE connection closed");
			// Only called when max reconnection attempts exhausted
			sseConnectionState = "disconnected";
		};
	} catch (error) {
		console.error("Failed to create SSE connection:", error);
		sseConnectionState = "error";
	}
}

async function joinBoard(boardId: string, userId: string) {
	if (!clientId) return;

	try {
		await fetch("/api/sse", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				action: "join_board",
				clientId,
				boardId,
				userId,
			}),
		});
	} catch (error) {
		console.error("Failed to join board:", error);
	}
}

async function sendPresenceUpdate(activity: any) {
	if (!clientId) return;

	try {
		await fetch("/api/sse", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				action: "presence_update",
				clientId,
				data: activity,
			}),
		});
	} catch (error) {
		console.error("Failed to send presence update:", error);
	}
}

async function handlePresencePing() {
	try {
		await fetch(`/api/boards/${boardId}/presence`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ activity: "pong" }),
		});
	} catch (error) {
		console.error("Failed to update presence:", error);
	}
}

async function refreshPresence(reason = "scene_change") {
	if (!boardId || !user?.id) return;

	try {
		await fetch(`/api/boards/${boardId}/presence`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				activity: `presence_refresh_${reason}`,
			}),
		});
	} catch (error) {
		console.error("Failed to refresh presence:", error);
	}
}

function processVotingData(data: VotingData) {
	// Update user votes by card map if provided
	if (data.votes_by_card) {
		userVotesByCard.clear();
		Object.entries(data.votes_by_card).forEach(([cardId, count]) => {
			userVotesByCard.set(cardId, count as number);
		});
	}

	// Update all users' votes by card map if provided
	if (data.all_votes_by_card) {
		allVotesByCard.clear();
		Object.entries(data.all_votes_by_card).forEach(([cardId, count]) => {
			allVotesByCard.set(cardId, count as number);
		});

		// Also update the cards array with the new vote counts
		cards = cards.map((card) => ({
			...card,
			voteCount: data.all_votes_by_card![card.id] || 0,
		}));
	}

	// Update voting stats if provided
	if (data.voting_stats) {
		votingStats = data.voting_stats;

		// Derive user allocation from voting stats and user votes
		// Calculate current votes from either new data or existing userVotesByCard
		let currentVotes = 0;
		if (data.votes_by_card) {
			currentVotes = Object.values(data.votes_by_card).reduce(
				(sum, count) => sum + count,
				0,
			);
		} else {
			// Use existing userVotesByCard when votes_by_card not provided
			currentVotes = Array.from(userVotesByCard.values()).reduce(
				(sum, count) => sum + count,
				0,
			);
		}

		const maxVotes = data.voting_stats.maxVotesPerUser;
		const remainingVotes = Math.max(0, maxVotes - currentVotes);

		votingAllocation = {
			currentVotes,
			maxVotes,
			remainingVotes,
			canVote: remainingVotes > 0,
		};
	}

	// Voting stats now include presence data (activeUsers)
	if (data.voting_stats) {
		console.log(
			"Voting stats include active users:",
			data.voting_stats.activeUsers,
		);
	}
}

function handleSSEMessage(data: any) {
	console.log("Handling SSE Message", data);
	switch (data.type) {
		case "presence_ping":
			// Respond to ping by updating presence
			handlePresencePing();
			break;
		case "card_created":
			cards = [...cards, data.card].sort((a, b) => {
				// Sort by seq first (ascending: 0, 1, 2, 3...)
				const aSeq = a.seq ?? 0;
				const bSeq = b.seq ?? 0;
				if (aSeq !== bSeq) return aSeq - bSeq;
				// Then by createdAt
				return (
					new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
				);
			});
			break;
		case "card_updated":
			cards = cards
				.map((c) => (c.id === data.card.id ? data.card : c))
				.sort((a, b) => {
					// Sort by seq first (ascending: 0, 1, 2, 3...)
					const aSeq = a.seq ?? 0;
					const bSeq = b.seq ?? 0;
					if (aSeq !== bSeq) return aSeq - bSeq;
					// Then by createdAt
					return (
						new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
					);
				});
			break;
		case "card_deleted":
			cards = cards.filter((c) => c.id !== data.card_id);
			break;
		case "scene_changed":
			if (board && data.scene) {
				// Store previous scene voting and display state
				const previousScene = currentScene;
				const wasVotingAllowed = previousScene?.allowVoting || false;
				const wereVotesVisible = previousScene?.showVotes || false;

				// Update current scene BEFORE checking mode
				currentScene = data.scene;
				board.currentSceneId = data.scene.id;

				// Update the scene data in the board's scenes array if it exists
				if (board.scenes) {
					const sceneIndex = board.scenes.findIndex(
						(s: any) => s.id === data.scene.id,
					);
					if (sceneIndex !== -1) {
						board.scenes[sceneIndex] = data.scene;
					}
				}

				// Refresh presence if any voting-related feature changed
				const isVotingNowAllowed = data.scene.allowVoting || false;
				const areVotesNowVisible = data.scene.showVotes || false;

				if (
					(!wasVotingAllowed && isVotingNowAllowed) ||
					(!wereVotesVisible && areVotesNowVisible)
				) {
					refreshPresence("voting_enabled");
					loadUserVotingData();
				}
				// Handle mode switching logic
				if (data.scene.mode === "present") {
					// Switching to present mode - check if data included in SSE
					if (data.present_mode_data) {
						cards = data.present_mode_data.visible_cards;
						if (data.present_mode_data.selected_card) {
							currentScene.selectedCardId =
								data.present_mode_data.selected_card.id;
						}
					} else {
						loadPresentModeData();
					}
				} else if (
					previousScene?.mode === "present" &&
					data.scene.mode !== "present"
				) {
					// Switching from present mode to another mode
					if (data.all_cards) {
						cards = data.all_cards;
					} else {
						reloadAllCards();
					}
				}
			}
			break;
		case "quadrant_results_calculated":
			// Update cards with consensus metadata
			if (data.card_positions && Array.isArray(data.card_positions)) {
				cards = cards.map((card) => {
					const position = data.card_positions.find((p: any) => p.card_id === card.id);
					if (position) {
						// Build metadata for this card
						const newMetadata = {
							scene_id: data.scene_id,
							consensus_x: position.consensus_x,
							consensus_y: position.consensus_y,
							facilitator_x: position.facilitator_x,
							facilitator_y: position.facilitator_y,
							mode_quadrant: position.mode_quadrant,
							quadrant_label: position.quadrant_label,
							participant_count: position.participant_count,
							std_dev: position.std_dev,
							consensus_score: position.consensus_score,
							spread: position.spread,
							timestamp: new Date().toISOString(),
						};

						// Parse existing metadata or create new array
						const existingMetadata = card.quadrantMetadata
							? JSON.parse(card.quadrantMetadata)
							: [];

						// Replace or add metadata for this scene
						const updatedMetadata = existingMetadata.filter(
							(m: any) => m.scene_id !== data.scene_id,
						);
						updatedMetadata.push(newMetadata);

						return {
							...card,
							quadrantMetadata: JSON.stringify(updatedMetadata),
						};
					}
					return card;
				});
			}
			break;
		case "quadrant_facilitator_position_updated":
			// Update facilitator-adjusted position for a card
			if (data.card_id && data.scene_id) {
				cards = cards.map((card) => {
					if (card.id === data.card_id) {
						// Parse existing metadata
						const existingMetadata = card.quadrantMetadata
							? JSON.parse(card.quadrantMetadata)
							: [];

						// Find and update metadata for this scene
						const metadataForScene = existingMetadata.find(
							(m: any) => m.scene_id === data.scene_id,
						);

						if (metadataForScene) {
							metadataForScene.facilitator_x = data.facilitator_x;
							metadataForScene.facilitator_y = data.facilitator_y;

							return {
								...card,
								quadrantMetadata: JSON.stringify(existingMetadata),
							};
						}
					}
					return card;
				});
			}
			break;
		case "update_presentation":
			if (currentScene?.mode === "present") {
				// Update the selected card ID if provided
				if (data.card_id !== undefined) {
					currentScene.selectedCardId = data.card_id;
				}

				// Use present mode data from SSE if available
				if (data.present_mode_data) {
					// Intelligently update cards to preserve object identity where possible
					// This prevents unnecessary re-renders and flashing
					const newCards = data.present_mode_data.visible_cards;
					const cardMap = new Map(cards.map((c) => [c.id, c]));

					cards = newCards.map((newCard) => {
						const existingCard = cardMap.get(newCard.id);
						// If card exists and its data hasn't changed, preserve the object reference
						if (
							existingCard &&
							JSON.stringify(existingCard) === JSON.stringify(newCard)
						) {
							return existingCard;
						}
						return newCard;
					});

					if (data.present_mode_data.selected_card) {
						currentScene.selectedCardId =
							data.present_mode_data.selected_card.id;
					}
					// Update notes lock status
					notesLockStatus = data.present_mode_data.notes_lock;

					// Only update comments/agreements if they actually changed
					// This prevents the flash when content is the same
					if (data.present_mode_data.comments) {
						const newComments = data.present_mode_data.comments;
						const commentsChanged =
							comments.length !== newComments.length ||
							!comments.every((c, i) => c.id === newComments[i]?.id);

						if (commentsChanged) {
							comments = newComments;
						}
					}
					if (data.present_mode_data.agreements) {
						const newAgreements = data.present_mode_data.agreements;
						const agreementsChanged =
							agreements.length !== newAgreements.length ||
							!agreements.every((a, i) => a.id === newAgreements[i]?.id);

						if (agreementsChanged) {
							agreements = newAgreements;
						}
					}
				} else {
					loadPresentModeData();
				}
			}
			break;
		case "board_updated":
			if (data.board_id === boardId) {
				const newBoardData = data.board;
				const oldBlameFreeMode = board.blameFreeMode;

				board = { ...board, ...newBoardData };

				if (oldBlameFreeMode !== newBoardData.blameFreeMode) {
					window.dispatchEvent(new CustomEvent("reload_agreements"));
				}
			}
			break;
		case "columns_updated":
			if (board && data.columns) {
				// Update both columns and allColumns with the complete set from server
				board.columns = data.columns;
				board.allColumns = data.columns;
			}
			break;

		case "presence_update":
			if (data.presence_data) {
				connectedUsers = data.presence_data.connected_users_count;
				processVotingData({
					voting_stats: data.presence_data.voting_stats,
				});
			} else {
				loadConnectedUsers();
				loadVotingStats();
			}
			break;
		case "user_joined":
			if (data.presence_data) {
				connectedUsers = data.presence_data.connected_users_count;
				processVotingData({
					voting_stats: data.presence_data.voting_stats,
				});
			} else {
				loadConnectedUsers();
				loadVotingStats();
			}
			break;
		case "user_left":
			if (data.presence_data) {
				connectedUsers = data.presence_data.connected_users_count;
				processVotingData({
					voting_stats: data.presence_data.voting_stats,
				});
			} else {
				loadConnectedUsers();
				loadVotingStats();
			}
			break;
		case "vote_changed":
			// Update card vote count when votes change
			if (data.card_id && data.vote_count !== undefined) {
				cards = cards.map((c) =>
					c.id === data.card_id ? { ...c, voteCount: data.vote_count } : c,
				);
			}

			// Process voting data using reusable function
			{
				const votingProcessData: VotingData = {
					votes_by_card: data.user_voting_data?.votes_by_card,
					voting_stats: data.voting_stats,
				};
				processVotingData(votingProcessData);
			}
			break;
		case "voting_stats_updated":
			// Process voting stats using reusable function
			processVotingData({
				voting_stats: data.voting_stats,
			});

			// If votes were cleared, clear the user's own votes
			if (data.votes_cleared) {
				userVotesByCard.clear();
				// Also reset all card vote counts to 0
				cards = cards.map((card) => ({
					...card,
					voteCount: 0,
				}));
				allVotesByCard.clear();
			}
			break;
		case "all_votes_updated":
			// Process all voting data including stats
			processVotingData({
				all_votes_by_card: data.all_votes_by_card,
				voting_stats: data.voting_stats,
			});

			// If votes were cleared, clear the user's own votes
			if (data.votes_cleared) {
				userVotesByCard.clear();
			}
			break;
		case "agreements_updated":
			if (data.board_id === boardId) {
				// Update local agreements state for display rule evaluation
				agreements = data.agreements || [];

				window.dispatchEvent(
					new CustomEvent("agreements_updated", {
						detail: data.agreements,
					}),
				);
			}
			break;
		case "scene_updated":
			// Reload health survey questions when scene is updated
			if (
				data.scene_id &&
				currentScene?.id === data.scene_id &&
				currentScene?.mode === "survey"
			) {
				window.dispatchEvent(
					new CustomEvent("scene_updated", {
						detail: { sceneId: data.scene_id },
					}),
				);
			}
			break;
		case "timer_update": {
			const payload = data.data;

			if (payload) {
				// Update poll type and configuration
				pollType = payload.poll_type || "timer";
				pollQuestion = payload.question || "";
				pollChoices = payload.choices || [];

				// Update votes
				pollVotes = payload.votes || {};
				timerTotalVotes = payload.totalUsers || 0;

				// Update timer display state
				if (payload.active) {
					timerVisible = true;
					if (timerRef) {
						timerRef.setTimer(payload.timer_remaining, payload.timer_passed);
					} else {
						// If timer component isn't mounted yet, cache the values.
						pendingTimerInit = {
							remaining: payload.timer_remaining,
							elapsed: payload.timer_passed,
						};
					}
				} else {
					timerVisible = false;
					if (timerRef) {
						timerRef.stop();
					}
					pendingTimerInit = null;
				}

				// Update local board state for consistency
				board.timerStart = payload.timer_start;
				board.timerDuration = payload.timer_passed + payload.timer_remaining;
			}
			break;
		}
	}
}

let currentScene = $derived(
	board?.scenes?.find((s: any) => s.id === board.currentSceneId),
);

// Derive selected card for Present mode - preserves object identity when card data hasn't changed
let selectedCard = $derived(
	cards.find((c: any) => c.id === currentScene?.selectedCardId) || null,
);

// Filter columns based on current scene visibility settings
let visibleColumns = $derived.by(() => {
	// Use allColumns (complete set) if available, otherwise fall back to columns
	const columnsToFilter = board?.allColumns || board?.columns;
	if (!columnsToFilter || !board?.currentSceneId) {
		return columnsToFilter || [];
	}

	const hiddenColumns =
		board.hiddenColumnsByScene?.[board.currentSceneId] || [];
	return columnsToFilter.filter(
		(column: any) => !hiddenColumns.includes(column.id),
	);
});

// Create a board object with filtered columns for display
let displayBoard = $derived.by(() => {
	if (!board) return board;

	return {
		...board,
		columns: visibleColumns,
	};
});

async function changeScene(sceneId: string) {
	try {
		const data = await boardApi.changeScene(boardId, sceneId);

		// Update scene immediately with API response data (now matches SSE)
		board.currentSceneId = sceneId;
		if (data.scene) {
			currentScene = data.scene;
		}

		// Handle scene-specific data from API response
		if (data.present_mode_data && currentScene?.mode === "present") {
			cards = data.present_mode_data.visible_cards;
			if (data.present_mode_data.selected_card) {
				currentScene.selectedCardId = data.present_mode_data.selected_card.id;
			}
		} else if (data.all_cards) {
			cards = data.all_cards;
		}

		showSceneDropdown = false;
	} catch (error) {
		console.error("Failed to change scene:", error);
	}
}

function nextScene() {
	if (!board.scenes || !currentScene) return;
	const currentIndex = board.scenes.findIndex(
		(s: any) => s.id === currentScene.id,
	);

	// Check if we're on the last scene
	const isLastScene =
		currentIndex >= 0 && currentIndex === board.scenes.length - 1;

	if (isLastScene) {
		// Handle last scene behavior based on board status
		if (board.status === "active") {
			// Offer to mark board as completed
			toastStore.warning(
				"You've reached the end. Mark this board as completed?",
				{
					autoHide: false,
					actions: [
						{
							label: "Yes",
							onClick: async () => {
								try {
									const data = await boardApi.updateBoard(boardId, {
										status: "completed",
									});
									board.status = data.board.status;
									toastStore.success("Board marked as completed");
								} catch (error) {
									console.error("Error updating board status:", error);
									toastStore.error(
										error instanceof Error
											? error.message
											: "Error updating board status",
									);
								}
							},
							variant: "primary",
						},
						{
							label: "Cancel",
							onClick: () => {},
							variant: "secondary",
						},
					],
				},
			);
		} else if (board.status === "draft") {
			// Offer to mark board as active and restart at beginning
			toastStore.warning(
				"You've reached the end. Mark this board as active and restart from the beginning?",
				{
					autoHide: false,
					actions: [
						{
							label: "Yes",
							onClick: async () => {
								try {
									const data = await boardApi.updateBoard(boardId, {
										status: "active",
									});
									board.status = data.board.status;
									// Navigate to first scene
									if (board.scenes && board.scenes.length > 0) {
										const firstSceneId = board.scenes[0].id;
										changeScene(firstSceneId);
									}
									toastStore.success("Board activated and restarted");
								} catch (error) {
									console.error("Error updating board status:", error);
									toastStore.error(
										error instanceof Error
											? error.message
											: "Error updating board status",
									);
								}
							},
							variant: "primary",
						},
						{
							label: "Cancel",
							onClick: () => {},
							variant: "secondary",
						},
					],
				},
			);
		}
		// If status is "completed" or "archived", button should be disabled (handled in SceneDropdown)
		return;
	}

	// Not on last scene, find next valid scene (where display rule evaluates to true)
	if (currentIndex >= 0 && currentIndex < board.scenes.length - 1) {
		// Find the next scene that should be displayed
		for (let i = currentIndex + 1; i < board.scenes.length; i++) {
			const candidateScene = board.scenes[i];
			const shouldDisplay = evaluateDisplayRule(
				candidateScene,
				board,
				cards,
				agreements,
				lastHealthCheckDate,
				scorecardCountsByScene,
			);

			if (shouldDisplay) {
				changeScene(candidateScene.id);
				return;
			}
		}

		// If we get here, all remaining scenes are skipped
		// Treat as if we're on the last scene
		if (board.status === "active") {
			toastStore.warning(
				"No more scenes to display. Mark this board as completed?",
				{
					autoHide: false,
					actions: [
						{
							label: "Yes",
							onClick: async () => {
								try {
									const data = await boardApi.updateBoard(boardId, {
										status: "completed",
									});
									board.status = data.board.status;
									toastStore.success("Board marked as completed");
								} catch (error) {
									console.error("Error updating board status:", error);
									toastStore.error(
										error instanceof Error
											? error.message
											: "Error updating board status",
									);
								}
							},
							variant: "primary",
						},
						{
							label: "Cancel",
							onClick: () => {},
							variant: "secondary",
						},
					],
				},
			);
		}
	}
}

async function setupTemplate(template: any) {
	try {
		const response = await fetch(`/api/boards/${boardId}/setup-template`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ template: template.id }),
		});

		if (response.ok) {
			// Reload the board data to reflect the changes
			const boardResponse = await fetch(`/api/boards/${boardId}`);
			if (boardResponse.ok) {
				const boardData = await boardResponse.json();
				board = boardData.board;
				userRole = boardData.userRole;

				// Also reload cards
				const cardsResponse = await fetch(`/api/boards/${boardId}/cards`);
				if (cardsResponse.ok) {
					const cardsData = await cardsResponse.json();
					cards = cardsData.cards || [];
				}
			}
			showTemplateSelector = false;
		} else {
			console.error("Failed to setup template:", await response.json());
		}
	} catch (error) {
		console.error("Failed to setup template:", error);
	}
}

async function cloneBoard(sourceId: string) {
	try {
		const response = await fetch(`/api/boards/${boardId}/clone`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ sourceId }),
		});

		if (response.ok) {
			// Reload the board data to reflect the changes
			const boardResponse = await fetch(`/api/boards/${boardId}`);
			if (boardResponse.ok) {
				const boardData = await boardResponse.json();
				board = boardData.board;
				userRole = boardData.userRole;

				// Also reload cards
				const cardsResponse = await fetch(`/api/boards/${boardId}/cards`);
				if (cardsResponse.ok) {
					const cardsData = await cardsResponse.json();
					cards = cardsData.cards || [];
				}
			}
			showTemplateSelector = false;
		} else {
			const errorData = await response.json();
			console.error("Failed to clone board:", errorData);
			alert(`Failed to clone board: ${errorData.error}`);
		}
	} catch (error) {
		console.error("Failed to clone board:", error);
		alert("Failed to clone board. Please try again.");
	}
}

async function addCardToColumn(columnId: string) {
	const content = newCardContentByColumn.get(columnId) || "";
	if (
		!content.trim() ||
		!getSceneCapability(currentScene, board?.status, "allow_add_cards")
	)
		return;

	try {
		const response = await fetch(`/api/boards/${boardId}/cards`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				content: content.trim(),
				columnId: columnId,
			}),
		});

		if (response.ok) {
			newCardContentByColumn.set(columnId, "");
		}
	} catch (error) {
		console.error("Failed to add card:", error);
	}
}

function getColumnContent(columnId: string): string {
	return newCardContentByColumn.get(columnId) || "";
}

function setColumnContent(columnId: string, content: string) {
	newCardContentByColumn.set(columnId, content);
}

function toggleCardSelection(cardId: string) {
	if (selectedCards.has(cardId)) {
		selectedCards.delete(cardId);
	} else {
		selectedCards.add(cardId);
	}
}

async function voteCard(cardId: string, delta: 1 | -1) {
	try {
		const data = await boardApi.voteCard(cardId, delta);

		// Update cards with new vote counts
		if (data.card) {
			cards = cards.map((c) => (c.id === cardId ? data.card : c));
		}

		// Update voting data with comprehensive data from API response
		// This includes updated vote counts, so no need for additional processing
		const votingDataUpdate: VotingData = {
			votes_by_card: data.user_voting_data?.votes_by_card,
			voting_stats: data.voting_stats,
			// Include all votes by card if showVotes is enabled
			all_votes_by_card: data.all_votes_by_card,
		};
		processVotingData(votingDataUpdate);
	} catch (error) {
		console.error("Failed to vote:", error);
	}
}

async function commentCard(cardId: string) {
	const card = cards.find((c) => c.id === cardId);
	if (!card) return;

	commentingCard = card;
	showCommentModal = true;
}

async function addReaction(cardId: string, emoji: string) {
	if (!boardId) return;

	try {
		const response = await fetch(`/api/comments`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				card_id: cardId,
				content: emoji,
				is_reaction: true,
			}),
		});

		if (!response.ok) {
			toastStore.addToast({
				message: "Failed to add reaction",
				type: "error",
			});
		}
	} catch (error) {
		console.error("Error adding reaction:", error);
		toastStore.addToast({
			message: "Error adding reaction",
			type: "error",
		});
	}
}

async function loadPresentModeData() {
	if (!boardId || !currentScene || currentScene.mode !== "present") return;

	try {
		const data = await boardApi.fetchPresentModeData(boardId);

		// Update cards with filtered and sorted cards
		if (data.cards) {
			cards = data.cards;
		}

		// Update notes lock status
		notesLockStatus = data.notesLockStatus;

		// Update comments and agreements
		if (data.comments) {
			comments = data.comments;
		}
		if (data.agreements) {
			agreements = data.agreements;
		}
	} catch (error) {
		console.error("Error loading present mode data:", error);
	}
}

async function reloadAllCards() {
	if (!boardId) return;
	try {
		const data = await boardApi.fetchCards(boardId);
		cards = data.cards || [];
	} catch (error) {
		console.error("Error reloading cards:", error);
	}
}

async function loadUserVotingData() {
	if (!boardId || !user?.id) return;

	try {
		const allocationData = await boardApi.fetchUserVotingData(boardId);

		// Use reusable process function with new API format
		processVotingData({
			votes_by_card: allocationData.user_voting_data?.votes_by_card,
			all_votes_by_card: allocationData.all_votes_by_card,
			voting_stats: allocationData.voting_stats,
		});

		// Voting stats and connected users are now included in the main response
		// No need for additional API calls - they're already processed above
	} catch (error) {
		console.error("Failed to load user voting data:", error);
	}
}

async function loadVotingStats() {
	if (!boardId) return;

	try {
		const votingStats = await boardApi.fetchVotingStats(boardId);
		processVotingData({
			voting_stats: votingStats,
		});
	} catch (error) {
		console.error("Failed to load voting stats:", error);
	}
}

async function loadConnectedUsers() {
	if (!boardId) return;

	try {
		const data = await boardApi.fetchPresence(boardId);
		// Connected users count is now handled through voting_stats.activeUsers
		connectedUsers = data.connectedUsers;
	} catch (error) {
		console.error("Failed to load connected users:", error);
	}
}

async function handlePollVote(choice: string) {
	if (!boardId || !board.timerStart) return;

	try {
		const response = await fetch(`/api/timer/vote`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				boardId,
				timerId: board.timerStart,
				choice,
			}),
		});

		if (response.ok) {
			const data = await response.json();
			// The API returns the broadcast message with updated vote data
			// Apply it immediately so the voting client sees the update
			if (data.message && data.message.data) {
				const payload = data.message.data;
				pollVotes = payload.votes || {};
				timerTotalVotes = payload.totalUsers || 0;
			}
		} else {
			console.error("Failed to submit poll vote:", response.status);
		}
	} catch (error) {
		console.error("Error submitting poll vote:", error);
	}
}

async function handlePollStart(config: PollConfig) {
	if (!boardId || (userRole !== "admin" && userRole !== "facilitator")) return;

	try {
		const response = await fetch(`/api/boards/${boardId}/timer`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				duration: config.durationSeconds,
				pollType: config.type,
				question: config.question,
				choices: config.choices,
			}),
		});

		if (response.ok) {
			const data = await response.json();
			// Set poll configuration BEFORE calling setTimer so the component has the right pollType
			pollType = config.type;
			pollQuestion = config.question || "";
			pollChoices = config.choices || [];

			if (data.timer && timerRef) {
				timerRef.setTimer(data.timer.timer_remaining, data.timer.timer_passed);
			}
			showPollDropdown = false;
		} else {
			console.error("Failed to start poll:", response.status);
		}
	} catch (error) {
		console.error("Failed to start poll:", error);
	}
}

async function handleTimerAdd(seconds: number) {
	if (!boardId || (userRole !== "admin" && userRole !== "facilitator")) return;

	// If timer is not running, start a simple timer with the specified duration
	if (timerRef && !board?.timerStart) {
		await handlePollStart({
			type: "timer",
			durationSeconds: seconds,
		});
	} else {
		// Timer is running, add time to it
		try {
			const response = await fetch(`/api/boards/${boardId}/timer`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ addSeconds: seconds }),
			});
			if (!response.ok) {
				console.error("Failed to add time to timer");
			}
		} catch (error) {
			console.error("Failed to add time:", error);
		}
	}
}

async function handleTimerStop() {
	if (!boardId || (userRole !== "admin" && userRole !== "facilitator")) return;
	try {
		const response = await fetch(`/api/boards/${boardId}/timer`, {
			method: "DELETE",
		});
		if (response.ok) {
			timerVisible = false;
			if (timerRef) {
				timerRef.stop();
			}
		} else {
			console.error("Failed to stop timer");
		}
	} catch (error) {
		console.error("Failed to stop timer:", error);
	}
}

async function handleRecordAgreement(pollData: {
	pollType: string;
	question: string;
	choices: string[];
	votes: Record<string, number>;
	votingOptions: Array<{ key: string; label: string; icon: string }>;
}) {
	if (!boardId || (userRole !== "admin" && userRole !== "facilitator")) return;

	// Build sorted results with vote counts
	const results = pollData.votingOptions
		.map((option) => ({
			label: option.label,
			votes: pollData.votes[option.key] || 0,
		}))
		.sort((a, b) => b.votes - a.votes) // Sort descending by votes
		.map((item) => `- ${item.label} (${item.votes})`)
		.join("\n");

	const agreementText = `**${pollData.question}**\n${results}`;

	try {
		// Determine if we're in Present mode with an active card
		const inPresentMode = currentScene?.mode === "present" && selectedCard;

		if (inPresentMode && selectedCard) {
			// Record as comment on the active card
			const response = await fetch(`/api/comments`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					card_id: selectedCard.id,
					content: agreementText,
					is_agreement: true,
				}),
			});

			if (!response.ok) {
				console.error("Failed to record poll as card comment");
				toastStore.error("Failed to record poll results");
				return;
			}
		} else {
			// Record as board-level agreement
			const response = await fetch(`/api/boards/${boardId}/agreements`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					content: agreementText,
				}),
			});

			if (!response.ok) {
				console.error("Failed to record poll as board agreement");
				toastStore.error("Failed to record poll results");
				return;
			}
		}

		// Stop the timer after recording
		await handleTimerStop();

		toastStore.success("Poll results recorded");
	} catch (error) {
		console.error("Failed to record poll agreement:", error);
		toastStore.error("Failed to record poll results");
	}
}

function showPoll() {
	if (userRole !== "admin" && userRole !== "facilitator") return;

	// Show the poll configuration dropdown
	showPollDropdown = true;
}

async function increaseVotingAllocation() {
	if (!boardId) return;

	try {
		const response = await fetch(
			`/api/boards/${boardId}/votes/increase-allocation`,
			{
				method: "POST",
			},
		);

		if (!response.ok) {
			throw new Error("Failed to increase allocation");
		}

		// Refresh voting data
		await loadUserVotingData();
	} catch (error) {
		console.error("Failed to increase voting allocation:", error);
		throw error;
	}
}

async function resetBoardVotes() {
	if (!boardId) return;

	try {
		const response = await fetch(`/api/boards/${boardId}/votes/clear`, {
			method: "DELETE",
		});

		if (!response.ok) {
			throw new Error("Failed to reset votes");
		}

		// Refresh all voting-related data
		await loadUserVotingData();
	} catch (error) {
		console.error("Failed to reset votes:", error);
		throw error;
	}
}

async function deleteCard(cardId: string) {
	try {
		const response = await fetch(`/api/cards/${cardId}`, {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
		});

		if (response.ok) {
			// Remove card from local state
			cards = cards.filter((card) => card.id !== cardId);
		} else {
			console.error("Failed to delete card:", response.status);
			alert("Failed to delete card. Please try again.");
		}
	} catch (error) {
		console.error("Failed to delete card:", error);
		alert("Failed to delete card. Please try again.");
	}
}

async function editCard(cardId: string) {
	const card = cards.find((c) => c.id === cardId);
	if (!card) return;

	editingCard = card;
	editCardContent = card.content;
	showEditCardModal = true;
}

function cancelEditCard() {
	showEditCardModal = false;
	editingCard = null;
	editCardContent = "";
}

async function saveEditCard() {
	if (!editingCard || !editCardContent.trim()) {
		return;
	}

	try {
		const response = await fetch(`/api/cards/${editingCard.id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content: editCardContent.trim() }),
		});

		if (response.ok) {
			// Update local state
			cards = cards.map((card) =>
				card.id === editingCard.id
					? { ...card, content: editCardContent.trim() }
					: card,
			);
			cancelEditCard();
		} else {
			console.error("Failed to update card:", response.status);
			alert("Failed to update card. Please try again.");
		}
	} catch (error) {
		console.error("Failed to update card:", error);
		alert("Failed to update card. Please try again.");
	}
}

function handleDragStart(event: DragEvent, cardId: string) {
	// Check if moving cards is allowed in current scene
	if (!getSceneCapability(currentScene, board?.status, "allow_move_cards")) {
		event.preventDefault();
		return;
	}

	console.log("[DRAG DEBUG] Drag started:", { cardId });
	draggedCardId = cardId;
	if (event.dataTransfer) {
		event.dataTransfer.effectAllowed = "move";
	}
}

function handleDragOver(event: DragEvent, columnId: string) {
	event.preventDefault();

	// Don't allow drop if moving cards is not allowed
	if (!getSceneCapability(currentScene, board?.status, "allow_move_cards")) {
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = "none";
		}
		return;
	}

	if (event.dataTransfer) {
		event.dataTransfer.dropEffect = "move";
	}
	if (draggedCardId && cardDropTargetColumnId !== columnId) {
		cardDropTargetColumnId = columnId;
	}
}

function handleDragEnter(event: DragEvent, columnId: string) {
	event.preventDefault();
	if (
		draggedCardId &&
		getSceneCapability(currentScene, board?.status, "allow_move_cards")
	) {
		cardDropTargetColumnId = columnId;
	}
}

function handleDragLeave(event: DragEvent, columnId: string) {
	event.preventDefault();
	// Only clear if we're leaving the column entirely, not just moving to a child element
	const rect = event.currentTarget.getBoundingClientRect();
	const x = event.clientX;
	const y = event.clientY;

	if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
		cardDropTargetColumnId = "";
	}
}

async function handleDrop(event: DragEvent, targetColumnId: string) {
	event.preventDefault();

	if (
		!draggedCardId ||
		!getSceneCapability(currentScene, board?.status, "allow_move_cards")
	) {
		console.log("[DRAG DEBUG] Drag ended (invalid/not allowed)");
		draggedCardId = "";
		cardDropTargetColumnId = "";
		cardSequenceDropIndex = null;
		dragOverCardId = "";
		cardDropPosition = "";
		return;
	}

	try {
		// Check if sequencing is enabled and we have a specific drop index
		const canSequence = getSceneCapability(
			currentScene,
			board?.status,
			"allow_sequence_cards",
		);

		if (canSequence && cardSequenceDropIndex !== null) {
			console.log("[DRAG DEBUG] Drop - sequencing:", {
				draggedCardId,
				targetColumnId,
				targetSeq: cardSequenceDropIndex,
			});
			// Use PATCH endpoint for sequencing
			const response = await fetch(`/api/cards/${draggedCardId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					columnId: targetColumnId,
					seq: cardSequenceDropIndex,
				}),
			});

			if (!response.ok) {
				console.error("Failed to resequence card");
			}
			// WebSocket broadcasts will update the UI
		} else {
			// Use existing move endpoint
			const response = await fetch(`/api/cards/${draggedCardId}/move`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ columnId: targetColumnId }),
			});

			if (response.ok) {
				const data = await response.json();
				// Only update local state if it's a single card move
				// Group moves are handled via WebSocket broadcasts
				if (data.card) {
					cards = cards.map((c) => (c.id === draggedCardId ? data.card : c));
				}
				// For group moves, the WebSocket broadcasts will update the UI
			}
		}
	} catch (error) {
		console.error("Failed to move card:", error);
	}

	console.log("[DRAG DEBUG] Drag ended (drop complete)");
	draggedCardId = "";
	cardDropTargetColumnId = "";
	cardSequenceDropIndex = null;
	dragOverCardId = "";
	cardDropPosition = "";
}

async function handleCardDrop(event: DragEvent, targetCardId: string) {
	event.preventDefault();

	if (
		!draggedCardId ||
		!getSceneCapability(currentScene, board?.status, "allow_group_cards")
	) {
		draggedCardId = "";
		return;
	}

	// Don't allow dropping a card onto itself
	if (draggedCardId === targetCardId) {
		draggedCardId = "";
		return;
	}

	try {
		const response = await fetch(`/api/cards/${draggedCardId}/group-onto`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ targetCardId: targetCardId }),
		});

		if (!response.ok) {
			console.error("Failed to group card");
		}
	} catch (error) {
		console.error("Failed to group card:", error);
	}

	draggedCardId = "";
	cardDropTargetColumnId = "";
}

function handleCardDragOver(
	event: DragEvent,
	cardId: string,
	cardSeq: number,
	columnId: string,
) {
	// Check if sequencing is enabled
	if (
		!getSceneCapability(currentScene, board?.status, "allow_sequence_cards")
	) {
		return;
	}

	event.preventDefault();

	// Get the card element to calculate position
	const cardElement = event.currentTarget as HTMLElement;
	const rect = cardElement.getBoundingClientRect();
	const midpoint = rect.top + rect.height / 2;
	const mouseY = event.clientY;

	// Determine if we're in the top half or bottom half
	const position = mouseY < midpoint ? "above" : "below";

	const wasOverCard = dragOverCardId;
	const wasPosition = cardDropPosition;

	dragOverCardId = cardId;
	cardDropPosition = position;

	// Log when drop indicator visibility changes
	if (wasOverCard !== cardId || wasPosition !== position) {
		console.log("[DRAG DEBUG] Drop indicator changed:", {
			cardId,
			position,
			seq: cardSeq,
			columnId,
			previousCard: wasOverCard,
			previousPosition: wasPosition,
		});
	}

	// Calculate the sequence index for the drop
	// If "above", use the card's seq; if "below", use seq + 1
	cardSequenceDropIndex = position === "above" ? cardSeq : cardSeq + 1;
}

function handleCardDragLeave(event: DragEvent) {
	// Check if sequencing is enabled
	if (
		!getSceneCapability(currentScene, board?.status, "allow_sequence_cards")
	) {
		return;
	}

	const currentTarget = event.currentTarget as HTMLElement;
	const relatedTarget = event.relatedTarget as HTMLElement;

	// Don't clear if moving to a drop indicator (which would cause flickering)
	if (
		relatedTarget &&
		relatedTarget.classList &&
		relatedTarget.classList.contains("sequence-drop-indicator")
	) {
		console.log("[DRAG DEBUG] Moved to drop indicator, maintaining state");
		return;
	}

	// Only clear if we're actually leaving the card (not just moving to a child)
	if (
		currentTarget &&
		(!relatedTarget || !currentTarget.contains(relatedTarget))
	) {
		console.log("[DRAG DEBUG] Drop indicator cleared (drag leave)");
		dragOverCardId = "";
		cardDropPosition = "";
		cardSequenceDropIndex = null;
	}
}

async function ungroupCard(cardId: string, targetColumnId: string) {
	try {
		const response = await fetch(`/api/cards/${cardId}/group-onto`, {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ columnId: targetColumnId }),
		});

		if (!response.ok) {
			console.error("Failed to ungroup card");
		}
	} catch (error) {
		console.error("Failed to ungroup card:", error);
	}
}

async function groupCards(cardsToGroup: any[]) {
	if (cardsToGroup.length < 2) return;

	const groupId = crypto.randomUUID();

	try {
		const response = await fetch(`/api/boards/${boardId}/cards/group`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				cardIds: cardsToGroup.map((c) => c.id),
				groupId: groupId,
			}),
		});

		if (response.ok) {
			const data = await response.json();
			cards = cards.map((card) => {
				const updatedCard = data.cards.find((c: any) => c.id === card.id);
				return updatedCard || card;
			});
		}
	} catch (error) {
		console.error("Failed to group cards:", error);
	}
}

// Configuration Dialog Functions
async function updateBoardConfigImmediate(config: any) {
	try {
		const response = await fetch(`/api/boards/${boardId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(config),
		});

		if (response.ok) {
			const data = await response.json();
			board = { ...board, ...data.board };
		}
	} catch (error) {
		console.error("Failed to update board config:", error);
	}
}

async function performDeleteBoard() {
	if (!["admin", "facilitator"].includes(userRole)) return;

	try {
		const response = await fetch(`/api/boards/${boardId}`, {
			method: "DELETE",
		});

		if (response.ok) {
			toastStore.success("Board deleted successfully");
			// Navigate back to dashboard
			goto(resolve("/"));
		} else {
			const data = await response.json();
			toastStore.error(data.error || "Failed to delete board");
		}
	} catch (error) {
		console.error("Failed to delete board:", error);
		toastStore.error("Failed to delete board");
	}
}

function deleteBoard() {
	if (!["admin", "facilitator"].includes(userRole)) return;

	toastStore.warning("Are you sure that you want to delete this board?", {
		autoHide: false,
		actions: [
			{
				label: "Delete",
				onClick: performDeleteBoard,
				variant: "primary",
			},
			{
				label: "Cancel",
				onClick: () => {}, // Will auto-close on action
				variant: "secondary",
			},
		],
	});
}

// Column Management Functions
async function createColumn(formData: any = null) {
	if (!["admin", "facilitator"].includes(userRole)) return;
	const columnData = formData || {
		title: "New Column",
		description: "",
		defaultAppearance: "shown",
	};
	if (!columnData.title.trim()) {
		alert("Column title is required");
		return;
	}
	try {
		const response = await fetch(`/api/boards/${board.id}/columns`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(columnData),
		});
		if (response.ok) {
			// Don't update local state - let the websocket handle it to avoid duplicates
		} else {
			const errorData = await response.json();
			console.error("Failed to create column:", errorData);
			alert(`Failed to create column: ${errorData.error}`);
		}
	} catch (error) {
		console.error("Failed to create column:", error);
		alert("Failed to create column");
	}
}

async function addNewColumnRow() {
	const newColumn = {
		title: "New Column",
		description: "",
		defaultAppearance: "shown",
	};
	await createColumn(newColumn);
}

async function updateColumn(columnId: string, data: any) {
	try {
		const response = await fetch(`/api/boards/${boardId}/columns/${columnId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
		});

		if (response.ok) {
			const responseData = await response.json();
			// Update both columns and allColumns for optimistic update
			const columnIndex = board.columns.findIndex(
				(c: any) => c.id === columnId,
			);
			if (columnIndex !== -1) {
				board.columns[columnIndex] = responseData.column;
			}
			if (board.allColumns) {
				const allColumnIndex = board.allColumns.findIndex(
					(c: any) => c.id === columnId,
				);
				if (allColumnIndex !== -1) {
					board.allColumns[allColumnIndex] = responseData.column;
				}
			}
		}
	} catch (error) {
		console.error("Failed to update column:", error);
	}
}

async function deleteColumn(columnId: string) {
	toastStore.warning(
		"Are you sure you want to delete this column? All cards in this column will be deleted.",
		{
			autoHide: false,
			actions: [
				{
					label: "Delete",
					onClick: async () => {
						try {
							const response = await fetch(
								`/api/boards/${boardId}/columns/${columnId}`,
								{
									method: "DELETE",
								},
							);

							if (response.ok) {
								// Remove from both columns and allColumns for optimistic update
								board.columns = board.columns.filter(
									(c: any) => c.id !== columnId,
								);
								if (board.allColumns) {
									board.allColumns = board.allColumns.filter(
										(c: any) => c.id !== columnId,
									);
								}
								toastStore.success("Column deleted successfully");
							} else {
								toastStore.error("Failed to delete column");
							}
						} catch (error) {
							console.error("Failed to delete column:", error);
							toastStore.error("Failed to delete column");
						}
					},
					variant: "primary",
				},
				{
					label: "Cancel",
					onClick: () => {},
					variant: "secondary",
				},
			],
		},
	);
}

// Scene Management Functions
async function createScene(formData: any = null) {
	if (!["admin", "facilitator"].includes(userRole)) return;

	const sceneData = formData || {
		title: "New Scene",
		description: "",
		mode: "columns",
		allowAddCards: true,
		allowEditCards: true,
		allowComments: true,
		allowVoting: false,
		multipleVotesPerCard: true,
	};

	if (!sceneData.title.trim()) {
		alert("Scene title is required");
		return;
	}

	try {
		const response = await fetch(`/api/boards/${board.id}/scenes`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(sceneData),
		});

		if (response.ok) {
			const data = await response.json();
			board.scenes = [...(board.scenes || []), data.scene];
			return true;
		} else {
			const data = await response.json();
			alert(data.error || "Failed to create scene");
			return false;
		}
	} catch {
		alert("Failed to create scene");
		return false;
	}
}

async function addNewSceneRow() {
	const newScene = {
		title: "New Scene",
		description: "",
		mode: "columns",
		allowAddCards: true,
		allowEditCards: true,
		allowComments: true,
		allowVoting: false,
		multipleVotesPerCard: true,
	};

	await createScene(newScene);
}

async function updateScene(sceneId: string, data: any) {
	try {
		const response = await fetch(`/api/boards/${boardId}/scenes/${sceneId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
		});

		if (response.ok) {
			const responseData = await response.json();
			const sceneIndex = board.scenes.findIndex((s: any) => s.id === sceneId);
			if (sceneIndex !== -1) {
				board.scenes[sceneIndex] = responseData.scene;
			}
		}
	} catch (error) {
		console.error("Failed to update scene:", error);
	}
}

async function deleteScene(sceneId: string) {
	toastStore.warning("Are you sure you want to delete this scene?", {
		autoHide: false,
		actions: [
			{
				label: "Delete",
				onClick: async () => {
					try {
						const response = await fetch(
							`/api/boards/${boardId}/scenes/${sceneId}`,
							{
								method: "DELETE",
							},
						);

						if (response.ok) {
							board.scenes = board.scenes.filter((s: any) => s.id !== sceneId);
							toastStore.success("Scene deleted successfully");
						} else {
							toastStore.error("Failed to delete scene");
						}
					} catch (error) {
						console.error("Failed to delete scene:", error);
						toastStore.error("Failed to delete scene");
					}
				},
				variant: "primary",
			},
			{
				label: "Cancel",
				onClick: () => {},
				variant: "secondary",
			},
		],
	});
}

// Drag and Drop Handlers
function handleConfigDragStart(
	type: "column" | "scene",
	event: DragEvent,
	id: string,
) {
	if (type === "column") {
		draggedColumnId = id;
	} else {
		draggedSceneId = id;
	}
	if (event.dataTransfer) {
		event.dataTransfer.effectAllowed = "move";
	}
}

function handleConfigDragOver(
	type: "column" | "scene",
	event: DragEvent,
	id: string,
) {
	event.preventDefault();
	if (event.dataTransfer) {
		event.dataTransfer.dropEffect = "move";
	}

	if (type === "column" && draggedColumnId && draggedColumnId !== id) {
		dragOverColumnId = id;
		const rect = (event.currentTarget as HTMLElement)?.getBoundingClientRect();
		if (rect) {
			const midpoint = rect.top + rect.height / 2;
			columnDropPosition = event.clientY < midpoint ? "above" : "below";
		}
	} else if (type === "scene" && draggedSceneId && draggedSceneId !== id) {
		dragOverSceneId = id;
		const rect = (event.currentTarget as HTMLElement)?.getBoundingClientRect();
		if (rect) {
			const midpoint = rect.top + rect.height / 2;
			sceneDropPosition = event.clientY < midpoint ? "above" : "below";
		}
	}
}

function handleConfigDragLeave(type: "column" | "scene", event: DragEvent) {
	const rect = (event.currentTarget as HTMLElement)?.getBoundingClientRect();
	if (!rect) return;
	const x = event.clientX;
	const y = event.clientY;

	if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
		if (type === "column") {
			dragOverColumnId = "";
			columnDropPosition = "";
		} else {
			dragOverSceneId = "";
			sceneDropPosition = "";
		}
	}
}

async function handleConfigDrop(
	type: "column" | "scene",
	event: DragEvent,
	targetId: string,
) {
	event.preventDefault();

	if (type === "column") {
		const dragPosition = columnDropPosition;
		dragOverColumnId = "";
		columnDropPosition = "";

		if (!draggedColumnId || draggedColumnId === targetId) {
			draggedColumnId = "";
			return;
		}

		await reorderColumns(draggedColumnId, targetId, dragPosition);
		draggedColumnId = "";
	} else {
		const dragPosition = sceneDropPosition;
		dragOverSceneId = "";
		sceneDropPosition = "";

		if (!draggedSceneId || draggedSceneId === targetId) {
			draggedSceneId = "";
			return;
		}

		await reorderScenes(draggedSceneId, targetId, dragPosition);
		draggedSceneId = "";
	}
}

async function reorderColumns(
	draggedId: string,
	targetId: string,
	position: string,
) {
	try {
		// Use allColumns if available for reordering, otherwise fall back to columns
		const sourceColumns = board.allColumns || board.columns;
		const columns = [...sourceColumns];
		const draggedIndex = columns.findIndex((c) => c.id === draggedId);
		const targetIndex = columns.findIndex((c) => c.id === targetId);

		if (draggedIndex === -1 || targetIndex === -1) return;

		// Remove the dragged item
		const [draggedItem] = columns.splice(draggedIndex, 1);

		// Calculate new position
		let insertIndex = targetIndex;
		if (draggedIndex < targetIndex) insertIndex -= 1;
		if (position === "below") insertIndex += 1;

		// Insert at new position
		columns.splice(insertIndex, 0, draggedItem);

		// Create reorder payload
		const columnOrders = columns.map((column, index) => ({
			id: column.id,
			seq: index,
		}));

		const response = await fetch(`/api/boards/${boardId}/columns/reorder`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ columnOrders }),
		});

		if (response.ok) {
			// Update both columns and allColumns for optimistic update
			board.columns = columns;
			if (board.allColumns) {
				board.allColumns = columns;
			}
		}
	} catch (error) {
		console.error("Failed to reorder columns:", error);
	}
}

async function reorderScenes(
	draggedId: string,
	targetId: string,
	position: string,
) {
	try {
		const scenes = [...board.scenes];
		const draggedIndex = scenes.findIndex((s) => s.id === draggedId);
		const targetIndex = scenes.findIndex((s) => s.id === targetId);

		if (draggedIndex === -1 || targetIndex === -1) return;

		// Remove the dragged item
		const [draggedItem] = scenes.splice(draggedIndex, 1);

		// Calculate new position
		let insertIndex = targetIndex;
		if (draggedIndex < targetIndex) insertIndex -= 1;
		if (position === "below") insertIndex += 1;

		// Insert at new position
		scenes.splice(insertIndex, 0, draggedItem);

		// Create reorder payload
		const sceneOrders = scenes.map((scene, index) => ({
			id: scene.id,
			seq: index,
		}));

		const response = await fetch(`/api/boards/${boardId}/scenes/reorder`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ sceneOrders }),
		});

		if (response.ok) {
			board.scenes = scenes;
		}
	} catch (error) {
		console.error("Failed to reorder scenes:", error);
	}
}

async function handleConfigEndDrop(type: "column" | "scene", event: DragEvent) {
	event.preventDefault();

	if (type === "column") {
		dragOverColumnEnd = false;
		if (!draggedColumnId) return;
		await moveColumnToEnd(draggedColumnId);
		draggedColumnId = "";
	} else {
		dragOverSceneEnd = false;
		if (!draggedSceneId) return;
		await moveSceneToEnd(draggedSceneId);
		draggedSceneId = "";
	}
}

async function moveColumnToEnd(draggedId: string) {
	try {
		// Use allColumns if available for reordering, otherwise fall back to columns
		const sourceColumns = board.allColumns || board.columns;
		const columns = [...sourceColumns];
		const draggedIndex = columns.findIndex((c) => c.id === draggedId);

		if (draggedIndex === -1) return;

		// Remove the dragged item and add to end
		const [draggedItem] = columns.splice(draggedIndex, 1);
		columns.push(draggedItem);

		// Create reorder payload
		const columnOrders = columns.map((column, index) => ({
			id: column.id,
			seq: index,
		}));

		const response = await fetch(`/api/boards/${boardId}/columns/reorder`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ columnOrders }),
		});

		if (response.ok) {
			// Update both columns and allColumns for optimistic update
			board.columns = columns;
			if (board.allColumns) {
				board.allColumns = columns;
			}
		}
	} catch (error) {
		console.error("Failed to move column to end:", error);
	}
}

async function moveSceneToEnd(draggedId: string) {
	try {
		const scenes = [...board.scenes];
		const draggedIndex = scenes.findIndex((s) => s.id === draggedId);

		if (draggedIndex === -1) return;

		// Remove the dragged item and add to end
		const [draggedItem] = scenes.splice(draggedIndex, 1);
		scenes.push(draggedItem);

		// Create reorder payload
		const sceneOrders = scenes.map((scene, index) => ({
			id: scene.id,
			seq: index,
		}));

		const response = await fetch(`/api/boards/${boardId}/scenes/reorder`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ sceneOrders }),
		});

		if (response.ok) {
			board.scenes = scenes;
		}
	} catch (error) {
		console.error("Failed to move scene to end:", error);
	}
}

async function handleShareBoard() {
	// Check if board is in draft status
	if (board.status === "draft") {
		toastStore.draftBoardWarning(async () => {
			try {
				// Update board status to active
				const response = await fetch(`/api/boards/${boardId}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ status: "active" }),
				});

				if (response.ok) {
					const data = await response.json();
					board.status = data.board.status;
					// Now proceed with sharing
					await copyBoardUrlToClipboard();
				} else {
					toastStore.error("Failed to make board active. Please try again.");
				}
			} catch (error) {
				console.error("Error updating board status:", error);
				toastStore.error("Error updating board. Please try again.");
			}
		});
	} else if (board.status === "completed" || board.status === "archived") {
		// Board is completed or archived - copy URL with restricted access message
		await copyBoardUrlToClipboard(true);
	} else {
		// Board is active, proceed with sharing
		await copyBoardUrlToClipboard(false);
	}
}

async function copyBoardUrlToClipboard(restrictedAccess = false) {
	try {
		const shareUrl = window.location.href;
		await navigator.clipboard.writeText(shareUrl);
		if (restrictedAccess) {
			toastStore.success(
				"Board URL copied to clipboard! Only existing members with access to the series will be able to see this board.",
			);
		} else {
			toastStore.success(
				"Board URL copied to clipboard! Anyone with this link can access the board.",
			);
		}
	} catch (error) {
		console.error("Error copying to clipboard:", error);
		toastStore.error("Error copying link to clipboard. Please try again.");
	}
}

// Computed values for drag state
let dragState = $derived({
	draggedColumnId,
	draggedSceneId,
	dragOverColumnId,
	dragOverSceneId,
	columnDropPosition,
	sceneDropPosition,
	dragOverColumnEnd,
	dragOverSceneEnd,
});
</script>

<svelte:head>
    <title>{data.pageTitle}</title>
    <meta name="description" content={data.description} />

    <!-- OpenGraph tags -->
    <meta property="og:title" content={data.pageTitle} />
    <meta property="og:description" content={data.description} />
    <meta property="og:type" content="website" />
    <meta property="og:url" content={$page.url.toString()} />
    <meta property="og:image" content="{$page.url.origin}/og-image.svg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta
        property="og:image:alt"
        content="TeamBeat - Collaborative Team Meetings"
    />
    <meta property="og:site_name" content="TeamBeat" />

    <!-- Twitter Card tags -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={data.pageTitle} />
    <meta name="twitter:description" content={data.description} />
    <meta name="twitter:image" content="{$page.url.origin}/og-image.svg" />
    <meta
        name="twitter:image:alt"
        content="TeamBeat - Collaborative Team Meetings"
    />
</svelte:head>

{#if loading}
    <div id="board-loading">
        <Icon name="loading" size="lg" />
    </div>
{:else if !board}
    <div id="board-not-found">
        <div class="board-not-found-content">
            <div class="board-not-found-icon">
                <Icon name="warning" color="danger" circle={true} size="lg" />
            </div>
            <h2 class="board-not-found-title">Board not found</h2>
            <p class="board-not-found-message">
                The board you're looking for doesn't exist or you don't have
                permission to view it.
            </p>
            <p class="board-not-found-message-2">
                Please check the URL or contact the board creator.
            </p>
            <a href="/" class="btn-primary">Go to Dashboard</a>
        </div>
    </div>
{:else if showBoardConfig}
    <!-- Configuration Page -->
    <BoardConfigPage
        {board}
        {userRole}
        {agreements}
        {lastHealthCheckDate}
        onClose={() => (showBoardConfig = false)}
        onUpdateBoardConfig={updateBoardConfigImmediate}
        onAddNewColumn={addNewColumnRow}
        onAddNewScene={addNewSceneRow}
        onUpdateColumn={updateColumn}
        onDeleteColumn={deleteColumn}
        onUpdateScene={updateScene}
        onDeleteScene={deleteScene}
        onDragStart={handleConfigDragStart}
        onDragOver={handleConfigDragOver}
        onDragLeave={handleConfigDragLeave}
        onDrop={handleConfigDrop}
        onEndDrop={handleConfigEndDrop}
        onDeleteBoard={deleteBoard}
        {dragState}
    />
{:else}
    <!-- Board View -->
    <BoardHeader
        {board}
        {userRole}
        {currentScene}
        {cards}
        {agreements}
        {lastHealthCheckDate}
        {scorecardCountsByScene}
        {showSceneDropdown}
        {showBoardConfig}
        {connectedUsers}
        userVoteAllocation={votingAllocation || undefined}
        votingStats={votingStats || undefined}
        onConfigureClick={() => (showBoardConfig = true)}
        onShareClick={handleShareBoard}
        onSceneChange={changeScene}
        onNextScene={nextScene}
        onShowSceneDropdown={(show) => (showSceneDropdown = show)}
        onIncreaseAllocation={increaseVotingAllocation}
        onResetVotes={resetBoardVotes}
        onStartTimer={() => showPoll()}
    />

    <!-- Connection Status Indicator -->
    {#if sseConnectionState !== "connected"}
        <div class="connection-status connection-status--{sseConnectionState}">
            <div class="connection-status__content">
                {#if sseConnectionState === "connecting"}
                    <div
                        class="connection-status__indicator connection-status__indicator--connecting"
                    ></div>
                    <span>Connecting...</span>
                {:else if sseConnectionState === "disconnected"}
                    <div
                        class="connection-status__indicator connection-status__indicator--error"
                    ></div>
                    <span>Unable to reconnect. <button class="link-button" onclick={() => window.location.reload()}>Click to reload</button></span>
                {:else if sseConnectionState === "limit_exceeded"}
                    <div
                        class="connection-status__indicator connection-status__indicator--error"
                    ></div>
                    <span>Connection limit exceeded</span>
                {:else}
                    <div
                        class="connection-status__indicator connection-status__indicator--error"
                    ></div>
                    <span>Attempting to reconnect... ({sseReconnectAttempts}/{sseMaxReconnectAttempts} tries)</span>
                {/if}
            </div>
        </div>
    {/if}

    <!-- Connection Limit Exceeded Overlay -->
    {#if sseConnectionState === "limit_exceeded"}
        <div class="connection-error-overlay">
            <div class="connection-error-dialog">
                <div class="connection-error-icon">
                    <Icon name="warning" color="danger" circle={true} size="lg" />
                </div>
                <h2 class="connection-error-title">Too Many Connections</h2>
                <p class="connection-error-message">
                    {sseErrorMessage}
                </p>
                <button
                    class="btn-primary"
                    onclick={() => window.location.reload()}
                >
                    Refresh Page
                </button>
            </div>
        </div>
    {/if}

    <!-- Main content area that grows to fill available space -->
    {#if (!(board.allColumns || board.columns) || (board.allColumns || board.columns)?.length === 0) && (!board.scenes || board.scenes.length === 0)}
        <BoardSetup
            bind:showTemplateSelector
            {templates}
            {boardId}
            onToggleTemplateSelector={() =>
                (showTemplateSelector = !showTemplateSelector)}
            onSetupTemplate={setupTemplate}
            onConfigureClick={() => (showBoardConfig = true)}
            onCloneBoard={cloneBoard}
        />
    {:else if currentScene?.mode === "present"}
        <PresentMode
            {board}
            scene={currentScene}
            currentUser={user}
            {cards}
            {selectedCard}
            {comments}
            {agreements}
            isAdmin={userRole === "admin"}
            isFacilitator={userRole === "facilitator"}
            {notesLockStatus}
            onVoteCard={voteCard}
            onCommentCard={commentCard}
            onDeleteCard={deleteCard}
            onEditCard={editCard}
            onReaction={addReaction}
        />
    {:else if currentScene?.mode === "review"}
        <ReviewScene {board} scene={currentScene} {cards} />
    {:else if currentScene?.mode === "agreements"}
        <AgreementsScene {board} scene={currentScene} {userRole} />
    {:else if currentScene?.mode === "scorecard"}
        <ScorecardScene
            sceneId={currentScene.id}
            {boardId}
            {board}
            scene={currentScene}
            canEdit={userRole === "admin" || userRole === "facilitator"}
            {userRole}
        />
    {:else if currentScene?.mode === "static"}
        <StaticScene scene={currentScene} />
    {:else if currentScene?.mode === "survey"}
        <HealthSurvey scene={currentScene} {boardId} boardStatus={board.status} {userRole} />
    {:else if currentScene?.mode === "quadrant"}
        <QuadrantScene
            scene={currentScene}
            {cards}
            {boardId}
            {board}
            {userRole}
            currentUserId={user?.id}
            isAdmin={userRole === "admin"}
            isFacilitator={userRole === "facilitator"}
        />
    {:else}
        <BoardColumns
            board={displayBoard}
            {cards}
            {currentScene}
            {groupingMode}
            {selectedCards}
            dragTargetColumnId={cardDropTargetColumnId}
            {dragOverCardId}
            {cardDropPosition}
            {draggedCardId}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onCardDrop={handleCardDrop}
            onCardDragOver={handleCardDragOver}
            onCardDragLeave={handleCardDragLeave}
            onDragStart={handleDragStart}
            onToggleCardSelection={toggleCardSelection}
            onVoteCard={voteCard}
            onCommentCard={commentCard}
            onAddCard={addCardToColumn}
            onGroupCards={groupCards}
            onGetColumnContent={getColumnContent}
            onSetColumnContent={setColumnContent}
            onDeleteCard={deleteCard}
            onEditCard={editCard}
            onReaction={addReaction}
            {userRole}
            currentUserId={user?.id}
            {hasVotes}
            {userVotesByCard}
            {allVotesByCard}
        />
    {/if}
{/if}

<!-- Edit Card Modal -->
<Modal
    show={showEditCardModal}
    title="Edit Card"
    onClose={cancelEditCard}
    size="md"
>
    {#snippet children()}
        <div class="edit-card-form">
            <div class="form-group">
                <label for="card-content">Card Content</label>
                <textarea
                    id="card-content"
                    bind:value={editCardContent}
                    placeholder="Enter card content..."
                    rows="4"
                    class="input"
                    onkeydown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (editCardContent.trim()) {
                                saveEditCard();
                            }
                        }
                    }}
                ></textarea>
            </div>

            <div class="modal-actions">
                <button
                    onclick={cancelEditCard}
                    class="btn-secondary"
                    type="button"
                >
                    Cancel
                </button>
                <button
                    onclick={saveEditCard}
                    class="btn-primary"
                    type="button"
                    disabled={!editCardContent.trim()}
                >
                    Save
                </button>
            </div>
        </div>
    {/snippet}
</Modal>

<!-- Comment Modal -->
<CommentModal
    show={showCommentModal}
    card={commentingCard}
    {boardId}
    blameFreeMode={board?.blameFreeMode || false}
    onClose={() => {
        showCommentModal = false;
        commentingCard = null;
    }}
/>

<!-- Poll Dropdown -->
<PollDropdown
    visible={showPollDropdown}
    onStartPoll={handlePollStart}
    onClose={() => (showPollDropdown = false)}
/>

<!-- Timer/Poll Component -->
<Timer
    bind:this={timerRef}
    visible={timerVisible}
    enableMenu={userRole === "admin" || userRole === "facilitator"}
    {pollType}
    question={pollQuestion}
    choices={pollChoices}
    votes={pollVotes}
    totalVotes={timerTotalVotes}
    onvote={handlePollVote}
    onaddtime={handleTimerAdd}
    onstopTimer={handleTimerStop}
    onrecordagreement={handleRecordAgreement}
/>

<style lang="less">
    @import "$lib/styles/_mixins.less";
    .connection-status {
        position: fixed;
        top: 1rem;
        right: 1rem;
        z-index: 50;
        padding: 0.5rem 0.75rem;
        border-radius: 0.5rem;
        box-shadow:
            0 10px 15px -3px rgba(0, 0, 0, 0.1),
            0 4px 6px -2px rgba(0, 0, 0, 0.05);
        font-size: 0.875rem;
        font-weight: 500;
        transition: all 0.3s ease;
        border: 1px solid;
    }

    .connection-status--connecting {
        background-color: #fef3c7;
        color: #92400e;
        border-color: #fde68a;
    }

    .connection-status--disconnected {
        background-color: #fed7aa;
        color: #c2410c;
        border-color: #fdba74;
    }

    .connection-status--error {
        background-color: #fee2e2;
        color: #991b1b;
        border-color: #fecaca;
    }

    .connection-status__content {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    /* Edit card form styles */
    .edit-card-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .edit-card-form label {
        font-weight: 500;
        color: var(--color-text-primary);
        margin-bottom: 0.5rem;
        display: block;
    }

    .connection-status__indicator {
        width: 0.75rem;
        height: 0.75rem;
        border-radius: 50%;
    }

    .connection-status__indicator--connecting {
        background-color: #eab308;
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    .connection-status__indicator--disconnected {
        background-color: #ea580c;
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    .connection-status__indicator--error {
        background-color: #dc2626;
    }

    .link-button {
        background: none;
        border: none;
        color: inherit;
        text-decoration: underline;
        cursor: pointer;
        padding: 0;
        font: inherit;
    }

    .link-button:hover {
        opacity: 0.8;
    }

    @keyframes pulse {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.5;
        }
    }

    /* Loading State */
    #board-loading {
        .flex-center();
        min-height: 100vh;
        color: var(--color-text-muted);
    }

    /* Board Not Found State */
    #board-not-found {
        .flex-center();
        flex: 1;
        padding: var(--spacing-4);
        margin: auto;
    }

    .board-not-found-content {
        .flex-column-center();
        gap: var(--spacing-4);
        max-width: 28rem;
        text-align: center;
    }

    .board-not-found-icon {
        margin-bottom: var(--spacing-2);

        :global(.icon) {
            width: 4rem;
            height: 4rem;
        }
    }

    .board-not-found-title {
        .heading(2);
        color: var(--color-text-primary);
        margin: 0;
    }

    .board-not-found-message {
        .body-text(base);
        color: var(--color-text-secondary);
        margin: 0 0 var(--spacing-2);
        line-height: 1.6;
    }
    .board-not-found-message-2 {
        .body-text(base);
        color: var(--color-text-muted);
        font-size: smaller;
        margin: 0 0 var(--spacing-2);
        line-height: 1.6;
    }

    /* Connection Error Overlay */
    .connection-error-overlay {
        position: fixed;
        inset: 0;
        background-color: rgba(0, 0, 0, 0.75);
        .flex-center();
        z-index: 9999;
        padding: var(--spacing-4);
    }

    .connection-error-dialog {
        .flex-column-center();
        gap: var(--spacing-4);
        max-width: 28rem;
        background-color: var(--color-bg-primary);
        padding: var(--spacing-6);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-xl);
        text-align: center;
    }

    .connection-error-icon {
        margin-bottom: var(--spacing-2);

        :global(.icon) {
            width: 4rem;
            height: 4rem;
        }
    }

    .connection-error-title {
        .heading(2);
        color: var(--color-text-primary);
        margin: 0;
    }

    .connection-error-message {
        .body-text(base);
        color: var(--color-text-secondary);
        margin: 0;
        line-height: 1.6;
    }
</style>
