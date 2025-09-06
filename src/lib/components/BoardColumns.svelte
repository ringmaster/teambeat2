<script lang="ts">
    import BoardColumn from "./BoardColumn.svelte";

    interface Props {
        board: any;
        cards: any[];
        currentScene: any;
        groupingMode: boolean;
        selectedCards: Set<string>;
        dragTargetColumnId: string;
        onDragOver: (e: DragEvent, columnId: string) => void;
        onDragEnter: (e: DragEvent, columnId: string) => void;
        onDragLeave: (e: DragEvent, columnId: string) => void;
        onDrop: (e: DragEvent, columnId: string) => void;
        onCardDrop: (e: DragEvent, targetCardId: string) => void;
        onDragStart: (e: DragEvent, cardId: string) => void;
        onToggleCardSelection: (cardId: string) => void;
        onVoteCard: (cardId: string) => void;
        onCommentCard: (cardId: string) => void;
        onAddCard: (columnId: string) => void;
        onGroupCards: (cards: any[]) => void;
        onGetColumnContent: (columnId: string) => string;
        onSetColumnContent: (columnId: string, content: string) => void;
        onDeleteCard: (cardId: string) => void;
        userRole: string;
        currentUserId: string;
    }

    let {
        board,
        cards,
        currentScene,
        groupingMode,
        selectedCards,
        dragTargetColumnId,
        onDragOver,
        onDragEnter,
        onDragLeave,
        onDrop,
        onCardDrop,
        onDragStart,
        onToggleCardSelection,
        onVoteCard,
        onCommentCard,
        onAddCard,
        onGroupCards,
        onGetColumnContent,
        onSetColumnContent,
        onDeleteCard,
        userRole,
        currentUserId,
    }: Props = $props();
</script>

<!-- Board Columns for configured board (full-width with horizontal scroll) -->
<div
    id="board-columns-container"
    class="board-columns-container"
>
    <div
        id="board-columns-flex"
        class="{board.columns?.length === 1
            ? 'single-column'
            : 'multiple-columns'}"
    >
        {#each board.columns as column (column.id)}
            <BoardColumn
                {column}
                {cards}
                {currentScene}
                {groupingMode}
                {selectedCards}
                {board}
                {dragTargetColumnId}
                {onDragOver}
                {onDragEnter}
                {onDragLeave}
                {onDrop}
                {onCardDrop}
                {onDragStart}
                {onToggleCardSelection}
                {onVoteCard}
                {onCommentCard}
                {onAddCard}
                {onGroupCards}
                {onGetColumnContent}
                {onSetColumnContent}
                {onDeleteCard}
                {userRole}
                {currentUserId}
                isSingleColumn={board.columns?.length === 1}
            />
        {/each}
    </div>
</div>

<style>
    .board-columns-container {
        width: 100%;
        overflow-x: auto;
        padding: 2rem 0;
        flex: 1;
        display: flex;
        flex-direction: column;
    }
    
    #board-columns-flex {
        margin-left: calc((100vw - var(--board-header-width, 800px)) / 2) !important;
        margin-right: calc((100vw - var(--board-header-width, 800px)) / 2) !important;
        display: flex;
        gap: 1rem;
        flex: 1;
        height: 100%;
    }
    
    #board-columns-flex.single-column {
        justify-content: center;
    }
    
    #board-columns-flex.multiple-columns {
        min-width: max-content;
    }
</style>
