<script lang="ts">
  import { onMount } from 'svelte';
  import type { Scorecard } from '$lib/types/scorecard';

  interface Props {
    seriesId: string;
    canEdit: boolean;
  }

  let { seriesId, canEdit }: Props = $props();

  let scorecards = $state<Scorecard[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let showCreateDialog = $state(false);
  let newScorecardName = $state('');
  let newScorecardDescription = $state('');
  let creating = $state(false);

  async function loadScorecards() {
    try {
      loading = true;
      error = null;
      const response = await fetch(`/api/series/${seriesId}/scorecards`);
      const data = await response.json();

      if (data.success) {
        scorecards = data.scorecards;
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

  async function createScorecard() {
    if (!newScorecardName.trim()) return;

    try {
      creating = true;
      const response = await fetch(`/api/series/${seriesId}/scorecards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newScorecardName,
          description: newScorecardDescription || null
        })
      });

      const data = await response.json();

      if (data.success) {
        scorecards = [...scorecards, data.scorecard];
        showCreateDialog = false;
        newScorecardName = '';
        newScorecardDescription = '';
      } else {
        error = data.error || 'Failed to create scorecard';
      }
    } catch (e) {
      error = 'Failed to create scorecard';
      console.error('Error creating scorecard:', e);
    } finally {
      creating = false;
    }
  }

  async function deleteScorecard(scorecardId: string) {
    if (!confirm('Are you sure you want to delete this scorecard? This will remove it from all scenes.')) {
      return;
    }

    try {
      const response = await fetch(`/api/series/${seriesId}/scorecards/${scorecardId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        scorecards = scorecards.filter(s => s.id !== scorecardId);
      } else {
        error = data.error || 'Failed to delete scorecard';
      }
    } catch (e) {
      error = 'Failed to delete scorecard';
      console.error('Error deleting scorecard:', e);
    }
  }

  onMount(() => {
    loadScorecards();
  });
</script>

<div class="scorecard-library">
  <div class="library-header">
    <h2>Scorecard Library</h2>
    {#if canEdit}
      <button onclick={() => showCreateDialog = true} class="btn-primary">
        + New Scorecard
      </button>
    {/if}
  </div>

  {#if error}
    <div class="error-message">{error}</div>
  {/if}

  {#if loading}
    <div class="loading">Loading scorecards...</div>
  {:else if scorecards.length === 0}
    <div class="empty-state">
      <p>No scorecards yet.</p>
      {#if canEdit}
        <p>Create your first scorecard to get started.</p>
      {/if}
    </div>
  {:else}
    <div class="scorecard-list">
      {#each scorecards as scorecard}
        <div class="scorecard-card">
          <div class="scorecard-info">
            <h3>{scorecard.name}</h3>
            {#if scorecard.description}
              <p class="description">{scorecard.description}</p>
            {/if}
            <p class="meta">Created {new Date(scorecard.createdAt).toLocaleDateString()}</p>
          </div>
          <div class="scorecard-actions">
            <a href="/series/{seriesId}/scorecards/{scorecard.id}" class="btn-secondary">
              Edit
            </a>
            {#if canEdit}
              <button onclick={() => deleteScorecard(scorecard.id)} class="btn-danger">
                Delete
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if showCreateDialog}
    <div class="dialog-overlay" onclick={() => showCreateDialog = false}>
      <div class="dialog" onclick={(e) => e.stopPropagation()}>
        <h3>Create New Scorecard</h3>
        <form onsubmit={(e) => { e.preventDefault(); createScorecard(); }}>
          <div class="form-group">
            <label for="scorecard-name">Name</label>
            <input
              id="scorecard-name"
              type="text"
              bind:value={newScorecardName}
              placeholder="Scorecard name"
              required
            />
          </div>
          <div class="form-group">
            <label for="scorecard-description">Description (optional)</label>
            <textarea
              id="scorecard-description"
              bind:value={newScorecardDescription}
              placeholder="Describe what this scorecard tracks"
              rows="3"
            ></textarea>
          </div>
          <div class="dialog-actions">
            <button type="button" onclick={() => showCreateDialog = false} class="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={creating} class="btn-primary">
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .scorecard-library {
    padding: 1.5rem;
  }

  .library-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .library-header h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  .error-message {
    padding: 0.75rem;
    background-color: #fee;
    border: 1px solid #fcc;
    border-radius: 4px;
    color: #c33;
    margin-bottom: 1rem;
  }

  .loading {
    text-align: center;
    padding: 2rem;
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

  .scorecard-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .scorecard-card {
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 1.25rem;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    background-color: #fff;
  }

  .scorecard-info {
    flex: 1;
  }

  .scorecard-info h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.125rem;
  }

  .scorecard-info .description {
    margin: 0 0 0.5rem 0;
    color: #666;
  }

  .scorecard-info .meta {
    margin: 0;
    font-size: 0.875rem;
    color: #999;
  }

  .scorecard-actions {
    display: flex;
    gap: 0.5rem;
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
    max-width: 500px;
    width: 90%;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .dialog h3 {
    margin: 0 0 1rem 0;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.25rem;
    font-weight: 500;
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-family: inherit;
    font-size: 1rem;
  }

  .form-group textarea {
    resize: vertical;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1.5rem;
  }

  .btn-primary,
  .btn-secondary,
  .btn-danger {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    display: inline-block;
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

  .btn-danger {
    background-color: #dc3545;
    color: white;
  }

  .btn-danger:hover {
    background-color: #bd2130;
  }
</style>
