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
    
    function updateSceneTitle(sceneId: string, title: string) {
        onUpdateScene(sceneId, { title });
    }
    
    function updateSceneMode(sceneId: string, mode: string) {
        onUpdateScene(sceneId, { mode });
    }
</script>

<div class="flex justify-between items-center mb-6">
    <h3 class="text-lg font-medium text-gray-900">
        Board Scenes
    </h3>
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
</div>

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
                        <div
                            class="flex flex-wrap gap-1"
                        >
                            {#if scene.allowAddCards}
                                <span
                                    class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded flex items-center"
                                >
                                    Add Cards
                                    <button
                                        class="ml-1 text-gray-400 hover:text-gray-600"
                                        >×</button
                                    >
                                </span>
                            {/if}
                            {#if scene.allowEditCards}
                                <span
                                    class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded flex items-center"
                                >
                                    Edit Cards
                                    <button
                                        class="ml-1 text-gray-400 hover:text-gray-600"
                                        >×</button
                                    >
                                </span>
                            {/if}
                            {#if scene.allowVoting}
                                <span
                                    class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded flex items-center"
                                >
                                    Voting
                                    <button
                                        class="ml-1 text-gray-400 hover:text-gray-600"
                                        >×</button
                                    >
                                </span>
                            {/if}
                            {#if scene.allowComments}
                                <span
                                    class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded flex items-center"
                                >
                                    Comments
                                    <button
                                        class="ml-1 text-gray-400 hover:text-gray-600"
                                        >×</button
                                    >
                                </span>
                            {/if}
                            <button
                                class="text-gray-400 hover:text-gray-600 text-xs px-2 py-1 border border-dashed border-gray-300 rounded"
                                >+ Options</button
                            >
                        </div>
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
                <td colspan="4" class="px-6 py-2 text-center text-xs text-gray-400">
                    {dragState.dragOverSceneEnd ? "Drop here to move to end" : ""}
                </td>
            </tr>
        </tbody>
    </table>
</div>