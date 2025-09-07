<script lang="ts">
    import { getUserDisplayName } from "$lib/utils/animalNames";
    import Icon from "./ui/Icon.svelte";

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
        onDragStart: (e: DragEvent, cardId: string) => void;
        onToggleSelection: (cardId: string) => void;
        onVote: (cardId: string) => void;
        onComment: (cardId: string) => void;
        onDelete: (cardId: string) => void;
        onCardDrop?: (e: DragEvent, targetCardId: string) => void;
    }

    let {
        card,
        isGrouped: _ = false,
        isGroupLead = false,
        isSubordinate = false,
        groupingMode,
        isSelected,
        currentScene,
        board,
        userRole,
        currentUserId,
        onDragStart,
        onToggleSelection,
        onVote,
        onComment,
        onDelete,
        onCardDrop,
    }: Props = $props();

    // Check if user can delete this card
    let canDelete = $derived.by(() => {
        // Author can always delete (if scene allows editing for members)
        if (card.userId === currentUserId) {
            return userRole !== "member" || currentScene?.allowEditCards;
        }
        // Admin and facilitator can always delete
        return ["admin", "facilitator"].includes(userRole);
    });

    // Check if card can be moved/dragged
    let canMove = $derived(currentScene?.allowMoveCards ?? false);

    // Check if grouping is enabled
    let canGroup = $derived(currentScene?.allowGroupCards ?? false);

    // State for drag targeting
    let isDragTarget = $state(false);

    // Drag and drop handlers for grouping
    function handleDragOver(e: DragEvent) {
        if (canGroup && onCardDrop) {
            e.preventDefault();
            e.dataTransfer!.dropEffect = "move";
        }
    }

    function handleDragEnter(e: DragEvent) {
        if (canGroup && onCardDrop) {
            e.preventDefault();
            isDragTarget = true;
        }
    }

    function handleDragLeave(e: DragEvent) {
        if (canGroup && onCardDrop) {
            // Only clear target if leaving the card element itself, not its children
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                isDragTarget = false;
            }
        }
    }

    function handleDrop(e: DragEvent) {
        if (canGroup && onCardDrop) {
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
        : ''}"
    role="button"
    aria-label={card.isObscured
        ? "Obscured card content"
        : `Card: ${card.content.substring(0, 50)}${card.content.length > 50 ? "..." : ""}`}
    tabindex="0"
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
    <p class="card-content {card.isObscured ? 'obscured' : ''}">
        {#if card.isObscured}
            {greekText(card.content)}
        {:else}
            {card.content}
        {/if}
    </p>

    <div class="card-footer">
        <div class="card-actions">
            {#if canDelete}
                <button
                    onclick={(e) => {
                        e.stopPropagation();
                        onDelete(card.id);
                    }}
                    class="delete-button"
                    title="Delete card"
                    aria-label="Delete card"
                >
                    <Icon name="trash" size="sm" />
                </button>
            {/if}

            {#if currentScene?.allowVoting}
                <button
                    onclick={(e) => {
                        e.stopPropagation();
                        onVote(card.id);
                    }}
                    class="vote-button"
                >
                    <svg
                        class="icon-xs"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                        />
                    </svg>
                    <span>{card._count?.votes || 0}</span>
                </button>
            {/if}

            {#if currentScene?.allowComments}
                <button
                    onclick={(e) => {
                        e.stopPropagation();
                        onComment(card.id);
                    }}
                    class="comment-button"
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
                    <span>{card._count?.comments || 0}</span>
                </button>
            {/if}
        </div>

        <div class="author-text">
            {getUserDisplayName(
                card.userName || "Unknown",
                board.id,
                board.blameFreeMode,
            )}
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
        margin-bottom: 8px;
        font-size: 0.875rem;
        line-height: 1.5;
    }

    .card-content.obscured {
        color: var(--text-muted);
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
    }

    .card-actions {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
    }

    /* Button styles */
    .card button {
        transition: all 0.2s ease;
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

    /* Vote button */
    .vote-button {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        background-color: var(--card-vote-button-background);
        color: white;
        font-size: 0.75rem;
        border-radius: 9999px;
        border: none;
        cursor: pointer;
    }

    .vote-button:hover {
        background-color: var(--card-vote-button-hover);
    }

    /* Comment button */
    .comment-button {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        background-color: var(--card-comment-button-background);
        color: white;
        font-size: 0.75rem;
        border-radius: 9999px;
        border: none;
        cursor: pointer;
    }

    .comment-button:hover {
        background-color: var(--card-comment-button-hover);
    }

    /* Author text */
    .author-text {
        font-size: 0.75rem;
        color: var(--card-text-secondary);
    }
</style>
