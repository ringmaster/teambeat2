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
    let canDelete = $derived(() => {
        // Author can always delete (if scene allows editing for members)
        if (card.userId === currentUserId) {
            return userRole !== 'member' || currentScene?.allowEditCards;
        }
        // Admin and facilitator can always delete
        return ['admin', 'facilitator'].includes(userRole);
    });
</script>

<div
    class="bg-white border border-gray-200 rounded p-3 hover:shadow-sm transition-shadow cursor-move {groupingMode
        ? 'hover:bg-gray-50'
        : ''} {isSelected ? 'ring-2 ring-blue-500' : ''}"
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
    <p class="text-gray-900 mb-2 text-sm leading-snug">
        {card.content}
    </p>
    
    <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
            {#if canDelete}
                <button
                    onclick={(e) => {
                        e.stopPropagation();
                        onDelete(card.id);
                    }}
                    class="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                    title="Delete card"
                    aria-label="Delete card"
                >
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
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
                    class="flex items-center space-x-1 px-2 py-1 bg-blue-500 text-white text-xs rounded-full hover:bg-blue-600 transition-colors"
                >
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
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
                    class="flex items-center space-x-1 px-2 py-1 bg-gray-500 text-white text-xs rounded-full hover:bg-gray-600 transition-colors"
                >
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v3c0 .6.4 1 1 1 .2 0 .5-.1.7-.3L14.6 18H20c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                    </svg>
                    <span>{card._count?.comments || 0}</span>
                </button>
            {/if}
        </div>
        
        <div class="text-xs text-gray-400">
            {getUserDisplayName(card.userName || 'Unknown', board.id, board.blameFreeMode)}
        </div>
    </div>
</div>