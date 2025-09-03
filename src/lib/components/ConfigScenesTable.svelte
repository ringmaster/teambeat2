<script lang="ts">
    interface Props {
        board: any;
        onAddNewScene: () => void;
        onUpdateScene: (sceneId: string, data: any) => void;
        onDeleteScene: (sceneId: string) => void;
        onDragStart: (e: DragEvent, id: string) => void;
        onDragOver: (e: DragEvent, id: string) => void;
        onDragLeave: (e: DragEvent) => void;
        onDrop: (e: DragEvent, id: string) => void;
        onEndDrop: (e: DragEvent) => void;
        dragState: any;
    }
    
    let { 
        board,
        onAddNewScene,
        onUpdateScene,
        onDeleteScene,
        onDragStart,
        onDragOver,
        onDragLeave,
        onDrop,
        onEndDrop,
        dragState
    }: Props = $props();
    
    // Inline editing state
    let editingMode = $state(""); // "permissions", "display", or ""
    let activeSceneId = $state("");
    let activeSceneName = $state("");
    
    function updateSceneTitle(sceneId: string, title: string) {
        onUpdateScene(sceneId, { title });
    }
    
    function updateSceneMode(sceneId: string, mode: string) {
        onUpdateScene(sceneId, { mode });
    }
    
    function showOptionsForScene(sceneId: string) {
        const scene = board.scenes.find((s: any) => s.id === sceneId);
        if (!scene) return;
        
        activeSceneId = sceneId;
        activeSceneName = scene.title;
        editingMode = "permissions";
    }
    
    async function showColumnsForScene(sceneId: string) {
        const scene = board.scenes.find((s: any) => s.id === sceneId);
        if (!scene) return;
        
        activeSceneId = sceneId;
        activeSceneName = scene.title;
        editingMode = "display";
        
        // Initialize column states from board data
        if (!columnStates[sceneId]) {
            columnStates[sceneId] = {};
        }
        // Set all columns to visible by default
        const columnsToUse = board.allColumns || board.columns;
        columnsToUse?.forEach((col: any) => {
            columnStates[sceneId][col.id] = 'visible';
        });
        // Mark hidden columns if they exist in the board data
        if (board.hiddenColumnsByScene && board.hiddenColumnsByScene[sceneId]) {
            board.hiddenColumnsByScene[sceneId].forEach((colId: string) => {
                columnStates[sceneId][colId] = 'hidden';
            });
        }
    }
    
    function togglePermission(sceneId: string, permission: string) {
        const scene = board.scenes.find((s: any) => s.id === sceneId);
        if (!scene) return;
        
        const updates = { [permission]: !scene[permission] };
        onUpdateScene(sceneId, updates);
    }
    
    function exitEditingMode() {
        editingMode = "";
        activeSceneId = "";
        activeSceneName = "";
    }
    
    async function updateColumnDisplay(sceneId: string, columnId: string, state: string) {
        try {
            const response = await fetch(`/api/boards/${board.id}/scenes/${sceneId}/columns`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ columnId, state })
            });
            
            if (response.ok) {
                // Update local state
                if (!columnStates[sceneId]) {
                    columnStates[sceneId] = {};
                }
                columnStates[sceneId][columnId] = state;
            } else {
                console.error('Failed to update column display:', await response.json());
            }
        } catch (error) {
            console.error('Failed to update column display:', error);
        }
    }
    
    // Track column states per scene
    let columnStates = $state<Record<string, Record<string, string>>>({});
    
</script>

