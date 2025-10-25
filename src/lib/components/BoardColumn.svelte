<script lang="ts">
import { flip } from "svelte/animate";
import { quintOut } from "svelte/easing";
import { crossfade, slide } from "svelte/transition";
import { getSceneCapability } from "$lib/utils/scene-capability";
import Card from "./Card.svelte";
import Icon from "./ui/Icon.svelte";
import TextareaWithButton from "./ui/TextareaWithButton.svelte";

const [send, receive] = crossfade({
	duration: 200,
	easing: quintOut,
});

interface Props {
	column: any;
	cards: any[];
	currentScene: any;
	groupingMode: boolean;
	selectedCards: Set<string>;
	board: any;
	dragTargetColumnId: string;
	dragOverCardId?: string;
	cardDropPosition?: string;
	draggedCardId?: string;
	onDragOver: (e: DragEvent, columnId: string) => void;
	onDragEnter: (e: DragEvent, columnId: string) => void;
	onDragLeave: (e: DragEvent, columnId: string) => void;
	onDrop: (e: DragEvent, columnId: string) => void;
	onCardDrop: (e: DragEvent, targetCardId: string) => void;
	onCardDragOver?: (
		e: DragEvent,
		cardId: string,
		cardSeq: number,
		columnId: string,
	) => void;
	onCardDragLeave?: (e: DragEvent) => void;
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
	dragOverCardId,
	cardDropPosition,
	draggedCardId,
	onDragOver,
	onDragEnter,
	onDragLeave,
	onDrop,
	onCardDrop,
	onCardDragOver,
	onCardDragLeave,
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

// Check if sequencing is enabled
let canSequence = $derived(
	getSceneCapability(currentScene, board?.status, "allow_sequence_cards"),
);

// Function to get subordinate cards for a lead card
function getSubordinateCards(leadCard: any) {
	return columnCards.filter(
		(card) => card.groupId === leadCard.groupId && !card.isGroupLead,
	);
}

// Helper function to determine if showing a drop indicator would be redundant
function shouldShowDropIndicator(
	hoveredCard: any,
	position: "above" | "below",
): boolean {
	// Don't show indicator on the dragged card itself
	if (draggedCardId === hoveredCard.id) {
		return false;
	}

	// If we don't have a dragged card, don't show
	if (!draggedCardId) {
		return false;
	}

	// Find the dragged card in ungroupedCards
	const draggedCardIndex = ungroupedCards.findIndex(
		(c) => c.id === draggedCardId,
	);
	const hoveredCardIndex = ungroupedCards.findIndex(
		(c) => c.id === hoveredCard.id,
	);

	// If either card isn't found, allow the indicator
	if (draggedCardIndex === -1 || hoveredCardIndex === -1) {
		return true;
	}

	// Check if dropping would be redundant:
	// - Dropping "above" a card that's directly after the dragged card = no movement
	// - Dropping "below" a card that's directly before the dragged card = no movement
	if (position === "above" && hoveredCardIndex === draggedCardIndex + 1) {
		return false; // Hovering above the card right after the dragged card
	}
	if (position === "below" && hoveredCardIndex === draggedCardIndex - 1) {
		return false; // Hovering below the card right before the dragged card
	}

	return true;
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
    {#if getSceneCapability(currentScene, board?.status, "allow_add_cards")}
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
            <div
                class="card-group"
                in:receive={{ key: leadCard.id }}
                out:send={{ key: leadCard.id }}
                animate:flip={{ duration: 200 }}
            >
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
                            <div
                                in:receive={{ key: subCard.id }}
                                out:send={{ key: subCard.id }}
                                animate:flip={{ duration: 200 }}
                            >
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
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/each}

        <!-- Ungrouped cards -->
        {#each ungroupedCards as card (card.id)}
            <div class="card-wrapper" animate:flip={{ duration: 200 }}>
                <!-- Drop indicator above card -->
                {#if canSequence && dragOverCardId === card.id && cardDropPosition === "above" && shouldShowDropIndicator(card, "above")}
                    <hr class="sequence-drop-indicator sequence-drop-indicator-top" />
                {/if}

                <div
                    class="card-drag-area"
                    in:receive={{ key: card.id }}
                    out:send={{ key: card.id }}
                    ondragover={canSequence && onCardDragOver
                        ? (e) => onCardDragOver(e, card.id, card.seq, column.id)
                        : undefined}
                    ondragleave={canSequence && onCardDragLeave
                        ? onCardDragLeave
                        : undefined}
                >
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
                </div>

                <!-- Drop indicator below card -->
                {#if canSequence && dragOverCardId === card.id && cardDropPosition === "below" && shouldShowDropIndicator(card, "below")}
                    <hr class="sequence-drop-indicator sequence-drop-indicator-bottom" />
                {/if}
            </div>
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
        gap: 0;
        display: flex;
        flex-direction: column;
        min-height: 128px;
        flex: 1;
        overflow-y: auto;
        padding: 8px 8px 50vh;
    }

    /* Card wrapper - provides spacing and positioning context */
    .card-wrapper {
        position: relative;
        padding: 6px 0;
    }

    .card-wrapper:first-child {
        padding-top: 0;
    }

    .card-wrapper:last-child {
        padding-bottom: 0;
    }

    /* Card drag area - expands to cover gaps for smooth drag detection */
    .card-drag-area {
        margin: -6px 0;
        padding: 6px 0;
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

    /* Sequence drop indicator - absolutely positioned to avoid layout shifts */
    .sequence-drop-indicator {
        position: absolute;
        left: 0;
        right: 0;
        border: none;
        border-top: 3px solid var(--color-primary);
        margin: 0;
        background: transparent;
        height: 0;
        pointer-events: none;
        z-index: 10;
    }

    .sequence-drop-indicator-top {
        top: 0;
    }

    .sequence-drop-indicator-bottom {
        bottom: 0;
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
            gap: 12px;
            align-items: flex-start;
            .card-wrapper {
                flex: 1;
                min-width: 300px;
                max-width: calc(50% - 6px);
                padding: 0;
            }
            .card-wrapper .card-drag-area {
                margin: 0;
                padding: 0;
            }
        }
    }
</style>
