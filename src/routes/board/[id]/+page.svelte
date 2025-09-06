<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";

    import BoardHeader from "$lib/components/BoardHeader.svelte";
    import BoardSetup from "$lib/components/BoardSetup.svelte";
    import BoardColumns from "$lib/components/BoardColumns.svelte";
    import BoardConfigDialog from "$lib/components/BoardConfigDialog.svelte";

    let board: any = $state(null);
    let cards: any[] = $state([]);
    let user: any = $state(null);
    let userRole = $state("");
    let loading = $state(true);
    let ws: WebSocket | null = null;
    let boardId = $state("");

    // WebSocket Health Monitoring
    let wsConnectionState = $state<
        "connecting" | "connected" | "disconnected" | "error"
    >("disconnected");
    let wsReconnectAttempts = $state(0);
    let wsMaxReconnectAttempts = 5;
    let wsPingInterval: number | null = null;
    let wsReconnectTimeout: number | null = null;
    let wsLastPongTime = 0;

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

            // Set up WebSocket connection
            setupWebSocket();
            loading = false;
        } catch (error) {
            console.error("Error loading board:", error);
            loading = false;
        }
    });

    onDestroy(() => {
        clearWebSocketTimers();
        if (ws) {
            ws.close();
        }
    });

    function setupWebSocket() {
        // Clear any existing timers
        clearWebSocketTimers();

        // Set connecting state
        wsConnectionState = "connecting";

        const wsProtocol =
            window.location.protocol === "https:" ? "wss:" : "ws:";
        // Connect to WebSocket server on port 8080 with session parameter
        const wsUrl = `${wsProtocol}//${window.location.hostname}:8080?session=${encodeURIComponent(document.cookie.split("session=")[1]?.split(";")[0] || "")}`;

        try {
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log("WebSocket connected");
                wsConnectionState = "connected";
                wsReconnectAttempts = 0;
                wsLastPongTime = Date.now();

                // Join the board to receive updates
                if (ws && user) {
                    ws.send(
                        JSON.stringify({
                            type: "join_board",
                            board_id: boardId,
                            user_id: user.id,
                        }),
                    );
                }

                // Start ping/pong health checks
                startWebSocketHealthCheck();
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    handleWebSocketMessage(data);
                } catch (error) {
                    console.error("Failed to parse WebSocket message:", error);
                }
            };

            ws.onclose = (event) => {
                console.log("WebSocket disconnected", {
                    code: event.code,
                    reason: event.reason,
                });
                wsConnectionState = "disconnected";
                clearWebSocketTimers();

                // Attempt reconnection with exponential backoff
                attemptReconnection();
            };

            ws.onerror = (error) => {
                console.error("WebSocket error:", error);
                wsConnectionState = "error";
            };
        } catch (error) {
            console.error("Failed to create WebSocket:", error);
            wsConnectionState = "error";
            attemptReconnection();
        }
    }

    function clearWebSocketTimers() {
        if (wsPingInterval) {
            clearInterval(wsPingInterval);
            wsPingInterval = null;
        }
        if (wsReconnectTimeout) {
            clearTimeout(wsReconnectTimeout);
            wsReconnectTimeout = null;
        }
    }

    function startWebSocketHealthCheck() {
        // Send ping every 30 seconds
        wsPingInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "ping" }));

                // Check if we haven't received a pong in the last 60 seconds
                if (Date.now() - wsLastPongTime > 60000) {
                    console.warn(
                        "WebSocket health check failed - no pong received",
                    );
                    ws.close();
                }
            }
        }, 30000);
    }

    function attemptReconnection() {
        if (wsReconnectAttempts >= wsMaxReconnectAttempts) {
            console.error(
                "Max WebSocket reconnection attempts reached, reloading page",
            );
            wsConnectionState = "error";
            // Reload the page as final fallback
            window.location.reload();
            return;
        }

        wsReconnectAttempts++;
        const delay = Math.min(
            1000 * Math.pow(2, wsReconnectAttempts - 1),
            30000,
        ); // Exponential backoff, max 30s

        console.log(
            `WebSocket reconnection attempt ${wsReconnectAttempts}/${wsMaxReconnectAttempts} in ${delay}ms`,
        );

        wsReconnectTimeout = setTimeout(() => {
            setupWebSocket();
        }, delay);
    }

    function handleWebSocketMessage(data: any) {
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
                cards = cards.filter((c) => c.id !== data.cardId);
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
            case "pong":
                // Update last pong time for health monitoring
                wsLastPongTime = Date.now();
                break;
        }
    }

    let currentScene = $derived(board?.scenes?.find((s: any) => s.id === board.currentSceneId));

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
            const response = await fetch(`/api/cards/${draggedCardId}/group-onto`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ targetCardId: targetCardId }),
            });

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
        try {
            // Simply copy the current board URL
            const shareUrl = window.location.href;

            // Copy to clipboard
            await navigator.clipboard.writeText(shareUrl);

            // Show success message
            alert(
                "Board URL copied to clipboard! Anyone with this link can access the board.",
            );
        } catch (error) {
            console.error("Error copying to clipboard:", error);
            alert("Error copying link. Please try again.");
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
    <div class="min-h-screen flex items-center justify-center">
        <div
            class="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"
        ></div>
    </div>
{:else if !board}
    <div class="min-h-screen flex items-center justify-center">
        <div class="text-center">
            <div
                class="w-20 h-20 bg-gradient-to-br from-red-500/10 to-pink-500/10 rounded-full flex items-center justify-center mx-auto mb-4"
            >
                <svg
                    class="w-10 h-10 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                </svg>
            </div>
            <p class="text-xl font-semibold text-gray-900 mb-2">
                Board not found
            </p>
            <p class="text-gray-600 mb-4">
                The board you're looking for doesn't exist or you don't have
                access.
            </p>
            <a href="/" class="btn-primary">Go to Dashboard</a>
        </div>
    </div>
{:else}
    <div class="flex flex-grow flex-col h-full max-h-screen overflow-hidden">
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
        {#if wsConnectionState !== "connected"}
            <div
                class="fixed top-4 right-4 z-50 px-3 py-2 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 {wsConnectionState ===
                'connecting'
                    ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                    : wsConnectionState === 'disconnected'
                      ? 'bg-orange-100 text-orange-800 border border-orange-200'
                      : 'bg-red-100 text-red-800 border border-red-200'}"
            >
                <div class="flex items-center space-x-2">
                    {#if wsConnectionState === "connecting"}
                        <div
                            class="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"
                        ></div>
                        <span>Connecting...</span>
                    {:else if wsConnectionState === "disconnected"}
                        <div
                            class="w-3 h-3 bg-orange-500 rounded-full animate-pulse"
                        ></div>
                        <span
                            >Reconnecting... (Attempt {wsReconnectAttempts}/{wsMaxReconnectAttempts})</span
                        >
                    {:else}
                        <div class="w-3 h-3 bg-red-500 rounded-full"></div>
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
                {board}
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
    </div>

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
