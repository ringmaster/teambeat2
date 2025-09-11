<script lang="ts">
    interface Props {
        votes: number;
        total: number;
        enabled: boolean;
        hasVotes: boolean;
        view: "votes" | "total" | "both";
        itemID: string;
        onVote: (itemID: string, delta: 1 | -1) => void;
    }

    let {
        votes = 0,
        total = 0,
        enabled = false,
        hasVotes = false,
        view = "votes",
        itemID,
        onVote,
    }: Props = $props();

    let isAnimating = false;
    let animationDirection: "up" | "down" | null = null;

    // Display logic based on view property
    let displayText = $derived.by(() => {
        switch (view) {
            case "votes":
                return votes.toString();
            case "total":
                return total.toString();
            case "both":
                return `${votes}/${total}`;
            default:
                return votes.toString();
        }
    });

    // Show down arrow when enabled and user has votes
    let showDownArrow = $derived(enabled && votes > 0);

    // Show up arrow when enabled and user has votes to cast
    let showUpArrow = $derived(enabled && hasVotes);

    // Add "voted" class when user has voted
    let hasVoted = $derived(votes > 0);

    function handleUpVote() {
        if (!enabled || !hasVotes) return;

        animationDirection = "up";
        isAnimating = true;

        onVote(itemID, 1);

        setTimeout(() => {
            isAnimating = false;
            animationDirection = null;
        }, 2000);
    }

    function handleDownVote() {
        if (!enabled || votes <= 0) return;

        animationDirection = "down";
        isAnimating = true;

        onVote(itemID, -1);

        setTimeout(() => {
            isAnimating = false;
            animationDirection = null;
        }, 2000);
    }

    function handleVoteCountClick() {
        if (!enabled) return;

        if (votes > 0) {
            handleDownVote();
        } else if (hasVotes) {
            handleUpVote();
        }
    }
</script>

<div
    class="vote-container"
    class:voted={hasVoted}
    aria-label="Voting control for item {itemID}"
    role="group"
