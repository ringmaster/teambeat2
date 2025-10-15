<script lang="ts">
    import { onMount, onDestroy } from 'svelte';

    interface Props {
        sceneId: string;
        boardId: string;
        displayMode: 'collecting' | 'results';
        isFacilitator: boolean;
        onModeChange: (mode: 'collecting' | 'results') => void;
    }

    const { sceneId, boardId, displayMode, isFacilitator, onModeChange }: Props = $props();

    let stats = $state<{
        active_users_count: number;
        active_users_completed: number;
        total_expected_responses: number;
    } | null>(null);
    let loading = $state(true);
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    async function loadStats() {
        if (!isFacilitator) {
            return;
        }

        try {
            const res = await fetch(`/api/boards/${boardId}/scenes/${sceneId}/facilitator-stats`);
            const data = await res.json();

            if (data.success) {
                stats = data.stats;
            }
        } catch (err) {
            console.error('Failed to load facilitator stats:', err);
        } finally {
            loading = false;
        }
    }

    function handlePresenceUpdate() {
        // Reload stats when presence changes
        loadStats();
    }

    onMount(() => {
        loadStats();

        // Poll every 5 seconds
        pollInterval = setInterval(loadStats, 5000);

        // Listen for presence updates
        window.addEventListener('presence_updated', handlePresenceUpdate);
    });

    onDestroy(() => {
        if (pollInterval) {
            clearInterval(pollInterval);
        }
        window.removeEventListener('presence_updated', handlePresenceUpdate);
    });
</script>

{#if isFacilitator && stats}
    <div class="facilitator-toolbar">
        <div class="toolbar-stats">
            <span class="stat-text">
                {stats.active_users_completed}/{stats.active_users_count} active users have completed,
                {stats.total_expected_responses} total responses expected
            </span>
        </div>

        <div class="toolbar-controls">
            <div class="mode-toggle">
                <button
                    type="button"
                    class="mode-button"
                    class:active={displayMode === 'collecting'}
                    onclick={() => onModeChange('collecting')}
                >
                    Survey
                </button>
                <button
                    type="button"
                    class="mode-button"
                    class:active={displayMode === 'results'}
                    onclick={() => onModeChange('results')}
                >
                    Results
                </button>
            </div>
        </div>
    </div>
{/if}

<style lang="less">
    .facilitator-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem;
        background-color: var(--surface-elevated);
        border-bottom: 1px solid var(--color-border);
        gap: 1rem;
        flex-wrap: wrap;
        max-width: var(--board-header-width);
        margin: 0 auto;
        width: 100%;
        animation: slideDown 0.3s ease-out;

        @media (min-width: 768px) {
            padding: 1rem 2rem;
        }
    }

    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .toolbar-stats {
        flex: 1;
        min-width: 250px;
    }

    .stat-text {
        font-size: 0.875rem;
        color: var(--color-text-primary);
        font-weight: 500;
        line-height: 1.5;
    }

    .toolbar-controls {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .mode-toggle {
        display: flex;
        gap: 0;
        background-color: color-mix(in srgb, var(--color-primary) 8%, transparent);
        border-radius: var(--radius-lg);
        padding: 0.25rem;
        border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
    }

    .mode-button {
        padding: 0.5rem 1.25rem;
        border: none;
        border-radius: calc(var(--radius-lg) - 0.125rem);
        background-color: transparent;
        color: var(--color-primary);
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        min-height: 36px;
        white-space: nowrap;

        &:hover:not(.active) {
            background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
            color: var(--color-primary-hover);
        }

        &.active {
            background-color: var(--btn-primary-bg);
            color: var(--btn-primary-text);
            box-shadow:
                inset 0 1px 2px rgba(0, 0, 0, 0.1),
                0 1px 2px rgba(0, 0, 0, 0.05);
        }
    }
</style>
