<script lang="ts">
    import Modal from "$lib/components/ui/Modal.svelte";
    import InputWithButton from "$lib/components/ui/InputWithButton.svelte";
    import { getUserDisplayName } from "$lib/utils/animalNames";

    interface Props {
        show: boolean;
        card: any;
        boardId: string;
        blameFreeMode?: boolean;
        onClose: () => void;
    }

    let {
        show,
        card,
        boardId,
        blameFreeMode = false,
        onClose,
    }: Props = $props();

    let comments = $state<any[]>([]);
    let newCommentContent = $state("");
    let loadingComments = $state(false);
    let savingComment = $state(false);

    // Load comments when modal opens or card changes
    $effect(() => {
        if (show && card) {
            loadComments();
        }
    });

    async function loadComments() {
        if (!card) return;

        loadingComments = true;
        try {
            const response = await fetch(`/api/cards/${card.id}/comments`);
            if (response.ok) {
                const data = await response.json();
                // Filter out reactions, only show actual comments
                comments = data.comments.filter((c: any) => !c.isReaction);
            }
        } catch (error) {
            console.error("Failed to load comments:", error);
        } finally {
            loadingComments = false;
        }
    }

    async function saveComment() {
        if (!card || !newCommentContent.trim() || savingComment) return;

        savingComment = true;
        try {
            const response = await fetch("/api/comments", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    card_id: card.id,
                    content: newCommentContent.trim(),
                    is_reaction: false,
                }),
            });

            if (response.ok) {
                // Clear input and reload comments
                newCommentContent = "";
                await loadComments();
            }
        } catch (error) {
            console.error("Failed to save comment:", error);
        } finally {
            savingComment = false;
        }
    }

    function handleClose() {
        newCommentContent = "";
        comments = [];
        onClose();
    }

    function formatDate(dateString: string) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return "just now";
        if (diffMins < 60)
            return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24)
            return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;

        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7)
            return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

        return date.toLocaleDateString();
    }
</script>

<Modal {show} title="Comments" onClose={handleClose} size="md">
    {#snippet children()}
        <div class="comment-modal-content">
            {#if card}
                <div class="card-preview">
                    <div class="card-content">{card.content}</div>
                </div>

                <div class="comments-section">
                    {#if loadingComments}
                        <div class="loading">Loading comments...</div>
                    {:else if comments.length > 0}
                        <div class="comments-list">
                            {#each comments as comment}
                                <div class="comment-item">
                                    <div class="comment-header">
                                        <span class="comment-author">
                                            {comment.userName || "Anonymous"}
                                        </span>
                                        <span class="comment-date">
                                            {formatDate(comment.createdAt)}
                                        </span>
                                    </div>
                                    <div class="comment-content">
                                        {comment.content}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <div class="no-comments">No comments yet</div>
                    {/if}
                </div>

                <div class="new-comment-section">
                    <InputWithButton
                        bind:value={newCommentContent}
                        placeholder="Add a comment..."
                        disabled={savingComment}
                        buttonVariant="ghost"
                        buttonDisabled={!newCommentContent.trim() || savingComment}
                        buttonAriaLabel="Submit comment"
                        onButtonClick={saveComment}
                        onkeydown={(e) => {
                            if (
                                e.key === "Enter" &&
                                e.ctrlKey &&
                                !savingComment
                            ) {
                                e.preventDefault();
                                saveComment();
                            }
                        }}
                    >
                        {#snippet buttonContent()}
                            ✓
                        {/snippet}
                    </InputWithButton>
                </div>
            {/if}
        </div>
    {/snippet}
</Modal>

<style lang="less">
    .comment-modal-content {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .card-preview {
        padding: 0.75rem;
        background-color: var(--surface-secondary);
        border-left: 4px solid var(--primary-color);
    }

    .card-content {
        color: var(--text-primary);
        font-size: 0.95rem;
        line-height: 1.5;
    }

    .comments-section {
        max-height: 300px;
        overflow-y: auto;
        padding: 0.5rem 0;
    }

    .loading {
        text-align: center;
        color: var(--text-secondary);
        padding: 2rem;
    }

    .no-comments {
        text-align: center;
        color: var(--text-secondary);
        padding: 2rem;
        font-style: italic;
    }

    .comments-list {
        display: flex;
        flex-direction: column;
        gap: 0;
    }

    .comment-item {
        padding: 0.75rem 0;
        border-bottom: 1px solid var(--color-border, #e5e7eb);

        &:last-child {
            border-bottom: none;
        }
    }

    .comment-item:not(:last-child) {
        margin-bottom: 0.5rem;
    }

    .comment-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }

    .comment-author {
        font-weight: 600;
        color: var(--text-primary);
        font-size: 0.9rem;
    }

    .comment-date {
        color: var(--text-secondary);
        font-size: 0.8rem;
    }

    .comment-content {
        color: var(--text-primary);
        font-size: 0.95rem;
        line-height: 1.4;
        white-space: pre-wrap;
        word-break: break-word;
    }

    .new-comment-section {
        border-top: 1px solid var(--color-border, #e5e7eb);
        padding-top: 0.75rem;
    }
</style>
