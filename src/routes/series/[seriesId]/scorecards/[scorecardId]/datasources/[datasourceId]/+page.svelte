<script lang="ts">
  import { page } from '$app/stores';
  import DatasourceEditor from '$lib/components/DatasourceEditor.svelte';

  interface Props {
    data: {
      seriesId: string;
      scorecardId: string;
      datasourceId?: string;
      isNew: boolean;
    };
  }

  let { data }: Props = $props();
</script>

<div class="datasource-editor-page">
  <div class="page-header">
    <a href="/series/{data.seriesId}/scorecards/{data.scorecardId}" class="back-link">
      ← Back to Scorecard
    </a>
  </div>

  <DatasourceEditor
    scorecardId={data.scorecardId}
    datasourceId={data.isNew ? undefined : data.datasourceId}
    seriesId={data.seriesId}
  />
</div>

<style>
  .datasource-editor-page {
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
