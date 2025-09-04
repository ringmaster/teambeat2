<script lang="ts">
    interface Props {
        showTemplateSelector: boolean;
        templates: any[];
        boardId: string;
        onToggleTemplateSelector: () => void;
        onSetupTemplate: (template: any) => void;
        onConfigureClick: () => void;
        onCloneBoard?: (sourceId: string) => void;
    }
    
    let { 
        showTemplateSelector = $bindable(),
        templates,
        boardId,
        onToggleTemplateSelector,
        onSetupTemplate,
        onConfigureClick,
        onCloneBoard
    }: Props = $props();
    
    let showCloneSelector = $state(false);
    let cloneSources = $state(null);
    let loadingCloneSources = $state(false);
    
    async function toggleCloneSelector() {
        showCloneSelector = !showCloneSelector;
        
        if (showCloneSelector && !cloneSources) {
            loadingCloneSources = true;
            try {
                const response = await fetch(`/api/boards/${boardId}/clone-sources`);
                const data = await response.json();
                
                if (data.success) {
                    cloneSources = data.data;
                } else {
                    console.error('Failed to fetch clone sources:', data.error);
                }
            } catch (error) {
                console.error('Error fetching clone sources:', error);
            } finally {
                loadingCloneSources = false;
            }
        }
    }
    
    function formatDate(dateString: string) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }
    
    function handleCloneBoard(sourceId: string) {
        if (onCloneBoard) {
            onCloneBoard(sourceId);
        }
    }
</script>

<div id="empty-board-setup" class="setup-container">
    <div class="setup-content">
        <!-- Configuration Options -->
        <div class="setup-header">
            <h2 class="setup-title">
                Configure Your Board
            </h2>
            <p class="setup-subtitle">
                Choose a preset template or configure your board manually.
            </p>

            <!-- Quick Setup with Presets -->
            <div class="setup-section">
                <button
                    onclick={onToggleTemplateSelector}
                    class="btn-primary setup-primary-button"
                >
                    {showTemplateSelector ? "Hide Templates" : "Quick Setup with Templates"}
                </button>

                {#if showTemplateSelector}
                    <div class="template-grid">
                        {#each templates as template}
                            <button
                                onclick={() => onSetupTemplate(template)}
                                class="template-card"
                            >
                                <h4 class="template-card-title">
                                    {template.name}
                                </h4>
                                <p class="template-card-description">
                                    {template.description}
                                </p>
                                <div class="template-card-meta">
                                    {template.columns.length} columns • {template.scenes} scenes
                                </div>
                                <!-- Show column previews -->
                                <div class="template-card-columns">
                                    {#each template.columns.slice(0, 2) as column}
                                        <span class="template-column-tag">
                                            {column.length > 20 ? column.substring(0, 20) + '...' : column}
                                        </span>
                                    {/each}
                                    {#if template.columns.length > 2}
                                        <span class="template-more-text">
                                            +{template.columns.length - 2} more
                                        </span>
                                    {/if}
                                </div>
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Clone Existing Board -->
            <div class="setup-section">
                <button
                    onclick={toggleCloneSelector}
                    class="btn-secondary setup-primary-button"
                >
                    {showCloneSelector ? "Hide Clone Options" : "Clone An Existing Board"}
                </button>

                {#if showCloneSelector}
                    {#if loadingCloneSources}
                        <div class="clone-loading">
                            <div class="loading-text">Loading available boards...</div>
                        </div>
                    {:else if cloneSources}
                        <div class="clone-grid">
                            <!-- Current Series Boards -->
                            <div>
                                <h4 class="clone-section-title">From This Series</h4>
                                {#if cloneSources.currentSeries.length === 0}
                                    <div class="clone-empty-state">
                                        No other boards in this series
                                    </div>
                                {:else}
                                    <div class="space-y-3">
                                        {#each cloneSources.currentSeries as board}
                                            <button
                                                onclick={() => handleCloneBoard(board.id)}
                                                class="clone-board-card"
                                            >
                                                <div class="flex justify-between items-start">
                                                    <div class="flex-1">
                                                        <h5 class="clone-board-name">{board.name}</h5>
                                                        <div class="clone-board-date">
                                                            {formatDate(board.meetingDate || board.createdAt)}
                                                        </div>
                                                    </div>
                                                    <span class="clone-board-status status-primary">
                                                        {board.status}
                                                    </span>
                                                </div>
                                            </button>
                                        {/each}
                                    </div>
                                {/if}
                            </div>

                            <!-- Other Series Boards -->
                            <div>
                                <h4 class="clone-section-title">From Other Series</h4>
                                {#if cloneSources.otherSeries.length === 0}
                                    <div class="clone-empty-state">
                                        No boards available from other series
                                    </div>
                                {:else}
                                    <div class="space-y-3">
                                        {#each cloneSources.otherSeries as board}
                                            <button
                                                onclick={() => handleCloneBoard(board.id)}
                                                class="clone-board-card"
                                            >
                                                <div class="flex justify-between items-start">
                                                    <div class="flex-1">
                                                        <h5 class="clone-board-name">{board.seriesName} - {board.name}</h5>
                                                        <div class="clone-board-date">
                                                            {formatDate(board.meetingDate || board.createdAt)}
                                                        </div>
                                                    </div>
                                                    <span class="clone-board-status status-secondary">
                                                        {board.status}
                                                    </span>
                                                </div>
                                            </button>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/if}
                {/if}
            </div>

            <!-- Custom Configuration -->
            <div class="setup-manual-section">
                <h3 class="setup-manual-title">
                    Or Configure Manually
                </h3>
                <p class="setup-manual-description">
                    Set up your board columns, scenes, and settings from scratch.
                </p>
                <button
                    onclick={onConfigureClick}
                    class="btn-primary setup-primary-button"
                >
                    Configure Board Settings
                </button>
            </div>
        </div>

        <!-- Info Section -->
        <div class="setup-info-section">
            <h3 class="setup-info-title">
                Getting Started
            </h3>
            <p class="setup-info-description">
                Your board is ready! Add some columns and scenes to get started with
                your retrospective or planning session.
            </p>
            <ul class="setup-info-list">
                <li>• Columns organize different types of feedback or topics</li>
                <li>• Scenes control what participants can do (add cards, vote, etc.)</li>
                <li>• Templates provide quick setups for common meeting types</li>
            </ul>
        </div>
    </div>
</div>