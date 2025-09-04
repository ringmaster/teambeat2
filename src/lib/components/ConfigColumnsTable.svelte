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
    
</script>

<div class="config-section-header">
    <h3 class="config-section-title">
        Board Columns
    </h3>
    <button
        onclick={onAddNewColumn}
        class="button"
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
<div class="config-table-wrapper">
    <table class="config-table">
        <thead>
            <tr class="config-table-header">
                <th class="config-table-th">Title</th>
                <th class="config-table-th">Description</th>
                <th class="config-table-th">Delete</th>
            </tr>
        </thead>
        <tbody>
            {#each board.columns || [] as column, index}
                <tr
                    draggable="true"
                    ondragstart={(e) => onDragStart(e, column.id)}
                    ondragover={(e) => onDragOver(e, column.id)}
                    ondragleave={onDragLeave}
                    ondrop={(e) => onDrop(e, column.id)}
                    class="config-table-row draggable {dragState.draggedColumnId === column.id ? 'dragging' : ''} {dragState.dragOverColumnId === column.id && dragState.draggedColumnId !== column.id && dragState.columnDropPosition === 'above' ? 'drag-over-top' : ''} {dragState.dragOverColumnId === column.id && dragState.draggedColumnId !== column.id && dragState.columnDropPosition === 'below' ? 'drag-over-bottom' : ''}"
                >
                    <td>
                        <input
                            type="text"
                            value={column.title}
                            onblur={(e) => updateColumnTitle(column.id, e.currentTarget.value)}
                            class="input"
                        />
                    </td>
                    <td>
                        <input
                            type="text"
                            value={column.description || ""}
                            placeholder="Enter description..."
                            onblur={(e) => updateColumnDescription(column.id, e.currentTarget.value)}
                            class="input"
                        />
                    </td>
                    <td>
                        <button
                            onclick={() => onDeleteColumn(column.id)}
                            class="button button-danger"
                        >
                            Delete
                        </button>
                    </td>
                </tr>
            {/each}
            <!-- Drop zone for adding items at the end -->
            <tr
                ondragover={onEndDrop}
                ondragleave={() => {}}
                ondrop={onEndDrop}
                class="config-table-drop-zone {dragState.dragOverColumnEnd ? 'drag-over-bottom' : ''}"
            >
                <td colspan="3" class="config-table-drop-zone-cell">
                    {dragState.dragOverColumnEnd ? "Drop here to move to end" : ""}
                </td>
            </tr>
        </tbody>
    </table>
</div>