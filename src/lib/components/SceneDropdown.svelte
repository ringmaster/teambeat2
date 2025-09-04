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
        onShowSceneDropdown 
    }: Props = $props();
</script>

<div
    class="relative"
    role="button"
    tabindex="0"
    onmouseenter={() => onShowSceneDropdown(true)}
    onmouseleave={() => onShowSceneDropdown(false)}
    onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            onShowSceneDropdown(!showSceneDropdown);
        }
    }}
>
    <button
        class="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-full hover:bg-blue-600 transition-colors flex items-center space-x-1"
    >
        <span>{currentScene?.title || "Scene"}</span>
        <svg
            class="w-3 h-3"
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
        <div
            class="absolute right-0 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-40 z-10"
        >
            {#each board.scenes as scene}
                <button
                    onclick={() => {
                        onSceneChange(scene.id);
                        onShowSceneDropdown(false);
                    }}
                    class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors {scene.id ===
                    board.currentSceneId
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-700'}"
                >
                    {scene.title}
                </button>
            {/each}
        </div>
    {/if}
</div>