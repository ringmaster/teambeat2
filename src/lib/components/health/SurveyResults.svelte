<script lang="ts">
    import { onMount } from 'svelte';
    import RadarChart from './RadarChart.svelte';
    import QuestionDetail from './QuestionDetail.svelte';

    interface Props {
        sceneId: string;
        boardId: string;
        boardStatus: string;
        focusedQuestionId: string | null;
        isFacilitator: boolean;
        sceneFlags: string[];
        onFocusChange: (questionId: string | null) => void;
    }

    const { sceneId, boardId, boardStatus, focusedQuestionId, isFacilitator, sceneFlags, onFocusChange }: Props = $props();

    let results = $state<any[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

    async function loadResults() {
        try {
            loading = true;
            error = null;

            const res = await fetch(`/api/scenes/${sceneId}/health-results`);
            const data = await res.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to load results');
            }

            results = data.results;
        } catch (err) {
            console.error('Failed to load results:', err);
            error = err instanceof Error ? err.message : 'Failed to load results';
        } finally {
            loading = false;
        }
    }

    function handleQuestionClick(questionId: string) {
        if (isFacilitator) {
            onFocusChange(questionId);
        }
    }

    function handleBackToOverview() {
        if (isFacilitator) {
            onFocusChange(null);
        }
    }

    onMount(() => {
        loadResults();
    });

    const focusedQuestion = $derived(
        focusedQuestionId ? results.find(r => r.question.id === focusedQuestionId) : null
    );
</script>

<div class="survey-results">
    {#if loading}
        <div class="loading-state">
            <p>Loading results...</p>
        </div>
    {:else if error}
        <div class="error-state">
            <p>Error: {error}</p>
            <button onclick={loadResults} type="button">Retry</button>
        </div>
    {:else if results.length === 0}
        <div class="empty-state">
            <p>No survey data available</p>
        </div>
    {:else if focusedQuestion}
        <QuestionDetail
            result={focusedQuestion}
            {sceneId}
            {boardId}
            {boardStatus}
            {isFacilitator}
            {sceneFlags}
            onBack={handleBackToOverview}
        />
    {:else}
        <div class="results-overview">
            <h2>Survey Results Overview</h2>

            <div class="chart-container">
                <RadarChart {results} onQuestionClick={handleQuestionClick} />
            </div>

            <div class="questions-summary">
                <h3>Questions</h3>
                <div class="questions-list">
                    {#each results as result (result.question.id)}
                        <button
                            type="button"
                            class="question-summary-item"
                            onclick={() => handleQuestionClick(result.question.id)}
                        >
                            <div class="question-info">
                                <span class="question-text">{result.question.question}</span>
                                <span class="question-average">Avg: {result.average.toFixed(2)}</span>
                            </div>
                            <span class="question-responses">{result.totalResponses} responses</span>
                        </button>
                    {/each}
                </div>
            </div>
        </div>
    {/if}
</div>

<style lang="less">
    .survey-results {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        background-color: var(--color-bg-primary);
    }

    .loading-state,
    .error-state,
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--color-text-secondary);
        gap: 1.5rem;
        padding: 2rem;

        p {
            margin: 0;
            font-size: 1.125rem;
            font-weight: 500;
            color: var(--color-text-primary);
        }

        button {
            padding: 0.625rem 1.5rem;
            border: 1px solid var(--color-border);
            border-radius: var(--radius-lg);
            background-color: var(--btn-secondary-bg);
            color: var(--btn-secondary-text);
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            min-height: 44px;

            &:hover {
                background-color: var(--btn-secondary-bg-hover);
                border-color: var(--color-border-hover);
                transform: translateY(-1px);
                box-shadow: var(--shadow-sm);
            }
        }
    }

    .results-overview {
        flex: 1;
        overflow-y: auto;
        padding: 1.5rem;
        max-width: 1200px;
        margin: 0 auto;
        width: 100%;

        @media (min-width: 768px) {
            padding: 2rem;
        }

        h2 {
            margin: 0 0 2rem;
            font-size: 1.75rem;
            font-weight: 700;
            color: var(--color-text-primary);
            background: linear-gradient(
                135deg,
                var(--color-primary),
                var(--color-secondary)
            );
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        h3 {
            margin: 2.5rem 0 1rem;
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--color-text-primary);
        }
    }

    .chart-container {
        margin-bottom: 2.5rem;
        padding: 2rem;
        background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--color-primary) 3%, transparent),
            color-mix(in srgb, var(--color-secondary) 3%, transparent)
        );
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);

        @media (min-width: 768px) {
            padding: 2.5rem;
        }
    }

    .questions-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .question-summary-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.25rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        background-color: white;
        color: var(--color-text-primary);
        text-align: left;
        cursor: pointer;
        transition: all 0.2s ease;
        width: 100%;
        box-shadow: var(--shadow-sm);
        position: relative;
        overflow: hidden;

        &::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 4px;
            background: linear-gradient(
                180deg,
                var(--color-accent),
                var(--color-secondary)
            );
            opacity: 0;
            transition: opacity 0.2s ease;
        }

        &:hover {
            background-color: var(--surface-elevated);
            border-color: var(--color-primary);
            transform: translateX(4px);
            box-shadow: var(--shadow-md);

            &::before {
                opacity: 1;
            }
        }

        &:active {
            transform: translateX(2px);
        }
    }

    .question-info {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
        flex: 1;
    }

    .question-text {
        font-size: 0.9375rem;
        font-weight: 600;
        color: var(--color-text-primary);
        line-height: 1.4;
    }

    .question-average {
        font-size: 0.8125rem;
        color: var(--color-accent);
        font-weight: 600;
    }

    .question-responses {
        font-size: 0.8125rem;
        color: var(--color-text-secondary);
        white-space: nowrap;
        margin-left: 1.5rem;
        font-weight: 500;
    }
</style>
