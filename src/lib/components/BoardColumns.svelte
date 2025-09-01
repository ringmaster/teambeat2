<script lang="ts">
    import BoardColumn from './BoardColumn.svelte';
    
    interface Props {
        board: any;
        cards: any[];
        currentScene: any;
        groupingMode: boolean;
        selectedCards: Set<string>;
        onDragOver: (e: DragEvent) => void;
        onDrop: (e: DragEvent, columnId: string) => void;
        onDragStart: (e: DragEvent, cardId: string) => void;
        onToggleCardSelection: (cardId: string) => void;
        onVoteCard: (cardId: string) => void;
        onCommentCard: (cardId: string) => void;
        onAddCard: (columnId: string) => void;
        onGroupCards: (cards: any[]) => void;
        onGetColumnContent: (columnId: string) => string;
        onSetColumnContent: (columnId: string, content: string) => void;
    }
    
    let { 
        board,
        cards,
        currentScene,
        groupingMode,
        selectedCards,
        onDragOver,
        onDrop,
        onDragStart,
        onToggleCardSelection,
        onVoteCard,
        onCommentCard,
        onAddCard,
        onGroupCards,
        onGetColumnContent,
        onSetColumnContent
    }: Props = $props();
</script>

<style>
    #board-columns-flex {
        margin-left: calc((100vw - var(--board-header-width)) / 2);
    }
</style>

<!-- Board Columns for configured board (full-width with horizontal scroll) -->
<div id="board-columns-container" class="w-full overflow-x-auto py-8">
    <div id="board-columns-flex" class="flex space-x-4 min-w-max">
        {#each board.columns as column}
            <BoardColumn
                {column}
                {cards}
                {currentScene}
                {groupingMode}
                {selectedCards}
                {board}
                {onDragOver}
                {onDrop}
                {onDragStart}
                {onToggleCardSelection}
                {onVoteCard}
                {onCommentCard}
                {onAddCard}
                {onGroupCards}
                {onGetColumnContent}
                {onSetColumnContent}
            />
        {/each}
    </div>
</div>