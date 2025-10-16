<script lang="ts">
    import { getUserDisplayName } from "$lib/utils/animalNames";
    import { getSceneCapability } from "$lib/utils/scene-capability";
    import Icon from "./ui/Icon.svelte";
    import Vote from "./ui/Vote.svelte";
    import { createAvatar } from "@dicebear/core";
    import { adventurer } from "@dicebear/collection";
    import { marked } from "marked";

    // Configure marked for GitHub-flavored markdown
    marked.setOptions({
        gfm: true,
        breaks: true,
    });

    interface Props {
        card: any;
        isGrouped?: boolean;
        isGroupLead?: boolean;
        isSubordinate?: boolean;
        groupingMode: boolean;
        isSelected: boolean;
        currentScene: any;
        board: any;
        userRole: string;
        currentUserId: string;
        userVotesOnCard?: number; // Number of votes this user has on this card (0 or 1 for current system)
        allUsersVotesOnCard?: number; // Total votes from all users on this card (when votes are visible)
        hasVotes?: boolean; // Whether user has votes available (same for all cards on board)
        onDragStart: (e: DragEvent, cardId: string) => void;
        onToggleSelection: (cardId: string) => void;
        onVote: (cardId: string, delta: 1 | -1) => void;
        onComment: (cardId: string) => void;
        onDelete: (cardId: string) => void;
        onEdit: (cardId: string) => void;
        onCardDrop?: (e: DragEvent, targetCardId: string) => void;
        onReaction?: (cardId: string, emoji: string) => void;
    }

    let {
        card,
        isGrouped = false,
        isGroupLead = false,
        isSubordinate = false,
        groupingMode,
        isSelected,
        currentScene,
        board,
        userRole,
        currentUserId,
        userVotesOnCard = 0,
        allUsersVotesOnCard,
        hasVotes = false,
        onDragStart,
        onToggleSelection,
        onVote,
        onComment,
        onDelete,
        onEdit,
        onCardDrop,
        onReaction,
    }: Props = $props();

    // Helper function to determine vote view mode based on scene settings
    function getVoteViewMode(
        showVotes: boolean,
        allowVoting: boolean,
    ): "votes" | "total" | "both" {
        if (showVotes && allowVoting) {
            return "both";
        } else if (showVotes) {
            return "total";
        } else {
            return "votes";
        }
    }

    // Check if user can delete this card
    let canDelete = $derived.by(() => {
        // Author can always delete (if scene allows editing for members)
        if (card.userId === currentUserId) {
            return (
                userRole !== "member" ||
                getSceneCapability(
                    currentScene,
                    board?.status,
                    "allow_edit_cards",
                )
            );
        }
        // Admin and facilitator can always delete
        return ["admin", "facilitator"].includes(userRole);
    });

    // Check if user can edit this card
    let canEdit = $derived.by(() => {
        // Only allow editing if the current scene allows it
        if (
            !getSceneCapability(currentScene, board?.status, "allow_edit_cards")
        )
            return false;

        // Author can always edit their own cards
        if (card.userId === currentUserId) {
            return true;
        }
        // Admin and facilitator can always edit
        return ["admin", "facilitator"].includes(userRole);
    });

    // Check if card should be obscured
    let isObscured = $derived.by(() => {
        return (
            getSceneCapability(
                currentScene,
                board?.status,
                "allow_obscure_cards",
            ) && card.userId !== currentUserId
        );
    });

    // Render card content as markdown
    let renderedContent = $derived(marked.parse(card.content) as string);

    // Check if card can be moved/dragged
    let canMove = $derived(
        getSceneCapability(currentScene, board?.status, "allow_move_cards") &&
            !isObscured,
    );

    // Check if grouping is enabled
    let canGroup = $derived(
        getSceneCapability(currentScene, board?.status, "allow_group_cards"),
    );

    // State for drag targeting
    let isDragTarget = $state(false);

    // State for menu dropdown
    let isMenuOpen = $state(false);

    // Handle menu toggle
    function toggleMenu(e: Event) {
        e.stopPropagation();
        isMenuOpen = !isMenuOpen;
    }

    // Close menu when clicking outside
    function handleClickOutside(e: MouseEvent) {
        const target = e.target as HTMLElement;
        if (!target.closest(".card-menu-container")) {
            isMenuOpen = false;
        }
    }

    // Handle emoji reaction
    function handleReaction(emoji: string) {
        if (onReaction) {
            onReaction(card.id, emoji);
            isMenuOpen = false;
        }
    }

    // Add/remove click listener for closing menu
    $effect(() => {
        if (isMenuOpen) {
            document.addEventListener("click", handleClickOutside);
            return () =>
                document.removeEventListener("click", handleClickOutside);
        }
    });

    // Drag and drop handlers for grouping
    function handleDragOver(e: DragEvent) {
        if (canGroup && onCardDrop && !isObscured) {
            e.preventDefault();
            e.dataTransfer!.dropEffect = "move";
        }
    }

    function handleDragEnter(e: DragEvent) {
        if (canGroup && onCardDrop && !isObscured) {
            e.preventDefault();
            isDragTarget = true;
        }
    }

    function handleDragLeave(e: DragEvent) {
        if (canGroup && onCardDrop && !isObscured) {
            // Only clear target if leaving the card element itself, not its children
            const currentTarget = e.currentTarget as HTMLElement;
            const relatedTarget = e.relatedTarget as Node;
            if (
                currentTarget &&
                (!relatedTarget || !currentTarget.contains(relatedTarget))
            ) {
                isDragTarget = false;
            }
        }
    }

    function handleDrop(e: DragEvent) {
        if (canGroup && onCardDrop && !isObscured) {
            e.preventDefault();
            e.stopPropagation();
            isDragTarget = false;
            onCardDrop(e, card.id);
        }
    }

    function greekText(english: string): string {
        // Generate a numeric hash from 1 to 26 from the input string so that the hash is the same for the same input
        let hash = 0;
        for (let i = 0; i < english.length; i++) {
            hash += english.charCodeAt(i);
        }
        hash = (hash % 26) + 1; // 1 to 26

        // Greek alphabet array
        const greekAlphabet = [
            "α",
            "β",
            "γ",
            "δ",
            "ε",
            "ζ",
            "η",
            "θ",
            "ι",
            "κ",
            "λ",
            "μ",
            "ν",
            "ξ",
            "ο",
            "π",
            "ρ",
            "σ",
            "τ",
            "υ",
            "φ",
            "χ",
            "ψ",
            "ω",
        ];

        // Map each english letter to a Greek letter, skipping {hash} letters for each step in the alphabet
        const mapping: Record<string, string> = {};
        const englishAlphabet = "abcdefghijklmnopqrstuvwxyz";

        for (let i = 0; i < englishAlphabet.length; i++) {
            const englishChar = englishAlphabet[i];
            const greekIndex = (i * (hash + 1)) % greekAlphabet.length;
            mapping[englishChar] = greekAlphabet[greekIndex];
        }

        // Transform the input string using the mapping
        return english
            .split("")
            .map((char) => {
                const lowerChar = char.toLowerCase();
                return mapping[lowerChar] || char;
            })
            .join("");
    }
