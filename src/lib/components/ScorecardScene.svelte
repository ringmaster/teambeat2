<script lang="ts">
  import { onMount } from 'svelte';
  import type { SceneScorecard, SceneScorecardResult } from '$lib/types/scorecard';

  interface Props {
    sceneId: string;
    boardId: string;
    canEdit: boolean;
  }

  let { sceneId, boardId, canEdit }: Props = $props();

  let sceneScorecards = $state<SceneScorecard[]>([]);
  let selectedScorecardId = $state<string | null>(null);
  let results = $state<SceneScorecardResult[]>([]);
  let loading = $state(true);
  let processing = $state(false);
  let error = $state<string | null>(null);
  let showDataDialog = $state(false);
  let dataInputs = $state<Record<string, string>>({});
  let processedAt = $state<string | null>(null);

  let selectedScorecard = $derived(
    sceneScorecards.find(ss => ss.id === selectedScorecardId) || sceneScorecards[0]
  );

  let resultsBySectionAndDatasource = $derived(() => {
    const grouped: Record<string, Record<string, SceneScorecardResult[]>> = {};

    results.forEach(result => {
      if (!grouped[result.section]) {
        grouped[result.section] = {};
      }
      if (!grouped[result.section][result.datasourceId]) {
        grouped[result.section][result.datasourceId] = [];
      }
      grouped[result.section][result.datasourceId].push(result);
    });

    return grouped;
  });

  async function loadSceneScorecards() {
    try {
      loading = true;
      error = null;
      const response = await fetch(`/api/scenes/${sceneId}/scorecards`);
      const data = await response.json();

      if (data.success) {
        sceneScorecards = data.sceneScorecards;
        if (sceneScorecards.length > 0) {
          selectedScorecardId = sceneScorecards[0].id;
          await loadResults();
        }
      } else {
        error = data.error || 'Failed to load scorecards';
      }
    } catch (e) {
      error = 'Failed to load scorecards';
      console.error('Error loading scorecards:', e);
    } finally {
      loading = false;
    }
  }

  async function loadResults() {
    if (!selectedScorecard) return;

    try {
      const response = await fetch(`/api/scene-scorecards/${selectedScorecard.id}/results`);
      const data = await response.json();

      if (data.success) {
        results = data.results;
        processedAt = data.processedAt;
      } else {
        error = data.error || 'Failed to load results';
      }
    } catch (e) {
      error = 'Failed to load results';
      console.error('Error loading results:', e);
    }
  }

  function openDataDialog() {
    if (!selectedScorecard) return;

    // Initialize data inputs for each datasource
    const inputs: Record<string, string> = {};
    selectedScorecard.datasources?.forEach(ds => {
      inputs[ds.id] = '';
    });
    dataInputs = inputs;
    showDataDialog = true;
  }

  async function processData() {
    if (!selectedScorecard) return;

    try {
      processing = true;
      error = null;

      // Parse JSON for each datasource
      const datasourceData: Record<string, any> = {};
      for (const [datasourceId, jsonStr] of Object.entries(dataInputs)) {
        if (jsonStr.trim()) {
          try {
            datasourceData[datasourceId] = JSON.parse(jsonStr);
          } catch (e) {
            error = `Invalid JSON for datasource ${datasourceId}`;
            return;
          }
        }
      }

      const response = await fetch(`/api/scene-scorecards/${selectedScorecard.id}/collect-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasource_data: datasourceData })
      });

      const data = await response.json();

      if (data.success) {
        showDataDialog = false;
        await loadResults();
      } else {
        error = data.error || 'Failed to process data';
      }
    } catch (e) {
      error = 'Failed to process data';
      console.error('Error processing data:', e);
    } finally {
      processing = false;
    }
  }

  async function flagResult(resultId: string) {
    // This would create a card with the result details
    // For now, we'll just show an alert
    // In a real implementation, this would integrate with the card system
    try {
      const response = await fetch(`/api/scene-scorecard-results/${resultId}/flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: 'temp-card-id' }) // Would create actual card
      });

      const data = await response.json();

      if (data.success) {
        alert('Result flagged for discussion');
      } else {
        error = data.error || 'Failed to flag result';
      }
    } catch (e) {
      error = 'Failed to flag result';
      console.error('Error flagging result:', e);
    }
  }

  onMount(() => {
    loadSceneScorecards();
  });
</script>

