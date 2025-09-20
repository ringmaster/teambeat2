<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";

    import BoardHeader from "$lib/components/BoardHeader.svelte";
    import BoardSetup from "$lib/components/BoardSetup.svelte";
    import BoardColumns from "$lib/components/BoardColumns.svelte";
    import BoardConfigDialog from "$lib/components/BoardConfigDialog.svelte";
    import Icon from "$lib/components/ui/Icon.svelte";
    import Modal from "$lib/components/ui/Modal.svelte";
    import { toastStore } from "$lib/stores/toast";

    interface Props {
        data: {
            board: any;
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

    let board: any = $state(null);
    let cards: any[] = $state([]);
    let user: any = $state(null);
    let userRole = $state("");
    let loading = $state(true);
    let eventSource: EventSource | null = null;
    let boardId = $state("");
    let clientId = $state("");

    // SSE Connection Health Monitoring
    let sseConnectionState = $state<
        "connecting" | "connected" | "disconnected" | "error"
    >("disconnected");
    let sseReconnectAttempts = $state(0);
    let sseMaxReconnectAttempts = 5;
    let sseReconnectTimeout: number | null = null;

    // UI State
    let newCardContentByColumn = $state(new Map<string, string>());
    let showSceneDropdown = $state(false);
    let showBoardConfig = $state(false);
    let configActiveTab = $state("general");
    let showTemplateSelector = $state(false);

    // Edit Card Modal State
    let showEditCardModal = $state(false);
    let editingCard = $state<any>(null);
    let editCardContent = $state("");

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

    // Grouping State
    let groupingMode = $state(false);
    let selectedCards = $state(new Set<string>());

    // Voting State
    let votingAllocation = $state<{
        currentVotes: number;
        maxVotes: number;
        remainingVotes: number;
        canVote: boolean;
    } | null>(null);
    let userVotesByCard = $state(new Map<string, number>()); // cardId -> user votes on that card
    let allVotesByCard = $state(new Map<string, number>()); // cardId -> total votes on that card (when votes visible)

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

    // Calculate if user has votes available (same value for all cards on the board)
    let hasVotes = $derived(votingAllocation?.canVote ?? false);

    // Load user voting data when board and user are ready
    $effect(() => {
        if (boardId && user?.id && !loading) {
            loadUserVotingData();
        }
    });

    // Config Form State
    let configForm = $state({
        name: "",
        blameFreeMode: false,
        votingAllocation: 0,
        status: "draft",
    });

    // Templates
    let templates: any[] = $state([]);

    onMount(async () => {
        boardId = $page.params.id!;

        try {
            // Load user info
            const userResponse = await fetch("/api/auth/me");
            if (!userResponse.ok) {
                goto("/login");
                return;
            }
            const userData = await userResponse.json();
            user = userData.user;

            // Load templates and board data
            const [templatesResponse, boardResponse, cardsResponse] =
                await Promise.all([
                    fetch(`/api/templates`),
                    fetch(`/api/boards/${boardId}`),
                    fetch(`/api/boards/${boardId}/cards`),
                ]);

            // Load templates
            if (templatesResponse.ok) {
                const templatesData = await templatesResponse.json();
                templates = templatesData.templates || [];
            }

            if (!boardResponse.ok) {
                loading = false;
                return;
            }

            const boardData = await boardResponse.json();
            board = boardData.board;
            userRole = boardData.userRole;

            // Ensure board.columns contains all columns for proper client-side filtering
            if (board.allColumns) {
                board.columns = board.allColumns;
            }

            // Update config form with board data
            configForm.name = board.name || "";
            configForm.blameFreeMode = board.blameFreeMode || false;
            configForm.votingAllocation = board.votingAllocation;
            configForm.status = board.status || "draft";

            if (cardsResponse.ok) {
                const cardsData = await cardsResponse.json();
                cards = cardsData.cards || [];
            }

            // Set up SSE connection
            setupSSE();
            loading = false;
        } catch (error) {
            console.error("Error loading board:", error);
            loading = false;
        }
    });

    onDestroy(() => {
        clearSSETimers();
        if (eventSource) {
            eventSource.close();
        }
    });

    function setupSSE() {
        // Clear any existing timers
        clearSSETimers();

        // Set connecting state
        sseConnectionState = "connecting";

        try {
            // Create SSE connection
            const sseUrl = `/api/sse?boardId=${encodeURIComponent(boardId)}`;
            eventSource = new EventSource(sseUrl);

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
                    console.error(
                        "Failed to parse SSE connected message:",
                        error,
                    );
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
                sseConnectionState = "disconnected";

                // Attempt reconnection with exponential backoff
                attemptReconnection();
            };
        } catch (error) {
            console.error("Failed to create SSE connection:", error);
            sseConnectionState = "error";
            attemptReconnection();
        }
    }

    function clearSSETimers() {
        if (sseReconnectTimeout) {
            clearTimeout(sseReconnectTimeout);
            sseReconnectTimeout = null;
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
        console.log("Received presence ping, updating presence");
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
            console.log(`Presence refreshed due to: ${reason}`);
        } catch (error) {
            console.error("Failed to refresh presence:", error);
        }
    }

    function processVotingData(data: VotingData) {
        // Update user votes by card map if provided
        if (data.votes_by_card) {
            const newUserVotes = new Map<string, number>();
            Object.entries(data.votes_by_card).forEach(([cardId, count]) => {
                newUserVotes.set(cardId, count as number);
            });
            userVotesByCard = newUserVotes;
        }

        // Update all users' votes by card map if provided
        if (data.all_votes_by_card) {
            const newAllVotes = new Map<string, number>();
            Object.entries(data.all_votes_by_card).forEach(
                ([cardId, count]) => {
                    newAllVotes.set(cardId, count as number);
                },
            );
            allVotesByCard = newAllVotes;

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

    function attemptReconnection() {
        if (sseReconnectAttempts >= sseMaxReconnectAttempts) {
            console.error(
                "Max SSE reconnection attempts reached, reloading page",
            );
            sseConnectionState = "error";
            // Reload the page as final fallback
            window.location.reload();
            return;
        }

        sseReconnectAttempts++;
        const delay = Math.min(
            1000 * Math.pow(2, sseReconnectAttempts - 1),
            30000,
        ); // Exponential backoff, max 30s

        console.log(
            `SSE reconnection attempt ${sseReconnectAttempts}/${sseMaxReconnectAttempts} in ${delay}ms`,
        );

        sseReconnectTimeout = setTimeout(() => {
            setupSSE();
        }, delay);
    }

    function handleSSEMessage(data: any) {
        switch (data.type) {
            case "presence_ping":
                // Respond to ping by updating presence
                handlePresencePing();
                break;
            case "card_created":
                cards = [...cards, data.card];
                break;
            case "card_updated":
                cards = cards.map((c) =>
                    c.id === data.card.id ? data.card : c,
                );
                break;
            case "card_deleted":
                cards = cards.filter((c) => c.id !== data.card_id);
                break;
            case "scene_changed":
                if (board && data.scene) {
                    // Store previous scene voting and display state
                    const previousScene = board.scenes?.find(
                        (s) => s.id === board.currentSceneId,
                    );
                    const wasVotingAllowed =
                        previousScene?.allowVoting || false;
                    const wereVotesVisible = previousScene?.showVotes || false;

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
                        console.log(
                            "Voting features changed in new scene, refreshing presence and loading vote data",
                            {
                                votingEnabled: isVotingNowAllowed,
                                votesVisible: areVotesNowVisible,
                            },
                        );
                        refreshPresence("voting_enabled");
                        loadUserVotingData();
                    }
                }
                break;
            case "board_updated":
                if (board && data.board) {
                    // Store previous voting allocation
                    const previousVotingAllocation = board.votingAllocation;

                    // Update board metadata while preserving reactive state
                    board.name = data.board.name;
                    board.blameFreeMode = data.board.blameFreeMode;
                    board.votingAllocation = data.board.votingAllocation;
                    board.status = data.board.status;
                    board.updatedAt = data.board.updatedAt;

                    // If voting allocation changed, refresh presence
                    if (
                        previousVotingAllocation !== data.board.votingAllocation
                    ) {
                        console.log(
                            "Voting allocation changed, refreshing presence",
                            {
                                from: previousVotingAllocation,
                                to: data.board.votingAllocation,
                            },
                        );
                        refreshPresence("voting_allocation_changed");
                    }

                    // Update column visibility data if it exists
                    if (data.board.hiddenColumnsByScene) {
                        board.hiddenColumnsByScene =
                            data.board.hiddenColumnsByScene;
                    }

                    // Update config form if it exists
                    if (configForm) {
                        configForm.name = data.board.name || "";
                        configForm.blameFreeMode =
                            data.board.blameFreeMode || false;
                        configForm.votingAllocation =
                            data.board.votingAllocation;
                        configForm.status = data.board.status || "draft";
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
                console.log("Presence update:", data.user_id, data.activity);
                // Refresh connected users count and voting stats
                loadConnectedUsers();
                loadVotingStats();
                break;
            case "user_joined":
                console.log("User joined:", data.user_id);
                // Refresh connected users count and voting stats
                loadConnectedUsers();
                loadVotingStats();
                break;
            case "user_left":
                console.log("User left:", data.user_id);
                // Refresh connected users count and voting stats
                loadConnectedUsers();
                loadVotingStats();
                break;
            case "vote_changed":
                console.log("Vote changed:", data);

                // Update card vote count when votes change
                if (data.card_id && data.vote_count !== undefined) {
                    cards = cards.map((c) =>
                        c.id === data.card_id
                            ? { ...c, voteCount: data.vote_count }
                            : c,
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
                console.log("Voting stats updated:", data);
                // Process voting stats using reusable function
                processVotingData({
                    voting_stats: data.voting_stats,
                });

                // If votes were cleared, clear the user's own votes
                if (data.votes_cleared) {
                    userVotesByCard = new Map<string, number>();
                    // Also reset all card vote counts to 0
                    cards = cards.map((card) => ({
                        ...card,
                        voteCount: 0,
                    }));
                    allVotesByCard = new Map<string, number>();
                }
                break;
            case "all_votes_updated":
                console.log("All votes updated:", data);
                // Process all voting data including stats
                processVotingData({
                    all_votes_by_card: data.all_votes_by_card,
                    voting_stats: data.voting_stats,
                });

                // If votes were cleared, clear the user's own votes
                if (data.votes_cleared) {
                    userVotesByCard = new Map<string, number>();
                }
                break;
        }
    }

    let currentScene = $derived(
        board?.scenes?.find((s: any) => s.id === board.currentSceneId),
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
            const response = await fetch(`/api/boards/${boardId}/scene`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sceneId }),
            });

            if (response.ok) {
                const data = await response.json();
                board.currentSceneId = sceneId;
                // Update the current scene object too
                if (data.scene) {
                    currentScene = data.scene;
                }
                showSceneDropdown = false;
            } else {
                const errorData = await response.json();
                console.error("Failed to change scene:", errorData.error);
            }
        } catch (error) {
            console.error("Failed to change scene:", error);
        }
    }

    async function setupTemplate(template: any) {
        try {
            const response = await fetch(
                `/api/boards/${boardId}/setup-template`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ template: template.id }),
                },
            );

            if (response.ok) {
                // Reload the board data to reflect the changes
                const boardResponse = await fetch(`/api/boards/${boardId}`);
                if (boardResponse.ok) {
                    const boardData = await boardResponse.json();
                    board = boardData.board;
                    userRole = boardData.userRole;

                    // Also reload cards
                    const cardsResponse = await fetch(
                        `/api/boards/${boardId}/cards`,
                    );
                    if (cardsResponse.ok) {
                        const cardsData = await cardsResponse.json();
                        cards = cardsData.cards || [];
                    }
                }
                showTemplateSelector = false;
            } else {
                console.error(
                    "Failed to setup template:",
                    await response.json(),
                );
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
                    const cardsResponse = await fetch(
                        `/api/boards/${boardId}/cards`,
                    );
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
        if (!content.trim() || !currentScene?.allowAddCards) return;

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
                newCardContentByColumn = new Map(newCardContentByColumn); // Trigger reactivity
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
        newCardContentByColumn = new Map(newCardContentByColumn); // Trigger reactivity
    }

    function toggleCardSelection(cardId: string) {
        if (selectedCards.has(cardId)) {
            selectedCards.delete(cardId);
        } else {
            selectedCards.add(cardId);
        }
        selectedCards = new Set(selectedCards);
    }

    async function voteCard(cardId: string, delta: 1 | -1) {
        try {
            const response = await fetch(`/api/cards/${cardId}/vote`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ delta }),
            });

            if (response.ok) {
                const data = await response.json();

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
            }
        } catch (error) {
            console.error("Failed to vote:", error);
        }
    }

    async function commentCard(cardId: string) {
        console.log("Comment on card:", cardId);
    }

    async function loadUserVotingData() {
        if (!boardId || !user?.id) return;

        try {
            // Load user's voting allocation
            const allocationResponse = await fetch(
                `/api/boards/${boardId}/user-votes`,
            );
            if (allocationResponse.ok) {
                const allocationData = await allocationResponse.json();

                // Use reusable process function with new API format
                processVotingData({
                    votes_by_card:
                        allocationData.user_voting_data?.votes_by_card,
                    all_votes_by_card: allocationData.all_votes_by_card,
                    voting_stats: allocationData.voting_stats,
                });
            } else {
                console.error(
                    "Failed to load voting allocation, status:",
                    allocationResponse.status,
                );
                const errorText = await allocationResponse.text();
                console.error("Error response:", errorText);
            }

            // Voting stats and connected users are now included in the main response
            // No need for additional API calls - they're already processed above
        } catch (error) {
            console.error("Failed to load user voting data:", error);
        }
    }

    async function loadVotingStats() {
        if (!boardId) return;

        try {
            const response = await fetch(`/api/boards/${boardId}/voting-stats`);
            if (response.ok) {
                const data = await response.json();
                processVotingData({
                    voting_stats: data.voting_stats,
                });
            }
        } catch (error) {
            console.error("Failed to load voting stats:", error);
        }
    }

    async function loadConnectedUsers() {
        if (!boardId) return;

        try {
            const response = await fetch(`/api/boards/${boardId}/presence`);
            if (response.ok) {
                const data = await response.json();
                // Connected users count is now handled through voting_stats.activeUsers
                connectedUsers = data.presence?.length || 0;
            }
        } catch (error) {
            console.error("Failed to load connected users:", error);
        }
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
                console.log(`Card ${cardId} deleted successfully`);
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
                console.log(`Card ${editingCard.id} updated successfully`);
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
        if (!currentScene?.allowMoveCards) {
            event.preventDefault();
            return;
        }

        draggedCardId = cardId;
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
        }
    }

    function handleDragOver(event: DragEvent, columnId: string) {
        event.preventDefault();

        // Don't allow drop if moving cards is not allowed
        if (!currentScene?.allowMoveCards) {
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
        if (draggedCardId && currentScene?.allowMoveCards) {
            cardDropTargetColumnId = columnId;
        }
    }

    function handleDragLeave(event: DragEvent, columnId: string) {
        event.preventDefault();
        // Only clear if we're leaving the column entirely, not just moving to a child element
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX;
        const y = event.clientY;

        if (
            x < rect.left ||
            x > rect.right ||
            y < rect.top ||
            y > rect.bottom
        ) {
            cardDropTargetColumnId = "";
        }
    }

    async function handleDrop(event: DragEvent, targetColumnId: string) {
        event.preventDefault();

        if (!draggedCardId || !currentScene?.allowMoveCards) {
            draggedCardId = "";
            cardDropTargetColumnId = "";
            return;
        }

        try {
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
                    cards = cards.map((c) =>
                        c.id === draggedCardId ? data.card : c,
                    );
                }
                // For group moves, the WebSocket broadcasts will update the UI
            }
        } catch (error) {
            console.error("Failed to move card:", error);
        }

        draggedCardId = "";
        cardDropTargetColumnId = "";
    }

    async function handleCardDrop(event: DragEvent, targetCardId: string) {
        event.preventDefault();

        if (!draggedCardId || !currentScene?.allowGroupCards) {
            draggedCardId = "";
            return;
        }

        // Don't allow dropping a card onto itself
        if (draggedCardId === targetCardId) {
            draggedCardId = "";
            return;
        }

        try {
            const response = await fetch(
                `/api/cards/${draggedCardId}/group-onto`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ targetCardId: targetCardId }),
                },
            );

            if (response.ok) {
                // Card updates will come through WebSocket
                console.log("Card grouped successfully");
            } else {
                console.error("Failed to group card");
            }
        } catch (error) {
            console.error("Failed to group card:", error);
        }

        draggedCardId = "";
        cardDropTargetColumnId = "";
    }

    async function ungroupCard(cardId: string, targetColumnId: string) {
        try {
            const response = await fetch(`/api/cards/${cardId}/group-onto`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ columnId: targetColumnId }),
            });

            if (response.ok) {
                console.log("Card ungrouped successfully");
            } else {
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
                    const updatedCard = data.cards.find(
                        (c: any) => c.id === card.id,
                    );
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
                goto("/");
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
                const data = await response.json();
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
            const response = await fetch(
                `/api/boards/${boardId}/columns/${columnId}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                },
            );

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
        if (
            !confirm(
                "Are you sure you want to delete this column? All cards in this column will be deleted.",
            )
        )
            return;

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
            }
        } catch (error) {
            console.error("Failed to delete column:", error);
        }
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
        } catch (error) {
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
            const response = await fetch(
                `/api/boards/${boardId}/scenes/${sceneId}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                },
            );

            if (response.ok) {
                const responseData = await response.json();
                const sceneIndex = board.scenes.findIndex(
                    (s: any) => s.id === sceneId,
                );
                if (sceneIndex !== -1) {
                    board.scenes[sceneIndex] = responseData.scene;
                }
            }
        } catch (error) {
            console.error("Failed to update scene:", error);
        }
    }

    async function deleteScene(sceneId: string) {
        if (!confirm("Are you sure you want to delete this scene?")) return;

        try {
            const response = await fetch(
                `/api/boards/${boardId}/scenes/${sceneId}`,
                {
                    method: "DELETE",
                },
            );

            if (response.ok) {
                board.scenes = board.scenes.filter(
                    (s: any) => s.id !== sceneId,
                );
            }
        } catch (error) {
            console.error("Failed to delete scene:", error);
        }
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
            const rect = (
                event.currentTarget as HTMLElement
            )?.getBoundingClientRect();
            if (rect) {
                const midpoint = rect.top + rect.height / 2;
                columnDropPosition =
                    event.clientY < midpoint ? "above" : "below";
            }
        } else if (
            type === "scene" &&
            draggedSceneId &&
            draggedSceneId !== id
        ) {
            dragOverSceneId = id;
            const rect = (
                event.currentTarget as HTMLElement
            )?.getBoundingClientRect();
            if (rect) {
                const midpoint = rect.top + rect.height / 2;
                sceneDropPosition =
                    event.clientY < midpoint ? "above" : "below";
            }
        }
    }

    function handleConfigDragLeave(type: "column" | "scene", event: DragEvent) {
        const rect = (
            event.currentTarget as HTMLElement
        )?.getBoundingClientRect();
        if (!rect) return;
        const x = event.clientX;
        const y = event.clientY;

        if (
            x < rect.left ||
            x > rect.right ||
            y < rect.top ||
            y > rect.bottom
        ) {
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

            const response = await fetch(
                `/api/boards/${boardId}/columns/reorder`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ columnOrders }),
                },
            );

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

            const response = await fetch(
                `/api/boards/${boardId}/scenes/reorder`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sceneOrders }),
                },
            );

            if (response.ok) {
                board.scenes = scenes;
            }
        } catch (error) {
            console.error("Failed to reorder scenes:", error);
        }
    }

    async function handleConfigEndDrop(
        type: "column" | "scene",
        event: DragEvent,
    ) {
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

            const response = await fetch(
                `/api/boards/${boardId}/columns/reorder`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ columnOrders }),
                },
            );

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

            const response = await fetch(
                `/api/boards/${boardId}/scenes/reorder`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sceneOrders }),
                },
            );

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
                        toastStore.error(
                            "Failed to make board active. Please try again.",
                        );
                    }
                } catch (error) {
                    console.error("Error updating board status:", error);
                    toastStore.error("Error updating board. Please try again.");
                }
            });
        } else {
            // Board is active, proceed with sharing
            await copyBoardUrlToClipboard();
        }
    }

    async function copyBoardUrlToClipboard() {
        try {
            const shareUrl = window.location.href;
            await navigator.clipboard.writeText(shareUrl);
            toastStore.success(
                "Board URL copied to clipboard! Anyone with this link can access the board.",
            );
        } catch (error) {
            console.error("Error copying to clipboard:", error);
            toastStore.error(
                "Error copying link to clipboard. Please try again.",
            );
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
        content="TeamBeat - Collaborative Retrospectives"
    />
    <meta property="og:site_name" content="TeamBeat" />

    <!-- Twitter Card tags -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={data.pageTitle} />
    <meta name="twitter:description" content={data.description} />
    <meta name="twitter:image" content="{$page.url.origin}/og-image.svg" />
    <meta
        name="twitter:image:alt"
        content="TeamBeat - Collaborative Retrospectives"
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
{:else}
    <BoardHeader
        {board}
        {userRole}
        {currentScene}
        {showSceneDropdown}
        {connectedUsers}
        userVoteAllocation={votingAllocation || undefined}
        votingStats={votingStats || undefined}
        onConfigureClick={() => (showBoardConfig = true)}
        onShareClick={handleShareBoard}
        onSceneChange={changeScene}
        onShowSceneDropdown={(show) => (showSceneDropdown = show)}
        onIncreaseAllocation={increaseVotingAllocation}
        onResetVotes={resetBoardVotes}
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
                        class="connection-status__indicator connection-status__indicator--disconnected"
                    ></div>
                    <span
                        >Reconnecting... (Attempt {sseReconnectAttempts}/{sseMaxReconnectAttempts})</span
                    >
                {:else}
                    <div
                        class="connection-status__indicator connection-status__indicator--error"
                    ></div>
                    <span>Connection failed - reloading...</span>
                {/if}
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
    {:else}
        <BoardColumns
            board={displayBoard}
            {cards}
            {currentScene}
            {groupingMode}
            {selectedCards}
            dragTargetColumnId={cardDropTargetColumnId}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onCardDrop={handleCardDrop}
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
            {userRole}
            currentUserId={user?.id}
            {hasVotes}
            {userVotesByCard}
            {allVotesByCard}
        />
    {/if}

    <BoardConfigDialog
        {showBoardConfig}
        {userRole}
        bind:configActiveTab
        {board}
        bind:configForm
        onClose={() => (showBoardConfig = false)}
        onTabChange={(tab) => (configActiveTab = tab)}
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

<style lang="less">
    @import "../../../app.less";
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
</style>
