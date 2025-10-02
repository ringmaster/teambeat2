<script lang="ts">
    import type { Column, Comment } from "$lib/types";
    import ReviewCardGroup from "./ReviewCardGroup.svelte";

    interface CardGroup {
        leadCard: any;
        subordinateCards: any[];
        columnId: string;
        columnName: string;
    }

    interface Props {
        column: Column;
        groups: CardGroup[];
        commentsByCard: (cardId: string) => Comment[];
        blameFreeMode: boolean;
        boardId: string;
    }

    const { column, groups, commentsByCard, blameFreeMode, boardId }: Props =
        $props();
</script>

<div class="review-column">
    <h2 class="column-title">{column.title}</h2>

    <div class="card-groups">
        {#each groups as group (group.leadCard.id)}
            <ReviewCardGroup
                {group}
                showColumnContext={false}
                {commentsByCard}
                {blameFreeMode}
                {boardId}
            />
        {/each}
    </div>
</div>

<style lang="less">
    .review-column {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .column-title {
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
        padding-bottom: 0.5rem;
        border-bottom: 2px solid var(--border-primary);
    }

    .card-groups {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }
</style>
