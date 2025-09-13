<script lang="ts">
    import Icon from "./ui/Icon.svelte";

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
        dragState,
    }: Props = $props();

    function updateColumnTitle(columnId: string, title: string) {
        onUpdateColumn(columnId, { title: title.trim() });
    }

    function updateColumnDescription(columnId: string, description: string) {
        onUpdateColumn(columnId, { description: description || null });
    }
</script>

<div class="config-section-header">
    <h3 class="config-section-title">Board Columns</h3>
    <button onclick={onAddNewColumn} class="btn-primary">
        <Icon name="plus" size="md" class="icon-white" />
        Add Column
    </button>
</div>

<!-- Columns Table -->
<div class="config-table-wrapper">
    <table class="config-table">
        <thead>
            <tr class="config-table-header">
                <th class="config-table-th" style="width: 40px;">Order</th>
                <th class="config-table-th">Title</th>
                <th class="config-table-th">Description</th>
                <th class="config-table-th" style="width: 120px;">Delete</th>
            </tr>
        </thead>
        <tbody>
            {#each board.allColumns || [] as column, _index (column.id)}
                <tr
                    draggable="true"
                    ondragstart={(e) => onDragStart(e, column.id)}
                    ondragover={(e) => onDragOver(e, column.id)}
                    ondragleave={onDragLeave}
                    ondrop={(e) => onDrop(e, column.id)}
                    class="config-table-row draggable {dragState.draggedColumnId ===
                    column.id
                        ? 'dragging'
                        : ''} {dragState.dragOverColumnId === column.id &&
                    dragState.draggedColumnId !== column.id &&
                    dragState.columnDropPosition === 'above'
                        ? 'drag-over-top'
                        : ''} {dragState.dragOverColumnId === column.id &&
                    dragState.draggedColumnId !== column.id &&
                    dragState.columnDropPosition === 'below'
                        ? 'drag-over-bottom'
                        : ''}"
                >
                    <td>
                        <div class="drag-handle" title="Drag to reorder">
                            <Icon
                                name="grip-vertical"
                                size="sm"
                                class="drag-handle-icon"
                            />
                        </div>
                    </td>
                    <td>
                        <input
                            type="text"
                            value={column.title}
                            onblur={(e) =>
                                updateColumnTitle(
                                    column.id,
                                    e.currentTarget.value,
                                )}
                            class="input"
                        />
                    </td>
                    <td>
                        <input
                            type="text"
                            value={column.description || ""}
                            placeholder="Enter description..."
                            onblur={(e) =>
                                updateColumnDescription(
                                    column.id,
                                    e.currentTarget.value,
                                )}
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
                class="config-table-drop-zone {dragState.dragOverColumnEnd
                    ? 'drag-over-bottom'
                    : ''}"
            >
                <td colspan="4" class="config-table-drop-zone-cell">
                    {dragState.dragOverColumnEnd
                        ? "Drop here to move to end"
                        : ""}
                </td>
            </tr>
        </tbody>
    </table>
</div>

<style>
    .config-section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
    }

    .config-table-wrapper {
        width: 100%;
    }

    .config-table {
        width: 100%;
    }

    .drag-handle {
        cursor: grab;
        color: var(--color-text-muted);
    }
</style>
