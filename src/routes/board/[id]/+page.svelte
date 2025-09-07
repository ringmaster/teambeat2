<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";

    import BoardHeader from "$lib/components/BoardHeader.svelte";
    import BoardSetup from "$lib/components/BoardSetup.svelte";
    import BoardColumns from "$lib/components/BoardColumns.svelte";
    import BoardConfigDialog from "$lib/components/BoardConfigDialog.svelte";
    import Icon from "$lib/components/ui/Icon.svelte";
    import { toastStore } from "$lib/stores/toast";

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

    // Config Form State
    let configForm = $state({
        name: "",
        blameFreeMode: false,
        votingAllocation: 3,
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

            // Update config form with board data
            configForm.name = board.name || "";
            configForm.blameFreeMode = board.blameFreeMode || false;
            configForm.votingAllocation = board.votingAllocation || 3;
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
                }
                break;
            case "board_updated":
                if (board && data.board) {
                    // Update board metadata while preserving reactive state
                    board.name = data.board.name;
                    board.blameFreeMode = data.board.blameFreeMode;
                    board.votingAllocation = data.board.votingAllocation;
                    board.status = data.board.status;
                    board.updatedAt = data.board.updatedAt;

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
                            data.board.votingAllocation || 3;
                        configForm.status = data.board.status || "draft";
                    }
                }
                break;
            case "columns_updated":
                if (board && data.columns) {
                    board.columns = data.columns;
                }
                break;
            case "user_joined":
                console.log("User joined:", data.user_id);
                break;
            case "user_left":
                console.log("User left:", data.user_id);
                break;
            case "presence_update":
                console.log("Presence update:", data.user_id, data.activity);
                break;
        }
    }

    let currentScene = $derived(
        board?.scenes?.find((s: any) => s.id === board.currentSceneId),
    );

    // Filter columns based on current scene visibility settings
    let visibleColumns = $derived.by(() => {
        if (!board?.columns || !board?.currentSceneId) {
            return board?.columns || [];
        }

        const hiddenColumns =
            board.hiddenColumnsByScene?.[board.currentSceneId] || [];
        return board.columns.filter(
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

    async function voteCard(cardId: string) {
        try {
            const response = await fetch(
                `/api/boards/${boardId}/cards/${cardId}/vote`,
                {
                    method: "POST",
                },
            );

            if (response.ok) {
                const data = await response.json();
                cards = cards.map((c) => (c.id === cardId ? data.card : c));
            }
        } catch (error) {
            console.error("Failed to vote:", error);
        }
    }

    async function commentCard(cardId: string) {
        console.log("Comment on card:", cardId);
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
                const columnIndex = board.columns.findIndex(
                    (c: any) => c.id === columnId,
                );
                if (columnIndex !== -1) {
                    board.columns[columnIndex] = responseData.column;
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
                board.columns = board.columns.filter(
                    (c: any) => c.id !== columnId,
                );
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
            multipleVotesPerCard: false,
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
            multipleVotesPerCard: false,
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
            const columns = [...board.columns];
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
                board.columns = columns;
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
            const columns = [...board.columns];
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
                board.columns = columns;
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
                access.
            </p>
            <p class="board-not-found-message-2">
                If the board is in draft, your admin needs to make it active for
                you to access it.
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
        onConfigureClick={() => (showBoardConfig = true)}
        onShareClick={handleShareBoard}
        onSceneChange={changeScene}
        onShowSceneDropdown={(show) => (showSceneDropdown = show)}
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
    {#if (!board.columns || board.columns.length === 0) && (!board.scenes || board.scenes.length === 0)}
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
            {userRole}
            currentUserId={user?.id}
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
        {dragState}
    />
{/if}

<style type="less">
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
