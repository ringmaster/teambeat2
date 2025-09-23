<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import Card from "$lib/components/Card.svelte";
    import type {
        Board,
        Scene,
        Card as CardType,
        Comment,
        User,
    } from "$lib/types";

    export let board: Board;
    export let scene: Scene;
    export let currentUser: User;
    export let cards: CardType[] = [];
    export let selectedCard: CardType | null = null;
    export let comments: Comment[] = [];
    export let agreements: Comment[] = [];
    export let isAdmin: boolean = false;
    export let isFacilitator: boolean = false;

    let notesContent: string = "";
    let notesLocked: boolean = false;
    let notesLockedBy: string | null = null;
    let editingNotes: boolean = false;
    let newCommentContent: string = "";
    let cardsListElement: HTMLElement;

    const canSelectCards = isAdmin || isFacilitator;

    function scrollCardsList(direction: "up" | "down") {
        if (!cardsListElement) return;
        const scrollAmount = 200;
        if (direction === "up") {
            cardsListElement.scrollBy({
                top: -scrollAmount,
                behavior: "smooth",
            });
        } else {
            cardsListElement.scrollBy({
                top: scrollAmount,
                behavior: "smooth",
            });
        }
    }

    async function selectCard(cardId: string) {
        if (!canSelectCards) return;

        try {
            const response = await fetch(
                `/api/scenes/${scene.id}/select-card`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ card_id: cardId }),
                },
            );

            if (!response.ok) {
                const error = await response.json();
                console.error("Failed to select card:", error.error);
            }
        } catch (error) {
            console.error("Error selecting card:", error);
        }
    }

    async function startEditingNotes() {
        if (!selectedCard || notesLocked) return;

        try {
            const response = await fetch(
                `/api/cards/${selectedCard.id}/notes/lock`,
                {
                    method: "POST",
                },
            );

            const result = await response.json();
            if (result.success) {
                editingNotes = true;
                notesContent = selectedCard.notes || "";
            } else {
                notesLocked = true;
                notesLockedBy = result.locked_by;
            }
        } catch (error) {
            console.error("Error acquiring notes lock:", error);
        }
    }

    async function saveNotes() {
        if (!selectedCard || !editingNotes) return;

        try {
            const response = await fetch(
                `/api/cards/${selectedCard.id}/notes`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content: notesContent }),
                },
            );

            if (response.ok) {
                editingNotes = false;
                if (selectedCard) {
                    selectedCard.notes = notesContent;
                }
            }
        } catch (error) {
            console.error("Error saving notes:", error);
        }
    }

    async function toggleAgreement(commentId: string, isAgreement: boolean) {
        try {
            const response = await fetch(
                `/api/comments/${commentId}/toggle-agreement`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ is_agreement: !isAgreement }),
                },
            );

            if (!response.ok) {
                const error = await response.json();
                console.error("Failed to toggle agreement:", error.error);
            }
        } catch (error) {
            console.error("Error toggling agreement:", error);
        }
    }

    async function addComment() {
        if (!selectedCard || !newCommentContent.trim() || !scene.allowComments)
            return;

        try {
            const response = await fetch("/api/comments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    card_id: selectedCard.id,
                    content: newCommentContent,
                    is_agreement: false,
                }),
            });

            if (response.ok) {
                newCommentContent = "";
            }
        } catch (error) {
            console.error("Error adding comment:", error);
        }
    }
</script>

