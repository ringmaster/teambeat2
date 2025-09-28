<script lang="ts">
    interface Props {
        board: any;
        currentScene: any;
        showSceneDropdown: boolean;
        onSceneChange: (sceneId: string) => void;
        onShowSceneDropdown: (show: boolean) => void;
    }

    let {
        board,
        currentScene,
        showSceneDropdown = $bindable(),
        onSceneChange,
        onShowSceneDropdown,
    }: Props = $props();
</script>

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
    <button class="toolbar-button toolbar-button-primary">
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