>
    {#if showDownArrow}
        <button
            class="vote-arrow vote-arrow-down"
            onclick={handleDownVote}
            aria-label="Remove vote from {itemID}"
            tabindex="0"
        >
            <svg viewBox="0 0 12 12" class="vote-triangle">
                <path d="M6 9L2 3h8L6 9z" fill="currentColor" />
            </svg>
        </button>
    {:else}
        <div class="vote-arrow-spacer"></div>
    {/if}

    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
        class="vote-count-container"
        onclick={handleVoteCountClick}
        role={enabled ? "button" : undefined}
        tabindex={enabled ? 0 : undefined}
        aria-label={enabled
            ? "Toggle vote for {itemID}"
            : "Vote count for {itemID}"}
    >
        <div class="vote-icon">
            <svg class="vote-svg" viewBox="0 0 512 512">
                <path
                    fill="currentColor"
                    d="M411.8 80.9l22.8-16.7 58 0L477.4 78.3c-47 43.2-105.7 109.9-159 181.1c-27.2 36.3-79.9 114.1-89.4 132.2c-3 5.5-5.7 9.9-6.3 9.9c-.6-.2-6.1-8.4-12.4-18.3c-17.1-26.8-43-62-80.7-109l-33.8-42L109 219c7.4-7.4 14.3-13.5 15.6-13.5c1.1 0 23.4 12.4 49.5 27.4l47.5 27.4 6.3-6.9c3.6-3.8 16.2-18.1 28-31.6c42-47.2 103.7-103.3 155.8-140.8zM62.4 102.6c11.2-4.2 15-4.4 129.7-4.4l118.1-.2-17.9 16.9-17.9 16.6-95.9 .2c-95.3 0-96.2 0-105.4 4.6c-7 3.6-10.8 7.4-14.1 14.3L54 159.9 54 407l4.8 9.3c3.4 6.9 7.2 10.8 14.1 14.3l9.2 4.6 247.1 0 9.3-4.9c6.9-3.4 10.8-7.2 14.3-14.1c4.4-9.1 4.6-11.4 4.6-68.1l0-58.6L374 268.3 390.3 247l.6 83.5c.4 81.2 .4 83.7-4 95.7c-6.3 16.4-21.9 32.1-38.4 38.1c-12 4.7-14.1 4.7-142.8 4.7c-128.6 0-130.7 0-142.8-4.7c-16.2-6.1-32-21.9-38.2-38.1c-4.6-12-4.6-14.1-4.6-142.8s0-130.7 4.6-142.8c5.9-16 22-32.1 37.5-38.2z"
                ></path>
            </svg>
        </div>

        <div
            class="vote-number"
            class:vote-number-animating={isAnimating}
            class:vote-number-up={animationDirection === "up"}
            class:vote-number-down={animationDirection === "down"}
        >
            {displayText}
        </div>
    </div>

    {#if showUpArrow}
        <button
            class="vote-arrow vote-arrow-up"
            onclick={handleUpVote}
            aria-label="Add vote to {itemID}"
            tabindex="0"
        >
            <svg viewBox="0 0 12 12" class="vote-triangle">
                <path d="M6 3L10 9H2L6 3z" fill="currentColor" />
            </svg>
        </button>
    {:else}
        <div class="vote-arrow-spacer"></div>
    {/if}
</div>

<style>
    .vote-container {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--spacing-2);
        min-width: 4rem;
        height: 2rem;
        color: var(--color-text-secondary);
        user-select: none;
    }

    .vote-container.voted {
        color: var(--color-primary);
    }

    .vote-container.voted .vote-icon {
        color: var(--color-primary);
    }

    .vote-arrow {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 1.5rem;
        height: 1.5rem;
        border: none;
        background: none;
        cursor: pointer;
        border-radius: var(--radius-md);
        transition: all var(--transition-fast);
        color: var(--color-text-muted);
        padding: 0;
    }

    .vote-arrow:hover {
        background-color: var(--surface-elevated);
        transform: scale(1.1);
    }

    .vote-arrow-down {
        color: var(--color-danger);
    }

    .vote-arrow-down:hover {
        background-color: color-mix(
            in srgb,
            var(--color-danger) 10%,
            transparent
        );
        color: var(--color-danger-hover);
    }

    .vote-arrow-up {
        color: var(--color-success);
    }

    .vote-arrow-up:hover {
        background-color: color-mix(
            in srgb,
            var(--color-success) 10%,
            transparent
        );
        color: var(--color-success-hover);
    }

    .vote-arrow-spacer {
        width: 1.5rem;
        height: 1.5rem;
    }

    .vote-triangle {
        width: 0.75rem;
        height: 0.75rem;
        transition: transform var(--transition-fast);
    }

    .vote-count-container {
        display: flex;
        align-items: center;
        gap: var(--spacing-1);
        flex: 1;
        justify-content: center;
        border-radius: var(--radius-md);
        padding: var(--spacing-1);
        transition: all var(--transition-fast);
        min-height: 1.5rem;
    }

    .vote-count-container[role="button"] {
        cursor: pointer;
    }

    .vote-count-container[role="button"]:hover {
        background-color: var(--surface-elevated);
    }

    .vote-icon {
        display: flex;
        align-items: center;
        color: var(--color-text-muted);
        transition: color var(--transition-fast);
    }

    .vote-svg {
        width: 0.875rem;
        height: 0.875rem;
    }

    .vote-number {
        font-size: 0.875rem;
        font-weight: 500;
        line-height: 1;
        color: var(--color-text-secondary);
        transition: all var(--transition-fast);
        min-width: 1.25rem;
        text-align: center;
    }

    .vote-container.voted .vote-number {
        color: var(--color-primary);
        font-weight: 600;
    }

    .vote-number-animating {
        animation-duration: 200ms;
        animation-timing-function: ease-out;
        animation-fill-mode: forwards;
    }

    .vote-number-up {
        animation-name: roll-up;
    }

    .vote-number-down {
        animation-name: roll-down;
    }

    @keyframes roll-up {
        0% {
            transform: translateY(0);
            opacity: 1;
        }
        50% {
            transform: translateY(-0.25rem);
            opacity: 0.7;
        }
        100% {
            transform: translateY(0);
            opacity: 1;
        }
    }

    @keyframes roll-down {
        0% {
            transform: translateY(0);
            opacity: 1;
        }
        50% {
            transform: translateY(0.25rem);
            opacity: 0.7;
        }
        100% {
            transform: translateY(0);
            opacity: 1;
        }
    }
</style>
