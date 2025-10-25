<script lang="ts">
import { marked } from "marked";
import type { Comment } from "$lib/types";
import { getUserDisplayName } from "$lib/utils/animalNames";
import Icon from "./ui/Icon.svelte";

// Configure marked for GitHub-flavored markdown
marked.setOptions({
	gfm: true,
	breaks: true,
});

interface CardGroup {
	leadCard: any;
	subordinateCards: any[];
	columnId: string;
	columnName: string;
}

interface Props {
	group: CardGroup;
	showColumnContext: boolean;
	commentsByCard: (cardId: string) => Comment[];
	blameFreeMode: boolean;
	boardId: string;
}

const {
	group,
	showColumnContext,
	commentsByCard,
	blameFreeMode,
	boardId,
}: Props = $props();

const voteCount = $derived(group.leadCard.voteCount || 0);
const cardComments = $derived(commentsByCard(group.leadCard.id));
const renderedLeadContent = $derived(
	marked.parse(group.leadCard.content) as string,
);
const renderedSubordinateContent = (content: string) =>
	marked.parse(content) as string;

function getDisplayName(comment: Comment): string {
	const userName = comment.userName || "Anonymous";
	return getUserDisplayName(userName, boardId, blameFreeMode);
}
</script>

<div class="card-group">
    <div class="lead-card">
        <div class="lead-card-header">
            <div class="card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect
                        x="3"
                        y="3"
                        width="18"
                        height="18"
                        rx="2"
                        ry="2"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                    <line
                        x1="9"
                        y1="9"
                        x2="15"
                        y2="9"
                        stroke-width="2"
                        stroke-linecap="round"
                    />
                    <line
                        x1="9"
                        y1="12"
                        x2="15"
                        y2="12"
                        stroke-width="2"
                        stroke-linecap="round"
                    />
                    <line
                        x1="9"
                        y1="15"
                        x2="13"
                        y2="15"
                        stroke-width="2"
                        stroke-linecap="round"
                    />
                </svg>
            </div>
            <div class="lead-card-content-wrapper">
                <div class="lead-card-title markdown">
                    {@html renderedLeadContent}
                </div>
                {#if voteCount > 0}
                    <div class="vote-count">
                        ({voteCount}
                        {voteCount === 1 ? "vote" : "votes"})
                    </div>
                {/if}
            </div>
        </div>

        {#if group.subordinateCards.length > 0}
            <div class="subordinate-cards">
                {#each group.subordinateCards as subCard (subCard.id)}
                    {@const subComments = commentsByCard(subCard.id)}
                    <div class="subordinate-card">
                        <div class="subordinate-indicator"></div>
                        <div class="subordinate-content">
                            <div class="subordinate-title markdown">
                                {@html renderedSubordinateContent(subCard.content)}
                            </div>
                            {#if subComments.length > 0}
                                <div class="subordinate-comments">
                                    {#each subComments as comment (comment.id)}
                                        <div class="subordinate-comment">
                                            <span
                                                class="subordinate-comment-author"
                                                >{getDisplayName(
                                                    comment,
                                                )}:</span
                                            >
                                            <span
                                                class="subordinate-comment-content"
                                                >{comment.content}</span
                                            >
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}

        {#if showColumnContext}
            <div class="column-context">
                <span>Originally in: {group.columnName}</span>
            </div>
        {/if}

        {#if group.leadCard.notes}
            <div class="lead-card-notes">
                {group.leadCard.notes}
            </div>
        {/if}

        {#if cardComments.length > 0}
            <div class="comments-section">
                <div class="comments-header">Comments</div>
                {#each cardComments as comment (comment.id)}
                    <div class="comment">
                        <div class="comment-author">
                            {getDisplayName(comment)}
                        </div>
                        <div class="comment-content">{comment.content}</div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<style lang="less">
    .card-group {
        display: flex;
        flex-direction: column;
    }

    .lead-card {
        background: var(--background-primary);
        border: 1px solid var(--border-secondary);
        border-radius: 0.5rem;
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .lead-card-header {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
    }

    .card-icon {
        width: 32px;
        height: 32px;
        flex-shrink: 0;
        color: var(--accent-primary);
        opacity: 0.7;

        svg {
            width: 100%;
            height: 100%;
        }
    }

    .lead-card-content-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .lead-card-title {
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--text-primary);
        line-height: 1.4;
    }

    .vote-count {
        font-size: 0.9375rem;
        font-weight: 400;
        color: var(--text-secondary);
    }

    .column-context {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--text-secondary);
        font-size: 0.875rem;
        font-style: italic;
        padding: 0.5rem 0.75rem;
        background: var(--background-secondary);
        border-radius: 0.375rem;
    }

    .lead-card-notes {
        color: var(--text-primary);
        line-height: 1.6;
        white-space: pre-wrap;
        word-wrap: break-word;
        padding: 0.75rem 0;
        border-top: 1px solid var(--border-secondary);
    }

    .subordinate-cards {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-top: 0.5rem;
        padding-left: 1rem;
        border-left: 3px solid var(--border-primary);
    }

    .subordinate-card {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
    }

    .subordinate-indicator {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--accent-secondary);
        margin-top: 0.5rem;
        flex-shrink: 0;
    }

    .subordinate-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .subordinate-title {
        font-size: 0.9375rem;
        color: var(--text-secondary);
        line-height: 1.5;
    }

    .subordinate-comments {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding-left: 0.5rem;
    }

    .subordinate-comment {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        font-size: 0.8125rem;
        line-height: 1.5;
    }

    .subordinate-comment-author {
        font-weight: 600;
        color: var(--text-secondary);
    }

    .subordinate-comment-content {
        color: var(--text-primary);
        white-space: pre-wrap;
        word-wrap: break-word;
    }

    .comments-section {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-top: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px solid var(--border-secondary);
    }

    .comments-header {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .comment {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 0.625rem 0.875rem;
        background: var(--background-secondary);
        border-radius: 0.375rem;
        border-left: 3px solid var(--accent-secondary);
    }

    .comment-author {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--text-secondary);
    }

    .comment-content {
        font-size: 0.9375rem;
        color: var(--text-primary);
        line-height: 1.5;
        white-space: pre-wrap;
        word-wrap: break-word;
    }
</style>
