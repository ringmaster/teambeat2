<script lang="ts">
    interface Props {
        board: any;
        onAddNewColumn: () => void;
        onUpdateColumn: (columnId: string, data: any) => void;
        onDeleteColumn: (columnId: string) => void;
        onDragStart: (e: DragEvent, id: string) => void;
        onDragOver: (e: DragEvent, id: string) => void;
        onDragLeave: (e: DragEvent) => void;
        onDrop: (e: DragEvent, id: string) => void;
        onEndDrop: (e: DragEvent) => void;
        dragState: any;
    }
    
    let { 
        board,
        onAddNewColumn,
        onUpdateColumn,
        onDeleteColumn,
        onDragStart,
        onDragOver,
        onDragLeave,
        onDrop,
        onEndDrop,
        dragState
    }: Props = $props();
    
    function updateColumnTitle(columnId: string, title: string) {
        onUpdateColumn(columnId, { title: title.trim() });
    }
    
    function updateColumnDescription(columnId: string, description: string) {
        onUpdateColumn(columnId, { description: description || null });
    }
    
    function updateColumnAppearance(columnId: string, defaultAppearance: string) {
        onUpdateColumn(columnId, { defaultAppearance });
    }
</script>

<div class="flex justify-between items-center mb-6">
    <h3 class="text-lg font-medium text-gray-900">
        Board Columns
    </h3>
    <button
        onclick={onAddNewColumn}
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

<!-- Columns Table -->
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
                    >Description</th
                >
                <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Display</th
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
            {#each board.columns || [] as column}
                <tr
                    draggable="true"
                    ondragstart={(e) => onDragStart(e, column.id)}
                    ondragover={(e) => onDragOver(e, column.id)}
                    ondragleave={onDragLeave}
                    ondrop={(e) => onDrop(e, column.id)}
                    class="cursor-move hover:bg-gray-50 transition-all duration-150 ease-in-out {dragState.draggedColumnId === column.id ? 'opacity-50' : ''} {dragState.dragOverColumnId === column.id && dragState.draggedColumnId !== column.id && dragState.columnDropPosition === 'above' ? 'border-t-4 border-blue-500 bg-blue-50/50' : ''} {dragState.dragOverColumnId === column.id && dragState.draggedColumnId !== column.id && dragState.columnDropPosition === 'below' ? 'border-b-4 border-blue-500 bg-blue-50/50' : ''}"
                >
                    <td class="px-6 py-4">
                        <input
                            type="text"
                            value={column.title}
                            onblur={(e) => updateColumnTitle(column.id, e.currentTarget.value)}
                            class="w-full px-2 py-1 text-sm font-medium text-gray-900 border border-transparent rounded hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all duration-150 ease-in-out"
                        />
                    </td>
                    <td class="px-6 py-4">
                        <input
                            type="text"
                            value={column.description || ""}
                            placeholder="Enter description..."
                            onblur={(e) => updateColumnDescription(column.id, e.currentTarget.value)}
                            class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all duration-150 ease-in-out"
                        />
                    </td>
                    <td class="px-6 py-4">
                        <select
                            value={column.defaultAppearance || "shown"}
                            onchange={(e) => updateColumnAppearance(column.id, e.currentTarget.value)}
                            class="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all duration-150 ease-in-out"
                        >
                            <option value="shown"
                                >Shown</option
                            >
                            <option value="hidden"
                                >Hidden</option
                            >
                            <option value="fixed"
                                >Fixed</option
                            >
                        </select>
                    </td>
                    <td class="px-6 py-4">
                        <button
                            onclick={() => onDeleteColumn(column.id)}
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
                class="h-4 {dragState.dragOverColumnEnd ? 'bg-blue-100 border-2 border-dashed border-blue-400' : 'hover:bg-gray-25'}"
            >
                <td colspan="4" class="px-6 py-2 text-center text-xs text-gray-400">
                    {dragState.dragOverColumnEnd ? "Drop here to move to end" : ""}
                </td>
            </tr>
        </tbody>
    </table>
</div>