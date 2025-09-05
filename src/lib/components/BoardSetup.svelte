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

<style>
/* Setup Container Styles */
.setup-container {
    padding: var(--spacing-8) var(--spacing-4);
}

@media (min-width: 640px) {
    .setup-container {
        padding: var(--spacing-8) var(--spacing-6);
    }
}

@media (min-width: 1024px) {
    .setup-container {
        padding: var(--spacing-8);
    }
}

.setup-content {
    max-width: 64rem;
    margin: 0 auto;
}

.setup-header {
    text-align: center;
    margin-bottom: var(--spacing-12);
}

.setup-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: rgb(var(--color-text-primary));
    margin-bottom: var(--spacing-4);
}

@media (min-width: 768px) {
    .setup-title {
        font-size: 2rem;
    }
}

.setup-subtitle {
    color: rgb(var(--color-text-secondary));
    margin-bottom: var(--spacing-8);
}

.setup-section {
    margin-bottom: var(--spacing-8);
}

.setup-primary-button {
    width: 100%;
    margin-bottom: var(--spacing-4);
}

/* Template Grid Styles */
.template-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--spacing-4);
}

@media (min-width: 768px) {
    .template-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (min-width: 1024px) {
    .template-grid {
        grid-template-columns: repeat(3, 1fr);
    }
}

.template-card {
    width: 100%;
    text-align: left;
    padding: var(--spacing-4);
    border: 1px solid rgb(var(--color-border));
    border-radius: var(--radius-lg);
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: var(--shadow-sm);
}

.template-card:hover {
    background: rgb(var(--color-gray-50));
    border-color: rgb(var(--color-border-hover));
    box-shadow: var(--shadow-md);
}

.template-card-title {
    font-weight: 500;
    color: rgb(var(--color-text-primary));
    margin-bottom: var(--spacing-2);
}

.template-card-description {
    font-size: 0.875rem;
    color: rgb(var(--color-text-secondary));
    margin-bottom: var(--spacing-3);
}

.template-card-meta {
    font-size: 0.75rem;
    color: rgb(var(--color-text-muted));
}

.template-card-columns {
    margin-top: var(--spacing-2);
    font-size: 0.75rem;
    color: rgb(var(--color-text-muted));
}

.template-column-tag {
    display: inline-block;
    background: rgb(var(--color-gray-100));
    border-radius: var(--radius-sm);
    padding: var(--spacing-1) var(--spacing-2);
    margin-right: var(--spacing-1);
    margin-bottom: var(--spacing-1);
}

.template-more-text {
    display: inline-block;
    color: rgb(var(--color-text-muted));
}

/* Clone Grid Styles */
.clone-loading {
    text-align: center;
    padding: var(--spacing-8) 0;
}

.clone-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--spacing-6);
}

@media (min-width: 1024px) {
    .clone-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

.clone-section-title {
    font-weight: 500;
    color: rgb(var(--color-text-primary));
    margin-bottom: var(--spacing-4);
}

.clone-empty-state {
    font-size: 0.875rem;
    color: rgb(var(--color-text-muted));
    padding: var(--spacing-4);
    border: 1px solid rgb(var(--color-border));
    border-radius: var(--radius-lg);
    background: rgb(var(--color-gray-50));
}

.clone-board-card {
    width: 100%;
    text-align: left;
    padding: var(--spacing-4);
    border: 1px solid rgb(var(--color-border));
    border-radius: var(--radius-lg);
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
}

.clone-board-card:hover {
    background: rgb(var(--color-gray-50));
    border-color: rgb(var(--color-border-hover));
}

.clone-board-name {
    font-weight: 500;
    color: rgb(var(--color-text-primary));
}

.clone-board-date {
    font-size: 0.75rem;
    color: rgb(var(--color-text-muted));
    margin-top: var(--spacing-1);
}

.clone-board-status {
    font-size: 0.75rem;
    padding: var(--spacing-1) var(--spacing-2);
    border-radius: var(--radius-full);
}

.clone-board-status.status-primary {
    background: rgb(var(--color-primary) / 0.1);
    color: rgb(var(--color-primary));
}

.clone-board-status.status-secondary {
    background: rgb(var(--color-secondary) / 0.1);
    color: rgb(var(--color-secondary));
}

/* Setup Manual Section */
.setup-manual-section {
    border-top: 1px solid rgb(var(--color-border));
    padding-top: var(--spacing-8);
}

.setup-manual-title {
    font-size: 1.125rem;
    font-weight: 500;
    color: rgb(var(--color-text-primary));
    margin-bottom: var(--spacing-4);
}

.setup-manual-description {
    color: rgb(var(--color-text-secondary));
    margin-bottom: var(--spacing-6);
}

.setup-info-section {
    background: rgb(var(--color-primary) / 0.05);
    border-radius: var(--radius-lg);
    padding: var(--spacing-6);
    border: 1px solid rgb(var(--color-primary) / 0.1);
}

.setup-info-title {
    font-size: 1.125rem;
    font-weight: 500;
    color: rgb(var(--color-primary));
    margin-bottom: var(--spacing-2);
}

.setup-info-description {
    color: rgb(var(--color-primary));
    margin-bottom: var(--spacing-4);
}

.setup-info-list {
    color: rgb(var(--color-primary));
    font-size: 0.875rem;
    list-style: none;
}

.setup-info-list li {
    margin-bottom: var(--spacing-1);
}
</style>