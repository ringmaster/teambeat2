<script lang="ts">
    interface Props {
        showTemplateSelector: boolean;
        templates: any[];
        onToggleTemplateSelector: () => void;
        onSetupTemplate: (template: any) => void;
        onConfigureClick: () => void;
    }
    
    let { 
        showTemplateSelector = $bindable(),
        templates, 
        onToggleTemplateSelector,
        onSetupTemplate,
        onConfigureClick 
    }: Props = $props();
</script>

<div id="empty-board-setup" class="px-4 sm:px-6 lg:px-8 py-8">
    <div class="max-w-4xl mx-auto">
        <!-- Configuration Options -->
        <div class="text-center mb-12">
            <h2 class="text-2xl font-bold text-gray-900 mb-4">
                Configure Your Board
            </h2>
            <p class="text-gray-600 mb-8">
                Choose a preset template or configure your board manually.
            </p>

            <!-- Quick Setup with Presets -->
            <div class="mb-8">
                <button
                    onclick={onToggleTemplateSelector}
                    class="w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors mb-4"
                >
                    {showTemplateSelector ? "Hide Templates" : "Quick Setup with Templates"}
                </button>

                {#if showTemplateSelector}
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {#each templates as template}
                            <button
                                onclick={() => onSetupTemplate(template)}
                                class="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
                            >
                                <h4 class="font-medium text-gray-900 mb-2">
                                    {template.name}
                                </h4>
                                <p class="text-sm text-gray-600 mb-3">
                                    {template.description}
                                </p>
                                <div class="text-xs text-gray-500">
                                    {template.columns.length} columns • {template.scenes} scenes
                                </div>
                                <!-- Show column previews -->
                                <div class="mt-2 text-xs text-gray-400">
                                    {#each template.columns.slice(0, 2) as column}
                                        <span class="inline-block bg-gray-100 rounded px-2 py-1 mr-1 mb-1">
                                            {column.length > 20 ? column.substring(0, 20) + '...' : column}
                                        </span>
                                    {/each}
                                    {#if template.columns.length > 2}
                                        <span class="inline-block text-gray-400">
                                            +{template.columns.length - 2} more
                                        </span>
                                    {/if}
                                </div>
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Custom Configuration -->
            <div class="border-t border-gray-200 pt-8">
                <h3 class="text-lg font-medium text-gray-900 mb-4">
                    Or Configure Manually
                </h3>
                <p class="text-gray-600 mb-6">
                    Set up your board columns, scenes, and settings from scratch.
                </p>
                <button
                    onclick={onConfigureClick}
                    class="w-full bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-md font-medium transition-colors"
                >
                    Configure Board Settings
                </button>
            </div>
        </div>

        <!-- Info Section -->
        <div class="bg-blue-50 rounded-lg p-6">
            <h3 class="text-lg font-medium text-blue-900 mb-2">
                Getting Started
            </h3>
            <p class="text-blue-700 mb-4">
                Your board is ready! Add some columns and scenes to get started with
                your retrospective or planning session.
            </p>
            <ul class="text-blue-700 text-sm space-y-1">
                <li>• Columns organize different types of feedback or topics</li>
                <li>• Scenes control what participants can do (add cards, vote, etc.)</li>
                <li>• Templates provide quick setups for common meeting types</li>
            </ul>
        </div>
    </div>
</div>