<div class="scorecard-scene">
  {#if loading}
    <div class="loading">Loading scorecards...</div>
  {:else if sceneScorecards.length === 0}
    <div class="empty-state">
      <p>No scorecard attached to this scene.</p>
      {#if canEdit}
        <p>Attach a scorecard in the board configuration.</p>
      {/if}
    </div>
  {:else}
    <div class="scene-header">
      {#if sceneScorecards.length > 1}
        <select bind:value={selectedScorecardId} onchange={() => loadResults()}>
          {#each sceneScorecards as ss}
            <option value={ss.id}>{ss.scorecard.name}</option>
          {/each}
        </select>
      {:else if selectedScorecard}
        <h2>{selectedScorecard.scorecard.name}</h2>
      {/if}

      {#if canEdit}
        <button onclick={openDataDialog} class="btn-primary">
          Collect Data
        </button>
      {/if}
    </div>

    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if processedAt}
      <div class="processed-info">
        Last processed: {new Date(processedAt).toLocaleString()}
      </div>
    {/if}

    {#if results.length === 0}
      <div class="empty-state">
        <p>No data collected yet.</p>
        {#if canEdit}
          <p>Click "Collect Data" to paste data and process rules.</p>
        {/if}
      </div>
    {:else}
      <div class="results-container">
        {#each Object.entries(resultsBySectionAndDatasource()) as [section, datasources]}
          <div class="section">
            <h3>{section}</h3>
            {#each Object.entries(datasources) as [datasourceId, sectionResults]}
              <div class="datasource-results">
                {#each sectionResults as result}
                  <div class="result-card severity-{result.severity}">
                    <div class="result-header">
                      <span class="result-title">{result.title}</span>
                      <span class="result-severity">{result.severity}</span>
                    </div>
                    {#if result.primaryValue}
                      <div class="result-value">{result.primaryValue}</div>
                    {/if}
                    {#if result.secondaryValues}
                      <div class="result-secondary">
                        {#each JSON.parse(result.secondaryValues) as value}
                          <span class="secondary-value">{value}</span>
                        {/each}
                      </div>
                    {/if}
                    {#if canEdit}
                      <button onclick={() => flagResult(result.id)} class="btn-flag">
                        Flag for Discussion
                      </button>
                    {/if}
                  </div>
                {/each}
              </div>
            {/each}
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  {#if showDataDialog && selectedScorecard}
    <div class="dialog-overlay" onclick={() => showDataDialog = false}>
      <div class="dialog" onclick={(e) => e.stopPropagation()}>
        <h3>Collect Data</h3>
        <p>Paste JSON data for each datasource below:</p>

        <form onsubmit={(e) => { e.preventDefault(); processData(); }}>
          {#each selectedScorecard.datasources || [] as datasource}
            <div class="form-group">
              <label>{datasource.name}</label>
              <textarea
                bind:value={dataInputs[datasource.id]}
                placeholder="Paste JSON data here"
                rows="6"
              ></textarea>
            </div>
          {/each}

          <div class="dialog-actions">
            <button type="button" onclick={() => showDataDialog = false} class="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={processing} class="btn-primary">
              {processing ? 'Processing...' : 'Process Data'}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .scorecard-scene {
    padding: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .loading {
    text-align: center;
    padding: 3rem;
    color: #666;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #666;
  }

  .empty-state p {
    margin: 0.5rem 0;
  }

  .scene-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .scene-header h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  .scene-header select {
    padding: 0.5rem;
    font-size: 1.25rem;
    font-weight: 500;
    border: 1px solid #ddd;
    border-radius: 4px;
  }

  .error-message {
    padding: 0.75rem;
    background-color: #fee;
    border: 1px solid #fcc;
    border-radius: 4px;
    color: #c33;
    margin-bottom: 1rem;
  }

  .processed-info {
    padding: 0.5rem;
    background-color: #e7f3ff;
    border-radius: 4px;
    font-size: 0.875rem;
    color: #004085;
    margin-bottom: 1rem;
  }

  .results-container {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.25rem;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid #007bff;
  }

  .datasource-results {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .result-card {
    border: 2px solid #ddd;
    border-radius: 6px;
    padding: 1rem;
    background-color: #fff;
  }

  .result-card.severity-warning {
    border-color: #ffc107;
    background-color: #fff8e1;
  }

  .result-card.severity-critical {
    border-color: #dc3545;
    background-color: #ffe6e6;
  }

  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .result-title {
    font-weight: 600;
    font-size: 1.0625rem;
  }

  .result-severity {
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .severity-info .result-severity {
    background-color: #d1ecf1;
    color: #0c5460;
  }

  .severity-warning .result-severity {
    background-color: #fff3cd;
    color: #856404;
  }

  .severity-critical .result-severity {
    background-color: #f8d7da;
    color: #721c24;
  }

  .result-value {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0.5rem 0;
  }

  .result-secondary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0.5rem 0;
  }

  .secondary-value {
    padding: 0.25rem 0.5rem;
    background-color: #e9ecef;
    border-radius: 3px;
    font-size: 0.875rem;
  }

  .btn-flag {
    margin-top: 0.75rem;
    padding: 0.375rem 0.75rem;
    border: 1px solid #007bff;
    background-color: white;
    color: #007bff;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .btn-flag:hover {
    background-color: #007bff;
    color: white;
  }

  .dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .dialog {
    background-color: #fff;
    border-radius: 8px;
    padding: 1.5rem;
    max-width: 700px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .dialog h3 {
    margin: 0 0 0.5rem 0;
  }

  .dialog > p {
    margin: 0 0 1rem 0;
    color: #666;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.25rem;
    font-weight: 500;
  }

  .form-group textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    resize: vertical;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1.5rem;
  }

  .btn-primary,
  .btn-secondary {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .btn-primary {
    background-color: #007bff;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #0056b3;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background-color: #6c757d;
    color: white;
  }

  .btn-secondary:hover {
    background-color: #545b62;
  }
</style>
