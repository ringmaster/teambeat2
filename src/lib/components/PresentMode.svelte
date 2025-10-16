<script lang="ts">
    import { onMount } from "svelte";
    import { fade, scale } from "svelte/transition";
    import Card from "$lib/components/Card.svelte";
    import { getUserDisplayName } from "$lib/utils/animalNames";
    import { getSceneCapability } from "$lib/utils/scene-capability";
    import { marked } from 'marked';
    import type {
        Board,
        Scene,
        Card as CardType,
        Comment,
        User,
    } from "$lib/types";

    // Configure marked for GitHub-flavored markdown
    marked.setOptions({
        gfm: true,
        breaks: true,
    });

    // Extended Card type with enriched data
    interface EnrichedCard extends CardType {
        reactions?: Record<string, number>;
        userName?: string;
    }

    // Extended Comment type
    interface EnrichedComment extends Comment {
        isReaction?: boolean;
    }

    interface Props {
        board: Board;
        scene: Scene;
        currentUser: User;
        cards?: EnrichedCard[];
        selectedCard?: EnrichedCard | null;
        comments?: EnrichedComment[];
        agreements?: EnrichedComment[];
        isAdmin?: boolean;
        isFacilitator?: boolean;
        notesLockStatus?: {
            locked: boolean;
            locked_by: string | null;
        } | null;
        onVoteCard?: (cardId: string, delta: 1 | -1) => void;
        onCommentCard?: (cardId: string) => void;
        onDeleteCard?: (cardId: string) => void;
        onEditCard?: (cardId: string) => void;
        onReaction?: (cardId: string, emoji: string) => void;
    }

    let {
        board,
        scene,
        currentUser,
        cards = [],
        selectedCard = null,
        comments = [],
        agreements = [],
        isAdmin = false,
        isFacilitator = false,
        notesLockStatus = null,
        onVoteCard,
        onCommentCard,
        onDeleteCard,
        onEditCard,
        onReaction,
    }: Props = $props();

    let notesContent = $state("");
    let notesLocked = $state(false);
    let notesLockedBy = $state<string | null>(null);
    let hasTyped = $state(false);
    let acquiringLock = $state(false);
    let textareaHasFocus = $state(false);
    let newCommentContent = $state("");
    let cardsListElement = $state<HTMLElement>();
    let notesTextarea = $state<HTMLTextAreaElement>();

    const canSelectCards = isAdmin || isFacilitator;

    // Render selected card content as markdown
    const renderedCardContent = $derived(selectedCard ? marked.parse(selectedCard.content) as string : '');

    // Check if comments/notes are allowed based on scene capabilities and board status
    const canComment = $derived(
        getSceneCapability(scene, board.status, 'allow_comments')
    );

    const showComments = $derived(
        getSceneCapability(scene, board.status, 'show_comments')
    );

    const showVotes = $derived(
        getSceneCapability(scene, board.status, 'show_votes')
    );

    // Filter reactions from regular comments
    const regularComments = $derived(
        comments.filter((comment) => !comment.isReaction),
    );

    // Get reactions for the selected card
    const cardReactions = $derived(selectedCard?.reactions || {});

    // Initialize notes content when selected card changes (only if user isn't actively editing)
    $effect(() => {
        if (selectedCard && !hasTyped && !acquiringLock && !textareaHasFocus) {
            notesContent = selectedCard.notes || "";
            notesLocked = false;
            notesLockedBy = null;
        }
    });

    // Auto-resize textarea when content changes
    $effect(() => {
        if (notesTextarea && notesContent !== undefined) {
            setTimeout(() => {
                if (notesTextarea) {
                    autoResizeTextarea(notesTextarea);
                }
            }, 0);
        }
    });

    // Update lock state from SSE messages - NEVER update notesContent if user is typing
    $effect(() => {
        if (notesLockStatus !== null && selectedCard) {
            const lockOwner = notesLockStatus.locked_by;
            const isCurrentUserLock =
                lockOwner === (currentUser.name || currentUser.email);

            if (notesLockStatus.locked) {
                if (isCurrentUserLock) {
                    // Current user has the lock - they can edit freely
                    notesLocked = false;
                    notesLockedBy = null;
                    if (!hasTyped && !acquiringLock) {
                        hasTyped = true;
                    }
                    // ABSOLUTELY NEVER update notesContent when current user has the lock
                } else {
                    // Someone else has the lock - force readonly
                    notesLocked = true;
                    notesLockedBy = lockOwner;
                    hasTyped = false;
                    // Only update content if we're switching from no lock to locked by other
                    // and user wasn't in the middle of typing
                    if (!acquiringLock) {
                        notesContent = selectedCard.notes || "";
                    }
                }
            } else {
                // No lock active
                notesLocked = false;
                notesLockedBy = null;
                // NEVER update content if user is typing, acquiring lock, or has focus
                // Only update if user has completely finished their session
                if (
                    !hasTyped &&
                    !acquiringLock &&
                    !notesLocked &&
                    !textareaHasFocus
                ) {
                    notesContent = selectedCard.notes || "";
                }
                // Only reset hasTyped if user has completely stopped editing
                if (
                    hasTyped &&
                    !acquiringLock &&
                    !notesLocked &&
                    !textareaHasFocus
                ) {
                    hasTyped = false;
                }
            }
        }
    });

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

    async function acquireNotesLock() {
        if (!selectedCard || notesLocked || hasTyped || acquiringLock || !canComment) return;

        try {
            acquiringLock = true;
            const response = await fetch(
                `/api/cards/${selectedCard.id}/notes/lock`,
                {
                    method: "POST",
                },
            );

            const result = await response.json();
            if (result.success) {
                // Current user now has the lock - they can edit freely
                notesLocked = false;
                notesLockedBy = null;
                hasTyped = true;
                // DO NOT update notesContent - preserve user's input
            } else {
                // Someone else has the lock (403 response)
                if (
                    result.present_mode_data &&
                    result.present_mode_data.notes_lock
                ) {
                    notesLocked = result.present_mode_data.notes_lock.locked;
                    notesLockedBy =
                        result.present_mode_data.notes_lock.locked_by;
                } else {
                    notesLocked = true;
                    notesLockedBy = result.locked_by;
                }
                hasTyped = false;
                // Force overwrite content when lock acquisition fails - show server state
                notesContent = selectedCard?.notes || "";
            }
        } catch (error) {
            console.error("Error acquiring notes lock:", error);
        } finally {
            acquiringLock = false;
        }
    }

    function autoResizeTextarea(textarea: HTMLTextAreaElement) {
        textarea.style.height = "auto";
        textarea.style.height = Math.max(textarea.scrollHeight, 150) + "px";
    }

    async function onNotesInput(event: Event) {
        // Auto-resize textarea
        const textarea = event.target as HTMLTextAreaElement;
        autoResizeTextarea(textarea);

        // Acquire lock on first keystroke
        if (!hasTyped && !notesLocked && !acquiringLock) {
            await acquireNotesLock();
        }
    }

    onMount(() => {
        if (notesTextarea && notesContent) {
            autoResizeTextarea(notesTextarea);
        }
    });

    async function saveNotes() {
        if (!selectedCard || !hasTyped) return;

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
                // Reset editing state - user must type again to edit
                hasTyped = false;
                notesLocked = false;
                notesLockedBy = null;

                if (selectedCard) {
                    selectedCard.notes = notesContent;
                }
                // Content and lock status will be updated via SSE broadcast
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
        if (!selectedCard || !newCommentContent.trim() || !canComment)
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

    async function addReaction(emoji: string) {
        if (!selectedCard || !canComment) return;

        try {
            const response = await fetch("/api/comments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    card_id: selectedCard.id,
                    content: emoji,
                    is_reaction: true,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                console.error("Failed to add reaction:", error.error);
            }
        } catch (error) {
            console.error("Error adding reaction:", error);
        }
    }

    async function deleteComment(commentId: string) {
        try {
            const response = await fetch(`/api/comments/${commentId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const error = await response.json();
                console.error("Failed to delete comment:", error.error);
            }
        } catch (error) {
            console.error("Error deleting comment:", error);
        }
    }
</script>

<div class="present-mode">
    <!-- Left Panel - Presentation Area (70%) -->
    <div class="presentation-panel">
        {#if selectedCard}
            <div class="selected-card-content">
                <div class="card-content-with-votes">
                    <div class="card-content-display markdown">
                        {@html renderedCardContent}
                    </div>
                    {#if showVotes && selectedCard.voteCount !== undefined}
                        {#key selectedCard.id}
                            <div class="vote-count-box">
                                <div class="vote-count-number">
                                    {selectedCard.voteCount}
                                </div>
                                <div class="vote-count-label">
                                    {selectedCard.voteCount === 1
                                        ? "vote"
                                        : "votes"}
                                </div>
                            </div>
                        {/key}
                    {/if}
                </div>
                {#if selectedCard.userName}
                    <div class="card-author">
                        {getUserDisplayName(
                            selectedCard.userName,
                            board.id,
                            board.blameFreeMode,
                        )}
                    </div>
                {/if}
            </div>

            <div class="notes-section">
                <h3 class="section-title">Notes:</h3>
                <div class="notes-editor-container">
                    <textarea
                        class="notes-editor"
                        bind:this={notesTextarea}
                        bind:value={notesContent}
                        oninput={onNotesInput}
                        onfocus={() => (textareaHasFocus = true)}
                        onblur={() => (textareaHasFocus = false)}
                        placeholder={canComment ? "Add notes..." : "Notes (read-only)"}
                        readonly={notesLocked || !canComment}
                        rows="6"
                        style="resize: none; overflow: hidden; min-height: 150px;"
                    ></textarea>
                    {#if hasTyped}
                        <button class="notes-save-button" onclick={saveNotes}>
                            Save
                        </button>
                    {:else if notesLocked && notesLockedBy}
                        <div class="notes-lock-indicator">
                            {notesLockedBy} is editing...
                        </div>
                    {/if}
                </div>
            </div>

            {#if showComments && agreements.length > 0}
                <div class="agreements-section">
                    <h3 class="section-title">Agreements:</h3>
                    <div class="agreements-list">
                        {#each agreements as agreement (agreement.id)}
                            <div
                                class="agreement"
                                transition:fade={{ duration: 200 }}
                            >
                                <div class="agreement-content">
                                    {agreement.content}
                                </div>
                                <div class="agreement-meta">
                                    <span class="agreement-author"
                                        >{agreement.userName}</span
                                    >
                                    <div class="comment-actions">
                                        {#if (isAdmin || isFacilitator) && canComment}
                                            <button
                                                class="agreement-toggle"
                                                onclick={() =>
                                                    toggleAgreement(
                                                        agreement.id,
                                                        true,
                                                    )}
                                                title="Demote to Comment"
                                            >
                                                ↓ Demote
                                            </button>
                                        {/if}
                                        {#if (isAdmin || isFacilitator || agreement.userId === currentUser.id) && canComment}
                                            <button
                                                class="delete-button"
                                                onclick={() =>
                                                    deleteComment(agreement.id)}
                                                title="Delete Agreement"
                                            >
                                                ×
                                            </button>
                                        {/if}
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            {#if showComments}
                <div class="comments-section">
                    <div class="comments-header">
                        <h3 class="section-title">Comments:</h3>
                        {#if Object.keys(cardReactions).length > 0}
                            <div class="reaction-pills">
                                {#each Object.entries(cardReactions) as [emoji, count]}
                                    {#if canComment}
                                        <button
                                            class="reaction-pill clickable"
                                            title="Click to add {emoji} reaction ({count} total)"
                                            onclick={(e) => {
                                                e.stopPropagation();
                                                addReaction(emoji);
                                            }}
                                        >
                                            <span class="reaction-emoji"
                                                >{emoji}</span
                                            >
                                            <span class="reaction-count"
                                                >{count}</span
                                            >
                                        </button>
                                    {:else}
                                        <span
                                            class="reaction-pill"
                                            title="{count} {emoji} reaction{count !==
                                            1
                                                ? 's'
                                                : ''}"
                                        >
                                            <span class="reaction-emoji"
                                                >{emoji}</span
                                            >
                                            <span class="reaction-count"
                                                >{count}</span
                                            >
                                        </span>
                                    {/if}
                                {/each}
                            </div>
                        {/if}
                    </div>
                    {#if canComment}
                        <div class="add-comment">
                            <input
                                type="text"
                                class="comment-input"
                                bind:value={newCommentContent}
                                onkeydown={(e) => {
                                    if (e.key === "Enter") addComment();
                                }}
                                placeholder="Add a comment..."
                            />
                            <button
                                class="add-comment-button"
                                onclick={addComment}
                            >
                                Add
                            </button>
                        </div>
                    {/if}
                    <div class="comments-list">
                        {#each regularComments as comment (comment.id)}
                            <div
                                class="comment"
                                transition:fade={{ duration: 200 }}
                            >
                                <div class="comment-content">
                                    {comment.content}
                                </div>
                                <div class="comment-meta">
                                    <span class="comment-author"
                                        >{comment.userName}</span
                                    >
                                    <div class="comment-actions">
                                        {#if (isAdmin || isFacilitator) && canComment}
                                            <button
                                                class="agreement-toggle"
                                                onclick={() =>
                                                    toggleAgreement(
                                                        comment.id,
                                                        false,
                                                    )}
                                                title="Promote to Agreement"
                                            >
                                                ↑ Promote
                                            </button>
                                        {/if}
                                        {#if (isAdmin || isFacilitator || comment.userId === currentUser.id) && canComment}
                                            <button
                                                class="delete-button"
                                                onclick={() =>
                                                    deleteComment(comment.id)}
                                                title="Delete Comment"
                                            >
                                                ×
                                            </button>
                                        {/if}
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
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
                                onclick={() => selectCard(card.id)}
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
                            onVote={onVoteCard || (() => {})}
                            onComment={onCommentCard || (() => {})}
                            onDelete={onDeleteCard || (() => {})}
                            onEdit={onEditCard || (() => {})}
                            onCardDrop={() => {}}
                            {onReaction}
                        />
                    </div>
                </div>
            {/each}
        </div>
    </div>
</div>

<style lang="less">
    @import "$lib/styles/_mixins.less";
    .present-mode {
        display: flex;
        gap: var(--spacing-6);
        padding: 0 var(--spacing-6);
        background: var(--color-bg-primary);
        flex: 1;
        overflow-y: auto;
    }

    // Left panel - 70% width for presentation
    .presentation-panel {
        flex: 0 0 70%;
        background: white;
        border-radius: var(--radius-md);
        padding: 40px;
        overflow-y: auto;
        border: 1px solid var(--color-border);
        margin: var(--spacing-4) 0;
    }

    // Right panel - 30% width for card selection
    .card-selection-panel {
        flex: 0 0 30%;
        padding: 20px;
        overflow-y: auto;
        position: relative;
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
        display: none;

        .selection-indicator {
            color: var(--color-text-muted);

            &.active {
                color: var(--color-accent);
            }
        }
    }

    .selected .selection-indicator-static {
        display: flex;
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
            display: inherit;
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

    .card-content-with-votes {
        display: flex;
        gap: var(--spacing-6);
        align-items: flex-start;
        margin-bottom: var(--spacing-3);
    }

    .card-content-display {
        flex: 1;
        font-size: 1.125rem;
        line-height: 1.6;
        color: var(--color-text-primary);
        padding: var(--spacing-4);
        background: var(--surface-elevated);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
    }

    .vote-count-box {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--spacing-4);
        background: var(--surface-elevated);
        border: 2px solid var(--color-accent);
        border-radius: var(--radius-md);
        min-width: 100px;
    }

    .vote-count-number {
        font-size: 2.5rem;
        font-weight: 700;
        line-height: 1;
        color: var(--color-accent);
        margin-bottom: var(--spacing-2);
    }

    .vote-count-label {
        font-size: 0.875rem;
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .card-author {
        font-size: 0.875rem;
        color: var(--color-text-muted);
        font-style: italic;
        margin-bottom: var(--spacing-4);
    }

    .notes-section,
    .comments-section,
    .agreements-section {
        margin-bottom: var(--spacing-8);
    }

    .comments-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--spacing-4);
        margin-bottom: var(--spacing-3);
    }

    .section-title {
        font-size: 1rem;
        font-weight: 500;
        margin-bottom: 0;
        color: var(--color-text-secondary);
    }

    .reaction-pills {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
    }

    .reaction-pill {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 2px 6px;
        background-color: var(--surface-secondary);
        border: 1px solid var(--color-border, rgba(0, 0, 0, 0.1));
        border-radius: 12px;
        font-size: 0.75rem;
        transition:
            background-color 0.2s,
            transform 0.1s,
            opacity 0.3s ease-in,
            scale 0.3s ease-in;
        animation: reactionAppear 0.3s ease-out;

        &.clickable {
            cursor: pointer;

            &:hover {
                background-color: var(--surface-tertiary, #e0e0e0);
                transform: scale(1.05);
            }

            &:active {
                transform: scale(0.98);
            }
        }
    }

    @keyframes reactionAppear {
        0% {
            opacity: 0;
            scale: 0.5;
        }
        50% {
            scale: 1.1;
        }
        100% {
            opacity: 1;
            scale: 1;
        }
    }

    .reaction-emoji {
        font-size: 0.875rem;
        line-height: 1;
    }

    .reaction-count {
        color: var(--card-text-secondary);
        font-weight: 500;
    }

    .notes-editor-container {
        position: relative;
        width: 100%;
    }

    .notes-editor {
        width: 100%;
        min-height: 150px;
        padding: var(--spacing-4) var(--spacing-4) 2rem var(--spacing-4);
        border: 2px solid var(--color-accent);
        border-radius: var(--radius-md);
        font-family: inherit;
        font-size: 1rem;
        line-height: 1.6;
        resize: vertical;

        &[readonly] {
            background: var(--surface-disabled);
            cursor: not-allowed;
            border-color: var(--color-border);
        }
    }

    .notes-save-button {
        position: absolute;
        bottom: var(--spacing-2);
        right: 0px;
        padding: var(--spacing-2) var(--spacing-3);
        background: var(--color-accent);
        color: white;
        border: none;
        border-radius: var(--radius-sm);
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        z-index: 10;

        &:hover {
            background: var(--color-accent-hover);
        }
    }

    .notes-lock-indicator {
        position: absolute;
        bottom: var(--spacing-2);
        right: var(--spacing-2);
        padding: var(--spacing-2) var(--spacing-3);
        background: var(--status-warning-bg);
        color: var(--status-warning-text);
        border-radius: var(--radius-sm);
        font-size: 0.875rem;
        font-weight: 500;
        z-index: 10;
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

    .comment-actions {
        display: flex;
        gap: var(--spacing-2);
        align-items: center;
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

    .delete-button {
        padding: var(--spacing-1) var(--spacing-2);
        background: transparent;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all 0.2s;
        font-size: 1.125rem;
        line-height: 1;
        font-weight: 500;
        color: var(--color-text-muted);
        min-width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;

        &:hover {
            background: var(--status-danger-bg);
            border-color: var(--color-danger);
            color: var(--color-danger);
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
</style>
