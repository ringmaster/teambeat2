<script lang="ts">
  import { page } from '$app/stores';
  import ScorecardEditor from '$lib/components/ScorecardEditor.svelte';

  interface Props {
    data: {
      seriesId: string;
      scorecardId: string;
      canEdit: boolean;
    };
  }

  let { data }: Props = $props();
</script>

<div class="scorecard-editor-page">
  <div class="page-header">
    <a href="/series/{data.seriesId}/scorecards" class="back-link">
      ← Back to Scorecard Library
    </a>
  </div>

  <ScorecardEditor
    scorecardId={data.scorecardId}
    seriesId={data.seriesId}
    canEdit={data.canEdit}
  />
</div>

<style>
  .scorecard-editor-page {
    max-width: 80rem;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  .page-header {
    margin-bottom: 1.5rem;
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
