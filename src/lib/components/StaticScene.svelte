<script lang="ts">
    import { marked } from "marked";
    import { onMount } from "svelte";

    interface Props {
        scene: any;
    }

    const { scene }: Props = $props();

    let renderedHTML = $state("");

    // Configure marked to use GitHub-flavored markdown
    onMount(() => {
        marked.setOptions({
            gfm: true,
            breaks: true,
        });

        // Render the markdown content
        if (scene.description) {
            renderedHTML = marked.parse(scene.description) as string;
        }
    });

    // Re-render when description changes
    $effect(() => {
        if (scene.description) {
            renderedHTML = marked.parse(scene.description) as string;
        } else {
            renderedHTML = "";
        }
    });
</script>

<div class="static-scene">
    <div class="static-content">
        {#if renderedHTML}
            {@html renderedHTML}
        {:else}
            <div class="empty-state">
                <p>No content configured for this scene</p>
            </div>
        {/if}
    </div>
</div>

<style lang="less">
    @import "$lib/styles/_mixins.less";

    .static-scene {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
    }

    .static-content {
        flex: 1;
        overflow-y: auto;
        padding: 2rem;
        max-width: 900px;
        margin: 0 auto;
        width: 100%;

        // Style the rendered markdown content
        :global(h1) {
            font-size: 2rem;
            font-weight: 700;
            margin: 2rem 0 1rem;
            color: var(--text-primary);
            border-bottom: 2px solid var(--border-primary);
            padding-bottom: 0.5rem;

            &:first-child {
                margin-top: 0;
            }
        }

        :global(h2) {
            font-size: 1.5rem;
            font-weight: 600;
            margin: 1.5rem 0 0.75rem;
            color: var(--text-primary);
        }

        :global(h3) {
            font-size: 1.25rem;
            font-weight: 600;
            margin: 1.25rem 0 0.5rem;
            color: var(--text-primary);
        }

        :global(p) {
            margin: 0.75rem 0;
            line-height: 1.6;
            color: var(--text-secondary);
        }

        :global(ul), :global(ol) {
            margin: 0.75rem 0;
            padding-left: 1.5rem;
            color: var(--text-secondary);

            :global(li) {
                margin: 0.25rem 0;
                line-height: 1.6;
            }
        }

        :global(ul) {
            list-style-type: disc;
        }

        :global(ol) {
            list-style-type: decimal;
        }

        :global(code) {
            background-color: var(--surface-secondary);
            padding: 0.125rem 0.25rem;
            border-radius: 0.25rem;
            font-family: 'Courier New', Courier, monospace;
            font-size: 0.875em;
            color: var(--text-primary);
        }

        :global(pre) {
            background-color: var(--surface-secondary);
            padding: 1rem;
            border-radius: 0.5rem;
            overflow-x: auto;
            margin: 1rem 0;

            :global(code) {
                background-color: transparent;
                padding: 0;
            }
        }

        :global(blockquote) {
            border-left: 4px solid var(--border-primary);
            padding-left: 1rem;
            margin: 1rem 0;
            color: var(--text-secondary);
            font-style: italic;
        }

        :global(a) {
            color: var(--accent-primary);
            text-decoration: none;

            &:hover {
                text-decoration: underline;
            }
        }

        :global(table) {
            border-collapse: collapse;
            width: 100%;
            margin: 1rem 0;
        }

        :global(th), :global(td) {
            border: 1px solid var(--border-secondary);
            padding: 0.5rem;
            text-align: left;
        }

        :global(th) {
            background-color: var(--surface-secondary);
            font-weight: 600;
        }

        :global(img) {
            max-width: 100%;
            height: auto;
            border-radius: 0.5rem;
            margin: 1rem 0;
        }

        :global(hr) {
            border: none;
            border-top: 1px solid var(--border-secondary);
            margin: 2rem 0;
        }
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--text-muted);
        gap: 1rem;

        p {
            margin: 0;
            font-size: 1.125rem;
        }
    }
</style>
