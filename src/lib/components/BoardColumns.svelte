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
    class="w-full overflow-x-auto py-8 flex-1 flex flex-col"
>
    <div
        id="board-columns-flex"
        class="flex space-x-4 flex-1 h-full {board.columns?.length === 1
            ? 'justify-center'
            : 'min-w-max'} h-full"
    >
        {#each board.columns as column}
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
    #board-columns-flex {
        margin-left: calc((100vw - var(--board-header-width)) / 2);
        margin-right: calc((100vw - var(--board-header-width)) / 2);
        display: flex;
    }
</style>
