<script lang="ts">
    interface Props {
        board: any;
        currentScene: any;
        showSceneDropdown: boolean;
        onSceneChange: (sceneId: string) => void;
        onShowSceneDropdown: (show: boolean) => void;
        onNextScene?: () => void;
    }

    let {
        board,
        currentScene,
        showSceneDropdown = $bindable(),
        onSceneChange,
        onShowSceneDropdown,
        onNextScene,
    }: Props = $props();

    // Button should only be disabled if board is completed or archived
    const isButtonDisabled = $derived(() => {
        return board.status === "completed" || board.status === "archived";
    });

    function handleNextScene() {
        if (!isButtonDisabled() && onNextScene) {
            onNextScene();
        }
    }
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
        <button class="toolbar-button toolbar-button-primary toolbar-button-left">
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
                    <button
                        onclick={() => {
                            onSceneChange(scene.id);
                            onShowSceneDropdown(false);
                        }}
                        class="scene-dropdown-item {scene.id === currentScene?.id ||
                        scene.id === board.currentSceneId
                            ? 'scene-dropdown-item-active'
                            : ''}"
                    >
                        {scene.title}
                    </button>
                {/each}
            </div>
        {/if}
    </div>

    <button
        class="toolbar-button toolbar-button-primary toolbar-button-right"
        onclick={handleNextScene}
        disabled={isButtonDisabled()}
        aria-label="Next scene"
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
</style>