<div class="present-mode">
    <!-- Left Panel - Presentation Area (70%) -->
    <div class="presentation-panel">
        {#if selectedCard}
            <div class="selected-card-content">
                <div class="card-content-display">
                    {selectedCard.content}
                </div>
            </div>

            <div class="notes-section">
                <h3 class="section-title">Notes:</h3>
                {#if editingNotes}
                    <textarea
                        class="notes-editor"
                        bind:value={notesContent}
                        on:blur={saveNotes}
                        placeholder="Add notes..."
                        rows="6"
                    />
                {:else if notesLocked}
                    <div class="notes-locked">
                        <span class="lock-icon">🔒</span>
                        Locked by {notesLockedBy}
                    </div>
                    <div class="notes-display" on:click={startEditingNotes}>
                        {selectedCard.notes || "Click to add notes..."}
                    </div>
                {:else}
                    <div
                        class="notes-display editable"
                        on:click={startEditingNotes}
                    >
                        {selectedCard.notes || "Click to add notes..."}
                    </div>
                {/if}
            </div>

            {#if scene.showComments}
                <div class="comments-section">
                    <h3 class="section-title">Comments:</h3>
                    {#if scene.allowComments}
                        <div class="add-comment">
                            <input
                                type="text"
                                class="comment-input"
                                bind:value={newCommentContent}
                                on:keydown={(e) =>
                                    e.key === "Enter" && addComment()}
                                placeholder="Add a comment..."
                            />
                            <button
                                class="add-comment-button"
                                on:click={addComment}
                            >
                                Add
                            </button>
                        </div>
                    {/if}
                    <div class="comments-list">
                        {#each comments as comment (comment.id)}
                            <div class="comment">
                                <div class="comment-content">
                                    {comment.content}
                                </div>
                                <div class="comment-meta">
                                    <span class="comment-author"
                                        >{comment.userName}</span
                                    >
                                    <button
                                        class="agreement-toggle"
                                        on:click={() =>
                                            toggleAgreement(comment.id, false)}
                                        title="Promote to Agreement"
                                    >
                                        ↑ Promote
                                    </button>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            {#if scene.showComments}
                <div class="agreements-section">
                    <h3 class="section-title">Agreements:</h3>
                    {#if agreements.length === 0}
                        <div class="empty-agreements">
                            <div class="empty-agreements-box">
                                <span class="plus-icon">+</span>
                            </div>
                            <p class="empty-text">No agreements yet.</p>
                        </div>
                    {:else}
                        <div class="agreements-list">
                            {#each agreements as agreement (agreement.id)}
                                <div class="agreement">
                                    <div class="agreement-content">
                                        {agreement.content}
                                    </div>
                                    <div class="agreement-meta">
                                        <span class="agreement-author"
                                            >{agreement.userName}</span
                                        >
                                        <button
                                            class="agreement-toggle"
                                            on:click={() =>
                                                toggleAgreement(
                                                    agreement.id,
                                                    true,
                                                )}
                                            title="Demote to Comment"
                                        >
                                            ↓ Demote
                                        </button>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/if}
        {:else}
            <div class="no-selection">
                <p class="no-selection-message">No card selected</p>
                {#if canSelectCards}
                    <p class="no-selection-hint">
                        Select a card from the right panel to begin presenting
                    </p>
                {:else}
                    <p class="no-selection-hint">
                        Waiting for facilitator to select a card
                    </p>
                {/if}
            </div>
        {/if}
    </div>

    <!-- Right Panel - Card Selection (30%) -->
    <div class="card-selection-panel">
        <div class="cards-list" bind:this={cardsListElement}>
            {#each cards as card (card.id)}
                {@const isSubordinate = card.groupId && !card.isGroupLead}
                <div
                    class="card-wrapper"
                    class:selected={selectedCard?.id === card.id}
                    class:subordinate={isSubordinate}
                >
                    {#if !isSubordinate}
                        {#if canSelectCards}
                            <button
                                aria-label="Select Card"
                                class="selection-button"
                                class:active={selectedCard?.id === card.id}
                                on:click={() => selectCard(card.id)}
                            >
                                <span class="selection-indicator">‹</span>
                            </button>
                        {:else if selectedCard?.id === card.id}
                            <div class="selection-indicator-static">
                                <span class="selection-indicator active">‹</span
                                >
                            </div>
                        {:else}
                            <div class="selection-indicator-static">
                                <span class="selection-indicator">‹</span>
                            </div>
                        {/if}
                    {/if}
                    <div class="card-container">
                        <Card
                            {card}
                            {board}
                            currentScene={scene}
                            currentUserId={currentUser.id}
                            userRole={isAdmin
                                ? "admin"
                                : isFacilitator
                                  ? "facilitator"
                                  : "member"}
                            readOnly={true}
                            isGroupLead={!!card.isGroupLead}
                            isSubordinate={!!(
                                card.groupId && !card.isGroupLead
                            )}
                            groupingMode={false}
                            isSelected={false}
                            userVotesOnCard={card.userVoted ? 1 : 0}
                            allUsersVotesOnCard={card.voteCount}
                            hasVotes={true}
                            onDragStart={() => {}}
                            onToggleSelection={() => {}}
                            onVote={() => {}}
                            onComment={() => {}}
                            onDelete={() => {}}
                            onEdit={() => {}}
                            onCardDrop={() => {}}
                        />
                    </div>
                </div>
            {/each}
        </div>
    </div>
</div>

<style lang="less">
    @import "../../_mixins.less";
    .present-mode {
        display: flex;
        height: 100%;
        gap: var(--spacing-6);
        padding: var(--spacing-6);
        background: var(--color-bg-primary);
    }

    // Left panel - 70% width for presentation
    .presentation-panel {
        flex: 0 0 70%;
        background: white;
        border-radius: var(--radius-md);
        padding: 40px;
        overflow-y: auto;
        border: 1px solid var(--color-border);
    }

    // Right panel - 30% width for card selection
    .card-selection-panel {
        flex: 0 0 30%;
        padding: 20px;
        overflow-y: auto;
        position: relative;
    }

    .panel-title {
        font-size: 1.125rem;
        font-weight: 600;
        margin-bottom: var(--spacing-4);
        color: var(--color-text-primary);
    }

    .cards-list {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-3);
    }

    .card-wrapper {
        display: flex;
        align-items: flex-start;
        position: relative;
        padding-left: 36px; // Space for selection button

        &.subordinate {
            padding-left: 36px; // No extra indent since no selection button
        }

        &.selected .card-container {
            position: relative;

            &::after {
                content: "";
                position: absolute;
                inset: -4px;
                background: var(--color-accent);
                border: 2px solid var(--color-accent);
                border-radius: var(--radius-md);
                opacity: 0.3;
                pointer-events: none;
                z-index: -1;
            }
        }
    }

    .selection-button {
        position: absolute;
        left: 0;
        top: var(--spacing-3);
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid var(--color-border);
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;

        &:hover:not(.active) {
            border-color: var(--color-accent);
            background: var(--surface-hover);
        }

        &.active {
            border-color: var(--color-accent);
            background: var(--color-accent);
        }
    }

    .selection-indicator-static {
        position: absolute;
        left: 0;
        top: var(--spacing-3);
        width: 24px;
        height: 24px;
        border: 2px solid var(--color-gray-300);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;

        .selection-indicator {
            color: var(--color-text-muted);

            &.active {
                color: var(--color-accent);
            }
        }
    }

    .selection-indicator {
        font-size: 1.25rem;
        line-height: 1;
        color: transparent;
        font-weight: bold;

        &.active {
            color: white;
        }
    }

    .selection-button:not(.active) .selection-indicator {
        color: var(--color-text-muted);
    }

    .selection-button.active {
        .selection-indicator {
            color: white;
        }
    }

    .card-container {
        flex: 1;
        width: 100%;

        // Style adjustments for grouped cards in present mode
        :global(.card.group-lead) {
            // Group lead cards can have a visual indicator if needed
        }

        :global(.card.subordinate) {
            margin-left: var(--spacing-4);
            opacity: 0.9;
        }
    }

    // Presentation panel styles
    .selected-card-content {
        margin-bottom: var(--spacing-6);
    }

    .card-title {
        font-size: 1.75rem;
        font-weight: 600;
        margin-bottom: var(--spacing-4);
        color: var(--color-text-primary);
    }

    .card-content-display {
        font-size: 1.125rem;
        line-height: 1.6;
        color: var(--color-text-primary);
        padding: var(--spacing-4);
        background: var(--surface-elevated);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
    }

    .vote-count {
        font-size: 1rem;
        color: var(--color-text-muted);
        display: flex;
        align-items: center;
        gap: var(--spacing-2);

        .vote-icon {
            font-size: 1.25rem;
        }
    }

    .notes-section,
    .comments-section,
    .agreements-section {
        margin-bottom: var(--spacing-8);
    }

    .section-title {
        font-size: 1rem;
        font-weight: 500;
        margin-bottom: var(--spacing-3);
        color: var(--color-text-secondary);
    }

    .notes-display {
        padding: var(--spacing-4);
        background: var(--surface-elevated);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        min-height: 100px;
        white-space: pre-wrap;
        color: var(--color-text-primary);
        font-size: 0.9375rem;
        line-height: 1.5;

        &.editable {
            cursor: text;
            transition: all 0.2s;

            &:hover {
                background: white;
                border-color: var(--color-border);
            }
        }
    }

    .notes-editor {
        width: 100%;
        min-height: 150px;
        padding: var(--spacing-4);
        border: 2px solid var(--color-accent);
        border-radius: var(--radius-md);
        font-family: inherit;
        font-size: 1rem;
        line-height: 1.6;
        resize: vertical;
    }

    .notes-locked {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        padding: var(--spacing-3);
        background: var(--status-warning-bg);
        border-radius: var(--radius-md);
        margin-bottom: var(--spacing-3);
        color: var(--status-warning-text);
        font-size: 0.9375rem;
    }

    .add-comment {
        display: flex;
        gap: var(--spacing-3);
        margin-bottom: var(--spacing-4);
    }

    .comment-input {
        flex: 1;
        padding: var(--spacing-3) var(--spacing-4);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        font-size: 0.9375rem;

        &:focus {
            outline: none;
            border-color: var(--color-accent);
            box-shadow: 0 0 0 3px var(--surface-hover);
        }
    }

    .add-comment-button {
        padding: var(--spacing-3) var(--spacing-5);
        background: var(--color-accent);
        color: white;
        border: none;
        border-radius: var(--radius-md);
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;

        &:hover {
            background: var(--color-accent-hover);
        }
    }

    .comments-list,
    .agreements-list {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-3);
    }

    .comment,
    .agreement {
        padding: var(--spacing-4);
        background: var(--surface-elevated);
        border-radius: var(--radius-md);
        border: 1px solid var(--color-border);
    }

    .comment-content,
    .agreement-content {
        margin-bottom: var(--spacing-3);
        color: var(--color-text-primary);
        line-height: 1.5;
    }

    .comment-meta,
    .agreement-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.875rem;
        color: var(--color-text-muted);
    }

    .agreement-toggle {
        padding: var(--spacing-1) var(--spacing-3);
        background: white;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all 0.2s;
        font-size: 0.8125rem;
        font-weight: 500;

        &:hover {
            background: var(--surface-hover);
            border-color: var(--color-border-hover);
        }
    }

    .agreement {
        background: var(--status-success-bg);
        border-color: var(--color-success);

        .agreement-content {
            color: var(--status-success-text);
        }
    }

    .no-selection {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        text-align: center;
        color: var(--color-text-muted);
    }

    .no-selection-message {
        font-size: 1.5rem;
        font-weight: 500;
        margin-bottom: var(--spacing-3);
        color: var(--color-text-muted);
    }

    .no-selection-hint {
        font-size: 1rem;
        color: var(--color-text-muted);
        max-width: 400px;
    }

    .empty-agreements {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 2rem;

        .empty-agreements-box {
            width: 3rem;
            height: 3rem;
            border: 2px dashed var(--color-border);
            border-radius: 0.5rem;
            display: flex;
            align-items: center;
            justify-content: center;

            .plus-icon {
                font-size: 1.5rem;
                color: var(--color-text-muted);
            }
        }

        .empty-text {
            color: var(--color-text-muted);
            font-size: 0.875rem;
        }
    }

    .nav-arrow {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: white;
        border: 1px solid var(--color-border);
        border-radius: 50%;
        width: 2rem;
        height: 2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        z-index: 10;

        &:hover {
            background: var(--surface-hover);
            border-color: var(--color-primary);
        }

        &.nav-arrow-left {
            left: -1rem;
        }

        &.nav-arrow-right {
            right: -1rem;
        }

        span {
            font-size: 1.25rem;
            line-height: 1;
            color: var(--color-text-muted);
        }

        &:hover span {
            color: var(--color-text-primary);
        }
    }
</style>
