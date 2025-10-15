<script lang="ts">
    import { evaluateDisplayRule } from "$lib/utils/display-rule-context";
    import { onMount, onDestroy } from "svelte";

    interface Props {
        board: any;
        currentScene: any;
        cards?: any[];
        agreements?: any[];
        showSceneDropdown: boolean;
        onSceneChange: (sceneId: string) => void;
        onShowSceneDropdown: (show: boolean) => void;
        onNextScene?: () => void;
    }

    let {
        board,
        currentScene,
        cards = [],
        agreements = [],
        showSceneDropdown = $bindable(),
        onSceneChange,
        onShowSceneDropdown,
        onNextScene,
    }: Props = $props();

    // Button should only be disabled if board is completed or archived
    const isButtonDisabled = $derived(() => {
        return false; //board.status === "completed" || board.status === "archived";
    });

    // Check if a scene would be skipped based on its display rule
    function wouldSceneBeSkipped(scene: any): boolean {
        return !evaluateDisplayRule(scene, board, cards, agreements);
    }

    function handleNextScene() {
        if (!isButtonDisabled() && onNextScene) {
            onNextScene();
        }
    }

    // Keyboard shortcut handler
    function handleKeydown(e: KeyboardEvent) {
        // Control+G or Cmd+G for Next Scene
        if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
            e.preventDefault();
            handleNextScene();
        }
    }

    onMount(() => {
        window.addEventListener('keydown', handleKeydown);
    });

    onDestroy(() => {
        window.removeEventListener('keydown', handleKeydown);
    });
</script>

<div class="scene-button-group">
    <div
        class="scene-dropdown-container cooltipz--left"
        role="button"
        tabindex="0"
        onmouseenter={() => onShowSceneDropdown(true)}
        onmouseleave={() => onShowSceneDropdown(false)}
        onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
                onShowSceneDropdown(!showSceneDropdown);
            }
        }}
        aria-label="Select a scene"
    >
        <button
            class="toolbar-button toolbar-button-primary toolbar-button-left"
        >
            <span>{currentScene?.title || "Scene"}</span>
            <svg
                class="icon-sm"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                />
            </svg>
        </button>

        {#if showSceneDropdown}
            <div class="scene-dropdown-menu">
                {#each board.scenes as scene (scene.id)}
                    {@const isSkipped = wouldSceneBeSkipped(scene)}
                    {@const isActive = scene.id === currentScene?.id || scene.id === board.currentSceneId}
                    <button
                        onclick={() => {
                            onSceneChange(scene.id);
                            onShowSceneDropdown(false);
                        }}
                        class="scene-dropdown-item"
                        class:scene-dropdown-item-active={isActive}
                        class:scene-dropdown-item-skipped={isSkipped}
                        title={isSkipped ? 'This scene will be skipped due to its display rule' : ''}
                    >
                        {scene.title}
                    </button>
                {/each}
            </div>
        {/if}
    </div>

    <button
        class="toolbar-button toolbar-button-primary toolbar-button-right cooltipz--bottom"
        onclick={handleNextScene}
        disabled={isButtonDisabled()}
        aria-label="Next scene (Ctrl+G)"
        data-testid="next-scene-button"
    >
        <svg
            class="icon-sm"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
            />
        </svg>
    </button>
</div>

<style>
    .scene-button-group {
        display: inline-flex;
        align-items: center;
    }

    .toolbar-button-left {
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
        border-right: 1px solid rgba(255, 255, 255, 0.2);
    }

    .toolbar-button-right {
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
        margin-left: -1px;
        padding: var(--spacing-2) var(--spacing-3);
    }

    .toolbar-button-right:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    :global(.scene-dropdown-item-skipped) {
        opacity: 0.5;
        font-style: italic;
        color: #999 !important;
    }

    :global(.scene-dropdown-item-skipped:hover) {
        opacity: 0.7;
    }
</style>
