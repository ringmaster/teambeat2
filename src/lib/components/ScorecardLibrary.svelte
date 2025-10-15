<script lang="ts">
  import { onMount } from 'svelte';
  import type { Scorecard } from '$lib/types/scorecard';
  import { toastStore } from '$lib/stores/toast';

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
    toastStore.warning('Are you sure you want to delete this scorecard? This will remove it from all scenes.', {
      autoHide: false,
      actions: [
        {
          label: 'Delete',
          onClick: async () => {
            try {
              const response = await fetch(`/api/series/${seriesId}/scorecards/${scorecardId}`, {
                method: 'DELETE'
              });

              const data = await response.json();

              if (data.success) {
                scorecards = scorecards.filter(s => s.id !== scorecardId);
                toastStore.success('Scorecard deleted successfully');
              } else {
                error = data.error || 'Failed to delete scorecard';
                toastStore.error('Failed to delete scorecard');
              }
            } catch (e) {
              error = 'Failed to delete scorecard';
              toastStore.error('Failed to delete scorecard');
              console.error('Error deleting scorecard:', e);
            }
          },
          variant: 'primary'
        },
        {
          label: 'Cancel',
          onClick: () => {},
          variant: 'secondary'
        }
      ]
    });
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

<style lang="less">
  .scorecard-library {
    padding: var(--spacing-6);
  }

  .library-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-6);

    h2 {
      margin: 0;
      font-size: 1.5rem;
      color: var(--color-text-primary);
    }
  }

  .error-message {
    padding: var(--spacing-3);
    background-color: var(--status-error-bg);
    border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
    border-radius: var(--radius-md);
    color: var(--status-error-text);
    margin-bottom: var(--spacing-4);
  }

  .loading {
    text-align: center;
    padding: var(--spacing-8);
    color: var(--color-text-secondary);
  }

  .empty-state {
    text-align: center;
    padding: var(--spacing-12);
    color: var(--color-text-secondary);

    p {
      margin: var(--spacing-2) 0;
    }
  }

  .scorecard-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .scorecard-card {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-5);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    background-color: var(--card-background);
    transition: all var(--transition-fast);

    &:hover {
      box-shadow: var(--shadow-sm);
    }
  }

  .scorecard-info {
    flex: 1;

    h3 {
      margin: 0 0 var(--spacing-2) 0;
      font-size: 1.125rem;
      color: var(--color-text-primary);
    }

    .description {
      margin: 0 0 var(--spacing-2) 0;
      color: var(--color-text-secondary);
    }

    .meta {
      margin: 0;
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }
  }

  .scorecard-actions {
    display: flex;
    gap: var(--spacing-2);
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
    background-color: var(--card-background);
    border-radius: var(--radius-lg);
    padding: var(--spacing-6);
    max-width: 500px;
    width: 90%;
    box-shadow: var(--shadow-xl);

    h3 {
      margin: 0 0 var(--spacing-4) 0;
      color: var(--color-text-primary);
    }
  }

  .form-group {
    margin-bottom: var(--spacing-4);

    label {
      display: block;
      margin-bottom: var(--spacing-1);
      font-weight: 500;
      color: var(--color-text-primary);
    }

    input,
    textarea {
      width: 100%;
      padding: var(--spacing-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      font-family: inherit;
      font-size: 1rem;
      transition: all var(--transition-fast);

      &:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
      }
    }

    textarea {
      resize: vertical;
    }
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-2);
    margin-top: var(--spacing-6);
  }

  .btn-primary,
  .btn-secondary,
  .btn-danger {
    padding: var(--spacing-2) var(--spacing-4);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: 500;
    text-decoration: none;
    display: inline-block;
    transition: all var(--transition-fast);
  }

  .btn-primary {
    background: var(--btn-primary-bg);
    color: var(--btn-primary-text);

    &:hover:not(:disabled) {
      background: var(--btn-primary-bg-hover);
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .btn-secondary {
    background: var(--btn-secondary-bg);
    color: var(--btn-secondary-text);

    &:hover:not(:disabled) {
      background: var(--btn-secondary-bg-hover);
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }
  }

  .btn-danger {
    background: var(--btn-danger-bg);
    color: var(--btn-danger-text);

    &:hover:not(:disabled) {
      background: var(--btn-danger-bg-hover);
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }
  }
</style>