</script>

<div
    class="card {groupingMode ? 'grouping-mode' : ''} {isSelected
        ? 'selected'
        : ''} {!canMove ? 'no-drag' : ''} {isGroupLead
        ? 'group-lead'
        : ''} {isSubordinate ? 'subordinate' : ''} {isDragTarget
        ? 'drag-target'
        : ''} {isMenuOpen ? 'menu-open' : ''}"
    role={groupingMode ? "button" : "article"}
    aria-label={isObscured
        ? "Obscured card content"
        : `Card: ${card.content.substring(0, 50)}${card.content.length > 50 ? "..." : ""}`}
    tabindex="-1"
    draggable={canMove}
    ondragstart={(e) => canMove && onDragStart(e, card.id)}
    ondragover={handleDragOver}
    ondragenter={handleDragEnter}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
    onclick={() => groupingMode && onToggleSelection(card.id)}
    onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (groupingMode) {
                onToggleSelection(card.id);
            }
        }
    }}
>
    <div class="card-main">
        <div class="card-content markdown {isObscured ? 'obscured' : ''}">
            {#if isObscured}
                {greekText(card.content)}
            {:else}
                {@html renderedContent}
            {/if}
        </div>

        <div class="card-sidebar">
            <span
                class="user-avatar-wrapper cooltipz--left"
                aria-label={getUserDisplayName(
                    card.userName || "Unknown",
                    board.id,
                    board.blameFreeMode,
                )}
            >
                <div class="user-avatar">
                    {#if isObscured}
                        <img
                            src="/masked.svg"
                            alt="Obscured user avatar"
                            width="24"
                            height="24"
                        />
                    {:else}
                        <img
                            src={createAvatar(adventurer, {
                                seed: `${card.userId}-${board.id}`,
                                size: 24,
                                radius: 12,
                                scale: 100,
                                backgroundColor: ["transparent"],
                            }).toDataUri()}
                            alt="User avatar"
                            width="24"
                            height="24"
                        />
                    {/if}
                </div>
            </span>

            <div class="card-menu-container">
                {#if getSceneCapability(currentScene, board?.status, "allow_comments") || canEdit || canDelete}
                    <button
                        class="menu-button"
                        onclick={toggleMenu}
                        aria-label="Card menu"
                        title="Card menu"
                    >
                        <span class="hamburger">
                            <span></span>
                            <span></span>
                            <span></span>
                        </span>
                    </button>
                {/if}

                {#if isMenuOpen && (getSceneCapability(currentScene, board?.status, "allow_comments") || canEdit || canDelete)}
                    <div class="card-menu">
                        {#if getSceneCapability(currentScene, board?.status, "allow_comments")}
                            <div class="card-menu-button-row">
                                <button
                                    title="Add Comment"
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        onComment(card.id);
                                        isMenuOpen = false;
                                    }}
                                >
                                    💬 Add Comment
                                </button>
                            </div>
                            <div class="card-menu-button-row">
                                <button
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        handleReaction("👍");
                                    }}
                                    title="Like">👍</button
                                >
                                <button
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        handleReaction("❤️");
                                    }}
                                    title="Love">❤️</button
                                >
                                <button
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        handleReaction("👎");
                                    }}
                                    title="Dislike">👎</button
                                >
                                <button
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        handleReaction("🎉");
                                    }}
                                    title="Celebrate">🎉</button
                                >
                                <button
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        handleReaction("🔥");
                                    }}
                                    title="Fire">🔥</button
                                >
                            </div>
                            <div class="card-menu-button-row">
                                <button
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        handleReaction("😬");
                                    }}
                                    title="Grimace">😬</button
                                >
                                <button
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        handleReaction("😯");
                                    }}
                                    title="Surprised">😯</button
                                >
                                <button
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        handleReaction("🤔");
                                    }}
                                    title="Thinking">🤔</button
                                >
                                <button
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        handleReaction("😡");
                                    }}
                                    title="Angry">😡</button
                                >
                                <button
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        handleReaction("😢");
                                    }}
                                    title="Sad">😢</button
                                >
                            </div>
                        {/if}
                        {#if (canDelete || canEdit) && getSceneCapability(currentScene, board?.status, "allow_comments")}
                            <hr class="menu-separator" />
                        {/if}
                        {#if canDelete || canEdit}
                            <div class="card-menu-action-row">
                                {#if canEdit}
                                    <button
                                        onclick={(e) => {
                                            e.stopPropagation();
                                            onEdit(card.id);
                                            isMenuOpen = false;
                                        }}
                                        class="action-button edit-button"
                                        title="Edit card"
                                        aria-label="Edit card"
                                    >
                                        <Icon name="edit" size="sm" />
                                        <span>Edit</span>
                                    </button>
                                {/if}
                                {#if canDelete}
                                    <button
                                        onclick={(e) => {
                                            e.stopPropagation();
                                            onDelete(card.id);
                                            isMenuOpen = false;
                                        }}
                                        class="action-button delete-button"
                                        title="Delete card"
                                        aria-label="Delete card"
                                    >
                                        <Icon name="trash" size="sm" />
                                        <span>Delete</span>
                                    </button>
                                {/if}
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    </div>

    <div class="card-footer">
        <div class="card-footer-left">
            {#if (getSceneCapability(currentScene, board?.status, "show_votes") || getSceneCapability(currentScene, board?.status, "allow_voting")) && !isSubordinate}
                <Vote
                    votes={userVotesOnCard}
                    total={allUsersVotesOnCard ?? card.voteCount ?? 0}
                    enabled={getSceneCapability(
                        currentScene,
                        board?.status,
                        "allow_voting",
                    )}
                    {hasVotes}
                    view={getVoteViewMode(
                        getSceneCapability(
                            currentScene,
                            board?.status,
                            "show_votes",
                        ),
                        getSceneCapability(
                            currentScene,
                            board?.status,
                            "allow_voting",
                        ),
                    )}
                    itemID={card.id}
                    onVote={(itemID, delta) => onVote(itemID, delta)}
                />
            {/if}
        </div>

        <div class="card-footer-right">
            {#if getSceneCapability(currentScene, board?.status, "show_comments") && card.reactions && Object.keys(card.reactions).length > 0}
                <div class="reaction-pills">
                    {#each Object.entries(card.reactions) as [emoji, count]}
                        {#if getSceneCapability(currentScene, board?.status, "allow_comments")}
                            <button
                                class="reaction-pill clickable"
                                title="Click to add {emoji} reaction ({count} total)"
                                onclick={(e) => {
                                    e.stopPropagation();
                                    handleReaction(emoji);
                                }}
                            >
                                <span class="reaction-emoji">{emoji}</span>
                                <span class="reaction-count">{count}</span>
                            </button>
                        {:else}
                            <span
                                class="reaction-pill"
                                title="{count} {emoji} reaction{count !== 1
                                    ? 's'
                                    : ''}"
                            >
                                <span class="reaction-emoji">{emoji}</span>
                                <span class="reaction-count">{count}</span>
                            </span>
                        {/if}
                    {/each}
                </div>
            {/if}

            {#if getSceneCapability(currentScene, board?.status, "show_comments") && card.commentCount > 0}
                {#if getSceneCapability(currentScene, board?.status, "allow_comments")}
                    <button
                        onclick={(e) => {
                            e.stopPropagation();
                            onComment(card.id);
                        }}
                        class="comment-pill clickable"
                        title="Click to view/add comments ({card.commentCount} total)"
                    >
                        <svg
                            class="icon-xs"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v3c0 .6.4 1 1 1 .2 0 .5-.1.7-.3L14.6 18H20c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
                            />
                        </svg>
                        <span>{card.commentCount}</span>
                    </button>
                {:else}
                    <span
                        class="comment-pill"
                        title="{card.commentCount} comment{card.commentCount !==
                        1
                            ? 's'
                            : ''}"
                    >
                        <svg
                            class="icon-xs"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v3c0 .6.4 1 1 1 .2 0 .5-.1.7-.3L14.6 18H20c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
                            />
                        </svg>
                        <span>{card.commentCount}</span>
                    </span>
                {/if}
            {/if}
        </div>
    </div>
</div>

<style>
    .card {
        background-color: var(--card-background);
        border-radius: 8px;
        padding: 12px;
        cursor: move;
        transition:
            box-shadow 0.2s ease,
            transform 0.2s ease;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        border-top: 3px solid var(--card-border-color);
        position: relative;
        z-index: 1;

        @media (max-width: 767px) {
            padding: 14px; /* Slightly more padding on mobile for better touch targets */
        }
    }

    .card:has(.card-menu) {
        z-index: 999;
    }

    .card:hover {
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
        transform: translateY(-1px);
    }

    .card.grouping-mode:hover {
        background-color: var(--card-hover-background);
    }

    .card.selected {
        box-shadow: 0 0 0 2px var(--card-selection-highlight);
    }

    .card.no-drag {
        cursor: default;
    }

    .card.group-lead {
        border-left: 4px solid var(--card-interactive-highlight);
    }

    .card.subordinate {
        background-color: var(--surface-elevated);
        border-radius: 6px;
        padding: 8px;
        font-size: 0.8rem;
    }

    .card.subordinate .card-content {
        margin-bottom: 4px;
    }

    .card.drag-target {
        box-shadow: 0 0 0 2px var(--card-interactive-highlight);
        transform: translateY(-2px);
    }

    /* Text styles */
    .card-content {
        color: var(--card-text-primary);
        font-size: 0.875rem;
        line-height: 1.5;
        display: flex;
        flex-direction: column;
    }

    .card-content.obscured {
        color: var(--color-text-muted);
        opacity: 0.8;
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        pointer-events: none;
        filter: blur(0.5px);
        filter: blur(2px);
    }

    .card-content.obscured::selection {
        background: transparent;
    }

    .card-content.obscured::-moz-selection {
        background: transparent;
    }

    .card-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-top: 8px;
    }

    .card-footer-left {
        display: flex;
        align-items: center;
    }

    .card-footer-right {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: flex-end;
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
        border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
        border-radius: 12px;
        font-size: 0.75rem;
        cursor: pointer;
        min-height: 28px;
        transition:
            background-color 0.2s,
            transform 0.1s;

        @media (max-width: 767px) {
            padding: 4px 8px;
            min-height: 36px;
            font-size: 0.8125rem;
        }
    }

    .reaction-pill:hover {
        background-color: var(--surface-tertiary, #e0e0e0);
        transform: scale(1.05);
    }

    .reaction-pill:active {
        transform: scale(0.98);
    }

    .reaction-emoji {
        font-size: 0.875rem;
        line-height: 1;
    }

    .reaction-count {
        color: var(--card-text-secondary);
        font-weight: 500;
    }

    .comment-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        background-color: var(--surface-secondary);
        color: var(--card-text-primary);
        font-size: 0.75rem;
        border-radius: 12px;
        border: none;
        cursor: pointer;
        min-height: 28px;
        transition: background-color 0.2s;

        @media (max-width: 767px) {
            padding: 6px 10px;
            min-height: 36px;
            font-size: 0.8125rem;
        }
    }

    .comment-pill:hover {
        background-color: var(--surface-elevated);
    }

    .comment-pill svg {
        width: 14px;
        height: 14px;
    }

    /* Button styles */
    .card button {
        transition: all 0.2s ease;
    }

    /* Edit button */
    .edit-button {
        padding: 4px;
        color: var(--card-text-secondary);
        border-radius: 4px;
        border: none;
        background: none;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .edit-button:hover {
        color: var(--card-text-primary);
        background-color: var(--surface-secondary);
    }

    /* Delete button */
    .delete-button {
        padding: 4px;
        color: var(--card-delete-button-color);
        border-radius: 4px;
        border: none;
        background: none;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .delete-button:hover {
        color: var(--card-delete-button-hover);
        background-color: var(--card-delete-button-background);
    }

    /* Card main container */
    .card-main {
        display: flex;
        position: relative;
        min-height: 60px; /* Ensure minimum height for sidebar */
    }

    /* Card sidebar */
    .card-sidebar {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        margin-left: 12px;
        flex-shrink: 0;
    }

    /* User avatar wrapper - for tooltip */
    .user-avatar-wrapper {
        position: relative;
        display: inline-block;
        flex-shrink: 0;
    }

    /* User avatar */
    .user-avatar {
        width: 24px;
        height: 24px;
        /* border-radius: 50%; */
        overflow: hidden;
        /* background: var(--surface-secondary);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);*/
        flex-shrink: 0;
    }

    .user-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    /* Menu container */
    .card-menu-container {
        position: relative;
    }

    /* Hamburger menu button */
    .menu-button {
        width: 24px;
        height: 24px;
        padding: 4px;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s;
    }

    .menu-button:hover {
        background-color: var(--surface-secondary);
    }

    .hamburger {
        display: flex;
        flex-direction: column;
        gap: 2px;
        width: 16px;
    }

    .hamburger span {
        display: block;
        width: 100%;
        height: 2px;
        background-color: var(--card-text-secondary);
        border-radius: 1px;
        transition: background-color 0.2s;
    }

    .menu-button:hover .hamburger span {
        background-color: var(--card-text-primary);
    }

    /* Dropdown menu */
    .card-menu {
        position: absolute;
        right: 0;
        top: calc(100% + 4px);
        background: var(--card-background);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        padding: 8px;
        z-index: 10000;
        min-width: 200px;
        border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
    }

    /* Menu button rows */
    .card-menu-button-row {
        display: flex;
        gap: 4px;
        margin-bottom: 8px;
    }

    .card-menu-button-row:last-child {
        margin-bottom: 0;
    }

    .card-menu-button-row button {
        flex: 1;
        padding: 6px;
        border: none;
        background: inherit;
        border-radius: 6px;
        cursor: pointer;
        font-size: 16px;
        transition: all 0.2s;
        min-width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .card-menu-button-row button:hover {
        background: var(--surface-elevated);
        transform: scale(1.1);
    }

    /* Menu separator */
    .menu-separator {
        margin: 8px 0;
        border: none;
        border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
    }

    /* Action buttons row */
    .card-menu-action-row {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .action-button {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border: none;
        background: transparent;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.875rem;
        transition: all 0.2s;
        width: 100%;
        text-align: left;
    }

    .action-button:hover {
        background: var(--surface-secondary);
    }

    .action-button.edit-button {
        color: var(--card-text-primary);
    }

    .action-button.delete-button {
        color: var(--card-delete-button-color);
    }

    .action-button.delete-button:hover {
        background: var(--card-delete-button-background);
        color: var(--card-delete-button-hover);
    }

    .action-button span {
        flex: 1;
    }

    /* Adjust card content */
    .card-main .card-content {
        flex: 1;
        min-width: 0; /* Allow text to wrap properly */
    }
</style>
