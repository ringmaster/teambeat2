<script lang="ts">
import { page } from "$app/stores";
import ScorecardManager from "$lib/components/ScorecardManager.svelte";

interface Props {
	data: {
		seriesId: string;
		canEdit: boolean;
	};
}

let { data }: Props = $props();

// Get boardId from query string if present
let boardId = $derived($page.url.searchParams.get("boardId"));
let backLink = $derived(boardId ? `/board/${boardId}` : "/");
let backText = $derived(boardId ? "← Return to Board" : "← Back to Dashboard");
</script>

<div class="scorecard-page">
  <div class="page-header">
    <a href={backLink} class="back-link">{backText}</a>
    <h1>Scorecard Configuration</h1>
  </div>

  <ScorecardManager seriesId={data.seriesId} canEdit={data.canEdit} />
</div>

<style lang="less">
  .scorecard-page {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .page-header {
    flex: 0 0 auto;
    padding: var(--spacing-4) var(--spacing-6);
    background-color: white;
    border-bottom: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    gap: var(--spacing-4);

    h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--color-text-primary);
      background: linear-gradient(
        135deg,
        var(--color-primary),
        var(--color-secondary)
      );
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
  }

  .back-link {
    color: var(--color-primary);
    text-decoration: none;
    font-weight: 600;
    font-size: 0.875rem;
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    transition: all 0.2s ease;
    padding: var(--spacing-2);
    border-radius: var(--radius-md);

    &:hover {
      color: var(--color-primary-hover);
      background-color: color-mix(in srgb, var(--color-primary) 8%, transparent);
      transform: translateX(-2px);
    }

    &:active {
      transform: translateX(0);
    }
  }
</style>
