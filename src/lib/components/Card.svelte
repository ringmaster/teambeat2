<script lang="ts">
    import { getUserDisplayName } from '$lib/utils/animalNames';
    
    interface Props {
        card: any;
        isGrouped?: boolean;
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
    }
    
    let { 
        card, 
        isGrouped = false,
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
        onDelete
    }: Props = $props();
    
    // Check if user can delete this card
    let canDelete = $derived.by(() => {
        // Author can always delete (if scene allows editing for members)
        if (card.userId === currentUserId) {
            return userRole !== 'member' || currentScene?.allowEditCards;
        }
        // Admin and facilitator can always delete
        return ['admin', 'facilitator'].includes(userRole);
    });
</script>

<div
    class="card {groupingMode ? 'grouping-mode' : ''} {isSelected ? 'selected' : ''}"
    role="button"
    aria-label="Card: {card.content.substring(0, 50)}{card.content.length > 50 ? '...' : ''}"
    tabindex="0"
    draggable="true"
    ondragstart={(e) => onDragStart(e, card.id)}
    onclick={() => groupingMode && onToggleSelection(card.id)}
    onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            groupingMode && onToggleSelection(card.id);
        }
    }}
>
    <p class="card-content">
        {card.content}
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
                    <svg class="icon-xs" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
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
                    <svg class="icon-xs" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
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
                    <svg class="icon-xs" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v3c0 .6.4 1 1 1 .2 0 .5-.1.7-.3L14.6 18H20c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                    </svg>
                    <span>{card._count?.comments || 0}</span>
                </button>
            {/if}
        </div>
        
        <div class="author-text">
            {getUserDisplayName(card.userName || 'Unknown', board.id, board.blameFreeMode)}
        </div>
    </div>
</div>

<style>
    .card {
        background-color: rgb(var(--card-background));
        border-radius: 8px;
        padding: 12px;
        cursor: move;
        transition: box-shadow 0.2s ease, transform 0.2s ease;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        border-top: 3px solid rgb(var(--card-border-color));
        position: relative;
    }

    .card:hover {
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
        transform: translateY(-1px);
    }

    .card.grouping-mode:hover {
        background-color: rgb(var(--card-hover-background));
    }

    .card.selected {
        box-shadow: 0 0 0 2px rgb(var(--card-selection-highlight));
    }

    /* Text styles */
    .card-content {
        color: rgb(var(--card-text-primary));
        margin-bottom: 8px;
        font-size: 0.875rem;
        line-height: 1.5;
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
        color: rgb(var(--card-delete-button-color));
        border-radius: 4px;
        border: none;
        background: none;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .delete-button:hover {
        color: rgb(var(--card-delete-button-hover));
        background-color: rgb(var(--card-delete-button-background));
    }

    /* Vote button */
    .vote-button {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        background-color: rgb(var(--card-vote-button-background));
        color: white;
        font-size: 0.75rem;
        border-radius: 9999px;
        border: none;
        cursor: pointer;
    }

    .vote-button:hover {
        background-color: rgb(var(--card-vote-button-hover));
    }

    /* Comment button */
    .comment-button {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        background-color: rgb(var(--card-comment-button-background));
        color: white;
        font-size: 0.75rem;
        border-radius: 9999px;
        border: none;
        cursor: pointer;
    }

    .comment-button:hover {
        background-color: rgb(var(--card-comment-button-hover));
    }

    /* Author text */
    .author-text {
        font-size: 0.75rem;
        color: rgb(var(--card-text-secondary));
    }
</style>