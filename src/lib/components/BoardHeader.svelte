<script lang="ts">
    import { onMount } from 'svelte';
    import SceneDropdown from './SceneDropdown.svelte';
    
    interface Props {
        board: any;
        userRole: string;
        currentScene: any;
        showSceneDropdown: boolean;
        onConfigureClick: () => void;
        onShareClick: () => void;
        onSceneChange: (sceneId: string) => void;
        onShowSceneDropdown: (show: boolean) => void;
    }
    
    let { 
        board, 
        userRole, 
        currentScene,
        showSceneDropdown,
        onConfigureClick,
        onShareClick,
        onSceneChange,
        onShowSceneDropdown 
    }: Props = $props();
    
    let headerContentDiv: HTMLDivElement;
    
    
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
                {#if ["admin", "facilitator"].includes(userRole)}
                    <!-- Scene dropdown/button -->
                    {#if board?.scenes?.length > 0}
                        <SceneDropdown
                            {board}
                            {currentScene}
                            {showSceneDropdown}
                            {onSceneChange}
                            {onShowSceneDropdown}
                        />
                    {/if}
                {/if}

                {#if ["admin", "facilitator"].includes(userRole)}
                    <button
                        onclick={onConfigureClick}
                        class="px-3 py-1.5 bg-white text-gray-600 text-sm rounded-full hover:bg-gray-50 transition-colors border border-gray-200"
                    >
                        Configure
                    </button>
                {/if}

                {#if ["admin", "facilitator"].includes(userRole)}
                    <button
                        class="px-3 py-1.5 bg-white text-gray-600 text-sm rounded-full hover:bg-gray-50 transition-colors border border-gray-200"
                    >
                        Timer
                    </button>
                {/if}

                <button
                    onclick={onShareClick}
                    class="px-3 py-1.5 bg-white text-gray-600 text-sm rounded-full hover:bg-gray-50 transition-colors border border-gray-200 flex items-center space-x-1"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"/>
                    </svg>
                    <span>Share</span>
                </button>
            </div>
        </div>
    </div>
</div>