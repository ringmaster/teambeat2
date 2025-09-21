<script lang="ts">
    import type { PageData } from "./$types";

    interface Props {
        data: PageData;
    }

    let { data }: Props = $props();
</script>

<svelte:head>
    <title>{data.title} - TeamBeat</title>
</svelte:head>

<div class="page-container">
    <div class="page-content">
        <!-- Safe to use {@html} here - content comes from trusted static HTML files, not user input -->
        {@html data.content}
    </div>
</div>

<style>
    .page-container {
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem;
        min-height: calc(100vh - 4rem);
    }

    .page-content {
        line-height: 1.6;
        color: var(--text-color);
    }

    .page-content :global(h1) {
        color: var(--text-primary);
        font-size: 2rem;
        margin-bottom: 1.5rem;
        border-bottom: 2px solid var(--border-color);
        padding-bottom: 0.5rem;
    }

    .page-content :global(h2) {
        color: var(--text-primary);
        font-size: 1.5rem;
        margin-top: 2rem;
        margin-bottom: 1rem;
    }

    .page-content :global(h3) {
        color: var(--text-primary);
        font-size: 1.25rem;
        margin-top: 1.5rem;
        margin-bottom: 0.75rem;
    }

    .page-content :global(p) {
        margin-bottom: 1rem;
    }

    .page-content :global(ul),
    .page-content :global(ol) {
        margin-bottom: 1rem;
        padding-left: 2rem;
    }

    .page-content :global(li) {
        margin-bottom: 0.5rem;
    }

    .page-content :global(a) {
        color: var(--primary-color);
        text-decoration: none;
    }

    .page-content :global(a:hover) {
        text-decoration: underline;
    }

    .page-content :global(code) {
        background: var(--bg-secondary);
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-family: monospace;
        font-size: 0.875rem;
    }

    .page-content :global(pre) {
        background: var(--bg-secondary);
        padding: 1rem;
        border-radius: 8px;
        overflow-x: auto;
        margin-bottom: 1rem;
    }

    .page-content :global(blockquote) {
        border-left: 4px solid var(--primary-color);
        padding-left: 1rem;
        margin: 1rem 0;
        font-style: italic;
        color: var(--text-muted);
    }

    .page-content :global(table) {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 1rem;
    }

    .page-content :global(th),
    .page-content :global(td) {
        border: 1px solid var(--border-color);
        padding: 0.5rem;
        text-align: left;
    }

    .page-content :global(th) {
        background: var(--bg-secondary);
        font-weight: 600;
    }
</style>
