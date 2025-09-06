<script lang="ts">
    import Card from './Card.svelte';
    import TextareaWithButton from './ui/TextareaWithButton.svelte';
    import Icon from './ui/Icon.svelte';
    
    interface Props {
        column: any;
        cards: any[];
        currentScene: any;
        groupingMode: boolean;
        selectedCards: Set<string>;
        board: any;
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
        isSingleColumn?: boolean;
    }
    
    let { 
        column,
        cards,
        currentScene,
        groupingMode,
        selectedCards,
        board,
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
        isSingleColumn = false
    }: Props = $props();
    
    // Filter cards for this column
    let columnCards = $derived(cards.filter(card => card.columnId === column.id));
    
    // Group cards by groupId
    let grouped = $derived(columnCards
        .filter(card => card.groupId)
        .reduce((acc, card) => {
            if (!acc[card.groupId]) acc[card.groupId] = [];
            acc[card.groupId].push(card);
            return acc;
        }, {} as Record<string, any[]>));
    
    let ungrouped = $derived(columnCards.filter(card => !card.groupId));
</script>

<div
    id="column-{column.id}"
    class="column {isSingleColumn ? 'single-column' : ''} {dragTargetColumnId === column.id ? 'drag-target' : ''}"
    role="region"
    aria-label="Column: {column.title}"
    ondragover={(e) => onDragOver(e, column.id)}
    ondragenter={(e) => onDragEnter(e, column.id)}
    ondragleave={(e) => onDragLeave(e, column.id)}
    ondrop={(e) => onDrop(e, column.id)}
>
    <div
        id="column-header-{column.id}"
        class="column-header"
    >
        <h2>{column.title}</h2>
        {#if column.description}
            <p>{column.description}</p>
        {/if}
    </div>

    <!-- Add Card Section for this column -->
    {#if currentScene?.allowAddCards}
        <div class="add-card-section">
            <TextareaWithButton
                value={onGetColumnContent(column.id)}
                oninput={(e) => onSetColumnContent(column.id, e.currentTarget.value)}
                placeholder="Add a card..."
                rows={2}
                buttonVariant="primary"
                onButtonClick={() => onAddCard(column.id)}
            >
                {#snippet buttonContent()}
                    <Icon name="plus" size="sm" />
                {/snippet}
            </TextareaWithButton>
        </div>
    {/if}

    <!-- Cards Section -->
    <div
        id="column-cards-{column.id}"
        class="cards-container"
        role="region"
        aria-label="Column {column.title} - Drop zone for cards"
    >
        <!-- Grouped cards -->
        {#each Object.entries(grouped) as [groupId, groupCards]}
            <div class="group-container">
                <div class="group-header">
                    <h4>Group {groupId.substring(0, 8)}</h4>
                    {#if currentScene?.allowEditCards}
                        <button onclick={() => onGroupCards(groupCards)}>
                            Ungroup
                        </button>
                    {/if}
                </div>
                <div class="group-cards">
                    {#each groupCards as card}
                        <Card
                            {card}
                            isGrouped={true}
                            {groupingMode}
                            isSelected={selectedCards.has(card.id)}
                            {currentScene}
                            {board}
                            {userRole}
                            {currentUserId}
                            onDragStart={onDragStart}
                            onToggleSelection={onToggleCardSelection}
                            onVote={onVoteCard}
                            onComment={onCommentCard}
                            onDelete={onDeleteCard}
                        />
                    {/each}
                </div>
            </div>
        {/each}

        <!-- Ungrouped cards -->
        {#each ungrouped as card}
            <Card
                {card}
                {groupingMode}
                isSelected={selectedCards.has(card.id)}
                {currentScene}
                {board}
                {userRole}
                {currentUserId}
                onDragStart={onDragStart}
                onToggleSelection={onToggleCardSelection}
                onVote={onVoteCard}
                onComment={onCommentCard}
                onDelete={onDeleteCard}
            />
        {/each}
    </div>
</div>

<style>
    .column {
        background-color: transparent;
        border: none;
        border-radius: 8px;
        overflow: hidden;
        width: 20rem;
        flex-shrink: 0;
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    .column.single-column {
        width: 100%;
        max-width: 56rem;
    }

    .column.drag-target {
        box-shadow: 0 0 0 2px var(--card-interactive-highlight);
    }

    /* Column Header */
    .column-header {
        background-color: transparent;
        padding: 12px 16px;
        border-bottom: none;
    }

    .column-header h2 {
        font-weight: 600;
        color: var(--color-text-secondary);
        font-size: 1rem;
        margin: 0;
    }

    .column-header p {
        color: var(--color-text-secondary);
        font-size: 0.875rem;
        margin-top: 4px;
    }

    /* Add Card Section */
    .add-card-section {
        padding: 12px 16px;
        background-color: transparent;
        border-bottom: none;
    }

    /* Cards Container */
    .cards-container {
        padding: 16px;
        gap: 12px;
        display: flex;
        flex-direction: column;
        min-height: 128px;
        flex: 1;
        overflow-y: auto;
    }

    /* Group container */
    .group-container {
        border: 1px dashed var(--surface-secondary);
        border-radius: 6px;
        padding: 12px;
        background-color: var(--surface-elevated);
    }

    .group-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 8px;
    }

    .group-header h4 {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text-secondary);
    }

    .group-header button {
        font-size: 0.75rem;
        color: var(--card-interactive-highlight);
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
    }

    .group-header button:hover {
        color: var(--card-vote-button-hover);
    }

    .group-cards {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
</style>