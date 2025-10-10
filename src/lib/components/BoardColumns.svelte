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
        onVoteCard: (cardId: string, delta: 1 | -1) => void;
        onCommentCard: (cardId: string) => void;
        onAddCard: (columnId: string) => void;
        onGroupCards: (cards: any[]) => void;
        onGetColumnContent: (columnId: string) => string;
        onSetColumnContent: (columnId: string, content: string) => void;
        onDeleteCard: (cardId: string) => void;
        onEditCard: (cardId: string) => void;
        onReaction?: (cardId: string, emoji: string) => void;
        userRole: string;
        currentUserId: string;
        hasVotes: boolean;
        userVotesByCard: Map<string, number>;
        allVotesByCard: Map<string, number>;
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
        onEditCard,
        onReaction,
        userRole,
        currentUserId,
        hasVotes,
        userVotesByCard,
        allVotesByCard,
    }: Props = $props();

    function columnCountClass(count: number) {
        switch (count) {
            case 0:
                return "no-columns";
            case 1:
                return "single-column";
            case 2:
                return "two-columns";
            case 3:
                return "three-columns";
            default:
                return "multiple-columns";
        }
    }
</script>

<!-- Board Columns for configured board (full-width with horizontal scroll) -->
<div id="board-columns-container" class="board-columns-container">
    <div
        id="board-columns-flex"
        class={columnCountClass(board.columns?.length)}
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
                {onEditCard}
                {onReaction}
                {userRole}
                {currentUserId}
                {hasVotes}
                {userVotesByCard}
                {allVotesByCard}
                isSingleColumn={board.columns?.length === 1}
            />
        {/each}
    </div>
</div>

<style lang="less">
    .board-columns-container {
        width: 100%;
        overflow-x: auto;
        padding: 1rem var(--spacing-4);
        flex: 1;
        display: flex;
        flex-direction: column;

        @media (min-width: 768px) {
            padding: 2rem 0;
        }
    }

    #board-columns-flex {
        display: flex;
        gap: 1rem;
        flex: 1;
        height: 100%;
        width: 100%;
        margin: 0 auto;
        flex-direction: column;

        @media (min-width: 768px) {
            flex-direction: row;
            width: var(--board-header-width);
            max-width: 100%;
        }
    }

    #board-columns-flex.single-column {
        justify-content: center;

        :global .column {
            width: 100%;

            @media (min-width: 768px) {
                width: 70%;
            }
        }
    }

    :global #board-columns-flex.multiple-columns .column {
        width: 100%;

        @media (min-width: 768px) {
            width: 25%;
        }
    }

    :global #board-columns-flex.two-columns .column {
        width: 100%;

        @media (min-width: 768px) {
            width: 50%;
        }
    }

    :global #board-columns-flex.three-columns .column {
        width: 100%;

        @media (min-width: 768px) {
            width: 33%;
        }
    }
</style>
