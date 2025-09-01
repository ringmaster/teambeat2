<script lang="ts">
    import { onMount } from 'svelte';
    import SceneDropdown from './SceneDropdown.svelte';
    
    interface Props {
        board: any;
        userRole: string;
        showSceneDropdown: boolean;
        onConfigureClick: () => void;
        onSceneChange: (sceneId: string) => void;
        onShowSceneDropdown: (show: boolean) => void;
    }
    
    let { 
        board, 
        userRole, 
        showSceneDropdown = $bindable(),
        onConfigureClick,
        onSceneChange,
        onShowSceneDropdown 
    }: Props = $props();
    
    let headerContentDiv: HTMLDivElement;
    
    function getCurrentScene() {
        return board?.scenes?.find((s: any) => s.id === board.currentSceneId);
    }
    
    function updateHeaderWidth() {
        if (headerContentDiv) {
            const innerDiv = headerContentDiv.querySelector('.flex');
            if (innerDiv) {
                const width = (innerDiv as HTMLElement).offsetWidth;
                document.documentElement.style.setProperty('--board-header-width', `${width}px`);
            }
        }
    }
    
    onMount(() => {
        updateHeaderWidth();
        // Update on window resize
        const handleResize = () => updateHeaderWidth();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    });
</script>

<div id="board-header" class="bg-gray-50 border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
    <div id="board-header-content" class="max-w-7xl mx-auto" bind:this={headerContentDiv}>
        <div class="flex justify-between items-center">
            <!-- Left: Board title and admin badge -->
            <div class="flex items-center space-x-3">
                <h1 class="text-xl font-semibold text-gray-900">
                    {board.name} - {new Date(board.createdAt).toLocaleDateString('en-CA')}
                </h1>
                <span
                    class="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full"
                >
                    {userRole}
                </span>
                {#if board.blameFreeMode}
                    <span
                        class="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full"
                    >
                        Blame-free
                    </span>
                {/if}
            </div>

            <!-- Right: Control pills -->
            <div class="flex items-center space-x-2">
                <button
                    class="px-3 py-1.5 bg-white text-gray-600 text-sm rounded-full hover:bg-gray-50 transition-colors border border-gray-200"
                >
                    Share
                </button>
                <button
                    class="px-3 py-1.5 bg-white text-gray-600 text-sm rounded-full hover:bg-gray-50 transition-colors border border-gray-200"
                >
                    Timer
                </button>
                {#if ["admin", "facilitator"].includes(userRole)}
                    <button
                        onclick={onConfigureClick}
                        class="px-3 py-1.5 bg-white text-gray-600 text-sm rounded-full hover:bg-gray-50 transition-colors border border-gray-200"
                    >
                        Configure
                    </button>
                {/if}

                <!-- Scene selector dropdown (only if scenes exist) -->
                {#if board.scenes && board.scenes.length > 0}
                    <SceneDropdown 
                        {board} 
                        {getCurrentScene}
                        {showSceneDropdown}
                        {onSceneChange}
                        {onShowSceneDropdown}
                    />
                {/if}
            </div>
        </div>
    </div>
</div>