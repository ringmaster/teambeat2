<script lang="ts">
    import Card from './Card.svelte';
    
    interface Props {
        column: any;
        cards: any[];
        currentScene: any;
        groupingMode: boolean;
        selectedCards: Set<string>;
        board: any;
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
        column,
        cards,
        currentScene,
        groupingMode,
        selectedCards,
        board,
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
    class="bg-white border border-gray-200 rounded-lg overflow-hidden w-80 flex-shrink-0"
>
    <div
        id="column-header-{column.id}"
        class="bg-gray-50 border-b border-gray-200 px-4 py-3"
    >
        <h2 class="font-semibold text-gray-900 text-base">
            {column.title}
        </h2>
        {#if column.description}
            <p class="text-gray-600 text-sm mt-1">
                {column.description}
            </p>
        {/if}
    </div>

    <!-- Add Card Section for this column -->
    {#if currentScene?.allowAddCards}
        <div class="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <div class="flex gap-2">
                <textarea
                    value={onGetColumnContent(column.id)}
                    oninput={(e) => onSetColumnContent(column.id, e.currentTarget.value)}
                    placeholder="Add a card..."
                    class="flex-1 px-3 py-2 border border-gray-200 rounded text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    rows="2"
                ></textarea>
                <button
                    onclick={() => onAddCard(column.id)}
                    class="px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
                >
                    Add
                </button>
            </div>
        </div>
    {/if}

    <!-- Cards Section -->
    <div
        id="column-cards-{column.id}"
        class="p-4 space-y-3 min-h-32 max-h-96 overflow-y-auto"
        ondragover={onDragOver}
        ondrop={(e) => onDrop(e, column.id)}
    >
        <!-- Grouped cards -->
        {#each Object.entries(grouped) as [groupId, groupCards]}
            <div class="border border-dashed border-gray-300 rounded p-3 bg-gray-50">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="text-sm font-medium text-gray-700">
                        Group {groupId.substring(0, 8)}
                    </h4>
                    {#if currentScene?.allowEditCards}
                        <button
                            onclick={() => onGroupCards(groupCards)}
                            class="text-xs text-blue-600 hover:text-blue-700"
                        >
                            Ungroup
                        </button>
                    {/if}
                </div>
                <div class="space-y-2">
                    {#each groupCards as card}
                        <Card
                            {card}
                            isGrouped={true}
                            {groupingMode}
                            isSelected={selectedCards.has(card.id)}
                            {currentScene}
                            {board}
                            onDragStart={onDragStart}
                            onToggleSelection={onToggleCardSelection}
                            onVote={onVoteCard}
                            onComment={onCommentCard}
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
                onDragStart={onDragStart}
                onToggleSelection={onToggleCardSelection}
                onVote={onVoteCard}
                onComment={onCommentCard}
            />
        {/each}
    </div>
</div>