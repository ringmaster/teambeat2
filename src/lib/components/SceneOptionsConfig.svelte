<script lang="ts">
  import { SCENE_MODE_FLAGS, FLAG_LABELS, type SceneFlag } from '$lib/scene-flags';

  interface Props {
    sceneMode: string;
    selectedFlags: string[];
    onchange?: () => void;
  }

  let { sceneMode, selectedFlags = $bindable(), onchange }: Props = $props();

  let availableFlags = $derived(SCENE_MODE_FLAGS[sceneMode] || []);

  function toggleFlag(flag: string) {
    if (selectedFlags.includes(flag)) {
      selectedFlags = selectedFlags.filter(f => f !== flag);
    } else {
      selectedFlags = [...selectedFlags, flag];
    }

    // Call the onchange callback if provided
    if (onchange) {
      onchange();
    }
  }
</script>

{#if availableFlags.length > 0}
  <div class="scene-options">
    <h4>Scene Options</h4>
    <div class="options-list">
      {#each availableFlags as flag}
        <label class="option-item">
          <input
            type="checkbox"
            checked={selectedFlags.includes(flag)}
            onchange={() => toggleFlag(flag)}
          />
          <span>{FLAG_LABELS[flag as SceneFlag] || flag}</span>
        </label>
      {/each}
    </div>
  </div>
{/if}

<style lang="less">
  .scene-options {
    margin-top: 1rem;

    h4 {
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
      color: var(--color-text-primary);
    }

    .options-list {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.5rem;
    }

    .option-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 4px;
      transition: background-color 0.2s;

      &:hover {
        background-color: var(--color-bg-hover, rgba(0, 0, 0, 0.05));
      }

      input[type="checkbox"] {
        width: 18px;
        height: 18px;
        cursor: pointer;
        accent-color: var(--color-primary);
      }

      span {
        font-size: 0.875rem;
        color: var(--color-text-secondary);
      }
    }
  }
</style>