<div class="mb-6">
    <div class="flex justify-between items-center">
        <h3 class="text-lg font-medium text-gray-900">
            {#if editingMode}
                Board Scenes - {editingMode === 'permissions' ? 'Permissions' : 'Display'} for {activeSceneName}
            {:else}
                Board Scenes
            {/if}
        </h3>
        {#if !editingMode}
            <button
                onclick={onAddNewScene}
                class="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors flex items-center"
            >
                <svg
                    class="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 4v16m8-8H4"
                    />
                </svg>
                + Add
            </button>
        {/if}
    </div>
    {#if editingMode}
        <button
            onclick={exitEditingMode}
            class="mt-2 text-sm text-blue-600 hover:text-blue-700 flex items-center"
        >
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back
        </button>
    {/if}
</div>

{#if !editingMode}
    <!-- Scenes Table -->
    <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
            <tr>
                <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Title</th
                >
                <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Permissions</th
                >
                <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Display</th
                >
                <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Mode</th
                >
                <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Delete</th
                >
            </tr>
        </thead>
        <tbody
            class="bg-white divide-y divide-gray-200"
        >
            {#each board.scenes || [] as scene}
                <tr
                    draggable="true"
                    ondragstart={(e) => onDragStart(e, scene.id)}
                    ondragover={(e) => onDragOver(e, scene.id)}
                    ondragleave={onDragLeave}
                    ondrop={(e) => onDrop(e, scene.id)}
                    class="cursor-move hover:bg-gray-50 transition-all duration-150 ease-in-out {dragState.draggedSceneId === scene.id ? 'opacity-50' : ''} {dragState.dragOverSceneId === scene.id && dragState.draggedSceneId !== scene.id && dragState.sceneDropPosition === 'above' ? 'border-t-4 border-blue-500 bg-blue-50/50' : ''} {dragState.dragOverSceneId === scene.id && dragState.draggedSceneId !== scene.id && dragState.sceneDropPosition === 'below' ? 'border-b-4 border-blue-500 bg-blue-50/50' : ''}"
                >
                    <td class="px-6 py-4">
                        <input
                            type="text"
                            value={scene.title}
                            onblur={(e) => updateSceneTitle(scene.id, e.currentTarget.value)}
                            class="w-full px-2 py-1 text-sm font-medium text-gray-900 border border-transparent rounded hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all duration-150 ease-in-out"
                        />
                    </td>
                    <td class="px-6 py-4">
                        <button
                            onclick={() => showOptionsForScene(scene.id)}
                            class="text-gray-600 hover:text-gray-800 text-sm px-3 py-1 border border-gray-300 rounded hover:border-gray-400 transition-colors"
                            >Options</button
                        >
                    </td>
                    <td class="px-6 py-4">
                        <button
                            onclick={() => showColumnsForScene(scene.id)}
                            class="text-gray-600 hover:text-gray-800 text-sm px-3 py-1 border border-gray-300 rounded hover:border-gray-400 transition-colors"
                            >Columns</button
                        >
                    </td>
                    <td class="px-6 py-4">
                        <select
                            value={scene.mode}
                            onchange={(e) => updateSceneMode(scene.id, e.currentTarget.value)}
                            class="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 capitalize transition-all duration-150 ease-in-out"
                        >
                            <option value="columns">Columns</option>
                            <option value="present">Present</option>
                            <option value="review">Review</option>
                        </select>
                    </td>
                    <td class="px-6 py-4">
                        <button
                            onclick={() => onDeleteScene(scene.id)}
                            class="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                            Delete ×
                        </button>
                    </td>
                </tr>
            {/each}
            <!-- Drop zone for adding items at the end -->
            <tr
                ondragover={onEndDrop}
                ondragleave={() => {}}
                ondrop={onEndDrop}
                class="h-4 {dragState.dragOverSceneEnd ? 'bg-blue-100 border-2 border-dashed border-blue-400' : 'hover:bg-gray-25'}"
            >
                <td colspan="5" class="px-6 py-2 text-center text-xs text-gray-400">
                    {dragState.dragOverSceneEnd ? "Drop here to move to end" : ""}
                </td>
            </tr>
        </tbody>
    </table>
</div>
{:else}
    <!-- Inline Editing Content -->
    <div class="max-h-96 overflow-y-auto">
        {#if editingMode === 'permissions'}
            {@const activeScene = board.scenes.find((s: any) => s.id === activeSceneId)}
            {#if activeScene}
            <div class="space-y-3">
                <h4 class="text-sm font-medium text-gray-900 mb-4">Scene Permissions</h4>
                <div class="grid grid-cols-3 gap-3">
                    <button
                        onclick={() => togglePermission(activeSceneId, 'allowAddCards')}
                        class="w-full text-left px-3 py-2 text-sm rounded-lg transition-colors {activeScene.allowAddCards ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}"
                    >
                        <div class="flex items-center justify-between">
                            <span>Add Cards</span>
                            {#if activeScene.allowAddCards}
                                <svg class="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                                </svg>
                            {/if}
                        </div>
                    </button>
                    
                    <button
                        onclick={() => togglePermission(activeSceneId, 'allowEditCards')}
                        class="w-full text-left px-3 py-2 text-sm rounded-lg transition-colors {activeScene.allowEditCards ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}"
                    >
                        <div class="flex items-center justify-between">
                            <span>Edit Cards</span>
                            {#if activeScene.allowEditCards}
                                <svg class="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                                </svg>
                            {/if}
                        </div>
                    </button>
                    
                    <button
                        onclick={() => togglePermission(activeSceneId, 'allowObscureCards')}
                        class="w-full text-left px-4 py-3 text-sm rounded-lg transition-colors {activeScene.allowObscureCards ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}"
                    >
                        <div class="flex items-center justify-between">
                            <span>Obscure Cards</span>
                            {#if activeScene.allowObscureCards}
                                <svg class="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                                </svg>
                            {/if}
                        </div>
                    </button>
                    
                    <button
                        onclick={() => togglePermission(activeSceneId, 'allowMoveCards')}
                        class="w-full text-left px-4 py-3 text-sm rounded-lg transition-colors {activeScene.allowMoveCards ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}"
                    >
                        <div class="flex items-center justify-between">
                            <span>Move Cards</span>
                            {#if activeScene.allowMoveCards}
                                <svg class="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                                </svg>
                            {/if}
                        </div>
                    </button>
                    
                    <button
                        onclick={() => togglePermission(activeSceneId, 'allowGroupCards')}
                        class="w-full text-left px-4 py-3 text-sm rounded-lg transition-colors {activeScene.allowGroupCards ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}"
                    >
                        <div class="flex items-center justify-between">
                            <span>Group Cards</span>
                            {#if activeScene.allowGroupCards}
                                <svg class="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                                </svg>
                            {/if}
                        </div>
                    </button>
                    
                    <button
                        onclick={() => togglePermission(activeSceneId, 'showVotes')}
                        class="w-full text-left px-4 py-3 text-sm rounded-lg transition-colors {activeScene.showVotes ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}"
                    >
                        <div class="flex items-center justify-between">
                            <span>Show Votes</span>
                            {#if activeScene.showVotes}
                                <svg class="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                                </svg>
                            {/if}
                        </div>
                    </button>
                    
                    <button
                        onclick={() => togglePermission(activeSceneId, 'allowVoting')}
                        class="w-full text-left px-4 py-3 text-sm rounded-lg transition-colors {activeScene.allowVoting ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}"
                    >
                        <div class="flex items-center justify-between">
                            <span>Enable Votes</span>
                            {#if activeScene.allowVoting}
                                <svg class="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                                </svg>
                            {/if}
                        </div>
                    </button>
                    
                    <button
                        onclick={() => togglePermission(activeSceneId, 'showComments')}
                        class="w-full text-left px-4 py-3 text-sm rounded-lg transition-colors {activeScene.showComments ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}"
                    >
                        <div class="flex items-center justify-between">
                            <span>Show Comments</span>
                            {#if activeScene.showComments}
                                <svg class="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                                </svg>
                            {/if}
                        </div>
                    </button>
                    
                    <button
                        onclick={() => togglePermission(activeSceneId, 'allowComments')}
                        class="w-full text-left px-4 py-3 text-sm rounded-lg transition-colors {activeScene.allowComments ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}"
                    >
                        <div class="flex items-center justify-between">
                            <span>Enable Comments</span>
                            {#if activeScene.allowComments}
                                <svg class="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                                </svg>
                            {/if}
                        </div>
                    </button>
                </div>
            </div>
            {/if}
        {:else if editingMode === 'display'}
            <div class="space-y-3">
                <h4 class="text-sm font-medium text-gray-900 mb-4">Column Display Settings</h4>
                <div class="space-y-3">
                    {#each (board.allColumns || board.columns || []) as column}
                        {@const currentState = columnStates[activeSceneId]?.[column.id] || 'visible'}
                        <div class="p-4 border border-gray-200 rounded-lg bg-gray-50">
                            <div class="flex items-center justify-between mb-3">
                                <span class="text-sm text-gray-700 font-medium">{column.title}</span>
                            </div>
                            <div class="flex gap-4">
                                <label class="flex items-center cursor-pointer">
                                    <input
                                        type="radio"
                                        name="column-{column.id}"
                                        value="visible"
                                        checked={currentState === 'visible'}
                                        onchange={() => updateColumnDisplay(activeSceneId, column.id, 'visible')}
                                        class="mr-2 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span class="text-sm text-gray-600">Visible</span>
                                </label>
                                <label class="flex items-center cursor-pointer">
                                    <input
                                        type="radio"
                                        name="column-{column.id}"
                                        value="hidden"
                                        checked={currentState === 'hidden'}
                                        onchange={() => updateColumnDisplay(activeSceneId, column.id, 'hidden')}
                                        class="mr-2 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span class="text-sm text-gray-600">Hidden</span>
                                </label>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    </div>
{/if}

