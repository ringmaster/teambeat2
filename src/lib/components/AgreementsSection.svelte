<script lang="ts">
    import moment from "moment";

    interface Agreement {
        id: string;
        content: string;
        cardTitle: string | null;
        source?: 'agreement' | 'comment';
        completed?: boolean;
        completedAt?: string | null;
    }

    interface Props {
        agreements: Agreement[];
    }

    const { agreements }: Props = $props();

    // Format date as yyyy-mm-dd
    function formatDateYYYYMMDD(dateString: string | null | undefined): string {
        if (!dateString) return "";
        return moment(dateString).format('YYYY-MM-DD');
    }
</script>

<div class="agreements-section">
    <h2 class="section-title">
        <div class="section-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
                <path
                    d="M9 12l2 2 4-4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
            </svg>
        </div>
        Agreements
    </h2>

    <ul class="agreements-list">
        {#each agreements as agreement (agreement.id)}
            <li class="agreement-item" class:completed={agreement.completed}>
                <div class="agreement-content">{agreement.content}</div>
                <div class="agreement-metadata">
                    {#if agreement.cardTitle}
                        <div class="agreement-source">
                            from: {agreement.cardTitle}
                        </div>
                    {:else}
                        <div class="agreement-source">
                            board-level agreement
                        </div>
                    {/if}
                    {#if agreement.completed && agreement.completedAt}
                        <div class="agreement-completed">
                            Completed on {formatDateYYYYMMDD(agreement.completedAt)}
                        </div>
                    {/if}
                </div>
            </li>
        {/each}
    </ul>
</div>

<style lang="less">
    @import "$lib/styles/_mixins.less";
    .agreements-section {
        .page-width();
        background-color: white;
        backdrop-filter: none;
        border: none;
        box-shadow: 0 1px 3px #000000;
        border-radius: 1rem;
        padding: var(--spacing-8);
        box-shadow: var(--shadow-xl);
        margin: 0 auto;
        width: 60%;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding-top: 2rem;
        border-top: 2px solid var(--border-primary);
    }

    .section-title {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
    }

    .section-icon {
        width: 32px;
        height: 32px;
        flex-shrink: 0;
        color: var(--accent-success);

        svg {
            width: 100%;
            height: 100%;
        }
    }

    .agreements-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .agreement-item {
        background: var(--background-primary);
        border: 1px solid var(--border-secondary);
        border-left: 4px solid var(--accent-success);
        border-radius: 0.5rem;
        padding: 1rem 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;

        &.completed {
            opacity: 0.7;

            .agreement-content {
                text-decoration: line-through;
            }
        }
    }

    .agreement-content {
        color: var(--text-primary);
        font-size: 1rem;
        line-height: 1.5;
    }

    .agreement-metadata {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .agreement-source {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--text-secondary);
        font-size: 0.875rem;
        font-style: italic;
    }

    .agreement-completed {
        color: var(--accent-success);
        font-size: 0.875rem;
        font-weight: 500;
    }
</style>
