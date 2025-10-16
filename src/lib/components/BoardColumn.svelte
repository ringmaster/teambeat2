<script lang="ts">
    import Card from "./Card.svelte";
    import TextareaWithButton from "./ui/TextareaWithButton.svelte";
    import Icon from "./ui/Icon.svelte";
    import { slide } from "svelte/transition";
    import { getSceneCapability } from "$lib/utils/scene-capability";

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
        onCardDrop,
        onDragStart,
        onToggleCardSelection,
        onVoteCard,
        onCommentCard,
        onAddCard,
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
        isSingleColumn = false,
    }: Props = $props();

    // Filter cards for this column
    let columnCards = $derived(
        cards.filter((card) => card && card.columnId === column.id),
    );

    // Get lead cards and their subordinate cards
    let leadCards = $derived(columnCards.filter((card) => card.isGroupLead));

    let ungroupedCards = $derived(columnCards.filter((card) => !card.groupId));

    // Function to get subordinate cards for a lead card
    function getSubordinateCards(leadCard: any) {
        return columnCards.filter(
            (card) => card.groupId === leadCard.groupId && !card.isGroupLead,
        );
    }
</script>

<div
    id="column-{column.id}"
    class="column {column.defaultAppearance
        ? column.defaultAppearance
        : ''} {isSingleColumn ? 'single-column' : ''} {dragTargetColumnId ===
    column.id
        ? 'drag-target'
        : ''}"
    role="region"
    aria-label="Column: {column.title}"
    ondragover={(e) => onDragOver(e, column.id)}
    ondragenter={(e) => onDragEnter(e, column.id)}
    ondragleave={(e) => onDragLeave(e, column.id)}
    ondrop={(e) => onDrop(e, column.id)}
>
    <div id="column-header-{column.id}" class="column-header">
        <h2>{column.title}</h2>
        {#if column.description}
            <p>{column.description}</p>
        {/if}
    </div>

    <!-- Add Card Section for this column -->
    {#if getSceneCapability(currentScene, board?.status, 'allow_add_cards')}
        <div class="add-card-section" transition:slide>
            <TextareaWithButton
                value={onGetColumnContent(column.id)}
                oninput={(e) =>
                    onSetColumnContent(column.id, e.currentTarget.value)}
                placeholder="Add a card..."
                rows={2}
                buttonVariant="light"
                onButtonClick={() => onAddCard(column.id)}
                class="add-card-textarea"
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
        <!-- Lead cards with their subordinate cards -->
        {#each leadCards as leadCard (leadCard.id)}
            {@const subordinateCards = getSubordinateCards(leadCard)}
            <div class="card-group">
                <!-- Lead card -->
                <Card
                    card={leadCard}
                    isGroupLead={true}
                    {groupingMode}
                    isSelected={selectedCards.has(leadCard.id)}
                    {currentScene}
                    {board}
                    {userRole}
                    {currentUserId}
                    userVotesOnCard={userVotesByCard.get(leadCard.id) || 0}
                    allUsersVotesOnCard={allVotesByCard.get(leadCard.id)}
                    {hasVotes}
                    {onDragStart}
                    {onCardDrop}
                    onToggleSelection={onToggleCardSelection}
                    onVote={onVoteCard}
                    onComment={onCommentCard}
                    onDelete={onDeleteCard}
                    onEdit={onEditCard}
                    {onReaction}
                />

                <!-- Subordinate cards inside the lead card -->
                {#if subordinateCards.length > 0}
                    <div class="subordinate-cards">
                        {#each subordinateCards as subCard (subCard.id)}
                            <Card
                                card={subCard}
                                isSubordinate={true}
                                {groupingMode}
                                isSelected={selectedCards.has(subCard.id)}
                                {currentScene}
                                {board}
                                {userRole}
                                {currentUserId}
                                userVotesOnCard={userVotesByCard.get(
                                    subCard.id,
                                ) || 0}
                                allUsersVotesOnCard={allVotesByCard.get(
                                    subCard.id,
                                )}
                                {hasVotes}
                                {onDragStart}
                                {onCardDrop}
                                onToggleSelection={onToggleCardSelection}
                                onVote={onVoteCard}
                                onComment={onCommentCard}
                                onDelete={onDeleteCard}
                                onEdit={onEditCard}
                                {onReaction}
                            />
                        {/each}
                    </div>
                {/if}
            </div>
        {/each}

        <!-- Ungrouped cards -->
        {#each ungroupedCards as card (card.id)}
            <Card
                {card}
                {groupingMode}
                isSelected={selectedCards.has(card.id)}
                {currentScene}
                {board}
                {userRole}
                {currentUserId}
                userVotesOnCard={userVotesByCard.get(card.id) || 0}
                allUsersVotesOnCard={allVotesByCard.get(card.id)}
                {hasVotes}
                {onDragStart}
                {onCardDrop}
                onToggleSelection={onToggleCardSelection}
                onVote={onVoteCard}
                onComment={onCommentCard}
                onDelete={onDeleteCard}
                onEdit={onEditCard}
                {onReaction}
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
        background-color: var(--surface-secondary);
    }

    :global .column.drag-target:has(.drag-target) {
        background-color: transparent;
        box-shadow: none;
    }

    /* Column Header */
    .column-header {
        background-color: transparent;
        padding: 12px 8px;
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
        padding: 12px 8px;
        background-color: transparent;
        border-bottom: none;
    }

    /* Cards Container */
    .cards-container {
        gap: 12px;
        display: flex;
        flex-direction: column;
        min-height: 128px;
        flex: 1;
        overflow-y: auto;
        padding: 8px 8px 50vh;
    }

    /* Card group container */
    .card-group {
        position: relative;
    }

    /* Subordinate cards container */
    .subordinate-cards {
        margin-left: 16px;
        margin-top: 8px;
        padding: 8px;
        border-left: 2px solid var(--surface-secondary);
        border-radius: 0 4px 4px 0;
        background-color: rgba(var(--surface-elevated-rgb), 0.5);
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    :global #board-columns-container #board-columns-flex .column.locked {
        width: 300px;
        border-right: 1px solid var(--surface-secondary);
    }

    :global #board-columns-container #board-columns-flex .column.spread {
        width: inherit;
        flex: 1;
        .cards-container {
            flex-direction: row;
            flex-wrap: wrap;
            flex: none;
            .card {
                flex: 1;
                min-width: 300px;
            }
        }
    }
</style>
