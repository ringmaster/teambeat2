<script lang="ts">
  import { page } from '$app/stores';
  import ScorecardManager from '$lib/components/ScorecardManager.svelte';

  interface Props {
    data: {
      seriesId: string;
      canEdit: boolean;
    };
  }

  let { data }: Props = $props();

  // Get boardId from query string if present
  let boardId = $derived($page.url.searchParams.get('boardId'));
  let backLink = $derived(boardId ? `/board/${boardId}` : '/');
  let backText = $derived(boardId ? '← Return to Board' : '← Back to Dashboard');
</script>

<div class="scorecard-page">
  <div class="page-header">
    <a href={backLink} class="back-link">{backText}</a>
    <h1>Scorecard Configuration</h1>
  </div>

  <ScorecardManager seriesId={data.seriesId} canEdit={data.canEdit} />
</div>

<style>
  .scorecard-page {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .page-header {
    flex: 0 0 auto;
    padding: 1rem 1.5rem;
    background-color: #fff;
    border-bottom: 1px solid #ddd;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .page-header h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .back-link {
    color: #007bff;
    text-decoration: none;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .back-link:hover {
    text-decoration: underline;
  }
</style>
