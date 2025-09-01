<script lang="ts">
    import { fade, fly } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import ConfigColumnsTable from './ConfigColumnsTable.svelte';
    import ConfigScenesTable from './ConfigScenesTable.svelte';
    
    interface Props {
        showBoardConfig: boolean;
        userRole: string;
        configActiveTab: string;
        board: any;
        configForm: any;
        onClose: () => void;
        onTabChange: (tab: string) => void;
        onUpdateBoardConfig: (config: any) => void;
        onAddNewColumn: () => void;
        onAddNewScene: () => void;
        onUpdateColumn: (columnId: string, data: any) => void;
        onDeleteColumn: (columnId: string) => void;
        onUpdateScene: (sceneId: string, data: any) => void;
        onDeleteScene: (sceneId: string) => void;
        onDragStart: (type: 'column' | 'scene', e: DragEvent, id: string) => void;
        onDragOver: (type: 'column' | 'scene', e: DragEvent, id: string) => void;
        onDragLeave: (type: 'column' | 'scene', e: DragEvent) => void;
        onDrop: (type: 'column' | 'scene', e: DragEvent, id: string) => void;
        onEndDrop: (type: 'column' | 'scene', e: DragEvent) => void;
        dragState: {
            draggedColumnId: string;
            draggedSceneId: string;
            dragOverColumnId: string;
            dragOverSceneId: string;
            columnDropPosition: string;
            sceneDropPosition: string;
            dragOverColumnEnd: boolean;
            dragOverSceneEnd: boolean;
        };
    }
    
    let { 
        showBoardConfig,
        userRole,
        configActiveTab = $bindable(),
        board,
        configForm = $bindable(),
        onClose,
        onTabChange,
        onUpdateBoardConfig,
        onAddNewColumn,
        onAddNewScene,
        onUpdateColumn,
        onDeleteColumn,
        onUpdateScene,
        onDeleteScene,
        onDragStart,
        onDragOver,
        onDragLeave,
        onDrop,
        onEndDrop,
        dragState
    }: Props = $props();
</script>

<!-- Board Configuration Modal -->
{#if showBoardConfig && ["admin", "facilitator"].includes(userRole)}
    <div
        id="board-config-modal-overlay"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
        transition:fade={{ duration: 300 }}
    >
        <div
            id="board-config-modal"
            class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
            transition:fly={{ y: -10, duration: 300, easing: cubicOut }}
        >
            <!-- Modal Header -->
            <div
                class="flex items-center justify-between px-6 py-4 border-b border-gray-200"
            >
                <h2 class="text-xl font-semibold text-gray-900">
                    Board Configuration
                </h2>
                <button
                    onclick={onClose}
                    class="text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>

            <!-- Tab Navigation -->
            <div class="border-b border-gray-200">
                <nav class="flex px-6">
                    <button
                        onclick={() => onTabChange("columns")}
                        class="py-3 px-4 text-sm font-medium border-b-2 transition-colors {configActiveTab === 'columns'
                            ? 'border-teal-500 text-teal-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
                    >
                        Columns
                    </button>
                    <button
                        onclick={() => onTabChange("scenes")}
                        class="py-3 px-4 text-sm font-medium border-b-2 transition-colors {configActiveTab === 'scenes'
                            ? 'border-teal-500 text-teal-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
                    >
                        Scenes
                    </button>
                    <button
                        onclick={() => onTabChange("general")}
                        class="py-3 px-4 text-sm font-medium border-b-2 transition-colors {configActiveTab === 'general'
                            ? 'border-teal-500 text-teal-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
                    >
                        General
                    </button>
                </nav>
            </div>

            <!-- Tab Content -->
            <div class="px-6 py-6 overflow-y-auto max-h-[60vh]">
                {#if configActiveTab === "columns"}
                    <div class="space-y-4 animate-in fade-in duration-200 ease-out">
                        <ConfigColumnsTable 
                            {board}
                            {onAddNewColumn}
                            {onUpdateColumn}
                            {onDeleteColumn}
                            onDragStart={(e, id) => onDragStart('column', e, id)}
                            onDragOver={(e, id) => onDragOver('column', e, id)}
                            onDragLeave={(e) => onDragLeave('column', e)}
                            onDrop={(e, id) => onDrop('column', e, id)}
                            onEndDrop={(e) => onEndDrop('column', e)}
                            {dragState}
                        />
                    </div>
                {:else if configActiveTab === "scenes"}
                    <div class="space-y-4 animate-in fade-in duration-200 ease-out">
                        <ConfigScenesTable 
                            {board}
                            {onAddNewScene}
                            {onUpdateScene}
                            {onDeleteScene}
                            onDragStart={(e, id) => onDragStart('scene', e, id)}
                            onDragOver={(e, id) => onDragOver('scene', e, id)}
                            onDragLeave={(e) => onDragLeave('scene', e)}
                            onDrop={(e, id) => onDrop('scene', e, id)}
                            onEndDrop={(e) => onEndDrop('scene', e)}
                            {dragState}
                        />
                    </div>
                {:else if configActiveTab === "general"}
                    <div class="space-y-6 animate-in fade-in duration-200 ease-out">
                        <h3 class="text-lg font-medium text-gray-900">
                            General Settings
                        </h3>

                        <div class="space-y-4">
                            <div>
                                <label
                                    for="board-name-input"
                                    class="block text-sm font-medium text-gray-700 mb-2"
                                    >Board Name</label
                                >
                                <input
                                    id="board-name-input"
                                    type="text"
                                    bind:value={configForm.name}
                                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    onblur={() => onUpdateBoardConfig({ name: configForm.name })}
                                />
                            </div>

                            <div>
                                <label class="flex items-center space-x-3">
                                    <input
                                        type="checkbox"
                                        bind:checked={configForm.blameFreeMode}
                                        onchange={() => onUpdateBoardConfig({ blameFreeMode: configForm.blameFreeMode })}
                                        class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span class="text-sm font-medium text-gray-700">
                                        Blame-free Mode
                                    </span>
                                </label>
                                <p class="text-xs text-gray-500 ml-7 mt-1">
                                    Hide user names on cards to encourage open feedback
                                </p>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}