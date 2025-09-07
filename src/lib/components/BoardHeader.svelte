<script lang="ts">
    import { onMount } from "svelte";
    import SceneDropdown from "./SceneDropdown.svelte";
    import Pill from "./ui/Pill.svelte";
    import Icon from "./ui/Icon.svelte";

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
        onShowSceneDropdown,
    }: Props = $props();
</script>

<div id="board-header" class="surface-primary content-divider page-container">
    <div id="board-header-content" class="page-width">
        <!-- Left: Board title with inline role/status pills -->
        <div>
            <h1 class="heading" style="margin: 0;">
                {board.name} - {new Date(board.createdAt).toLocaleDateString(
                    "en-CA",
                )}
            </h1>
            <Pill size="sm" preset={userRole}>{userRole}</Pill>
            {#if board.status && board.status !== "active"}
                <Pill size="sm" preset={board.status}>
                    {board.status}
                </Pill>
            {/if}
            {#if board.blameFreeMode}
                <Pill size="sm" variant="success">Blame-free</Pill>
            {/if}
        </div>

        <!-- Right: Toolbar pills -->
        <div>
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
                <button onclick={onConfigureClick} class="toolbar-button">
                    Configure
                </button>
            {/if}

            {#if ["admin", "facilitator"].includes(userRole)}
                <button class="toolbar-button"> Timer </button>
            {/if}

            <button onclick={onShareClick} class="toolbar-button">
                <Icon name="share" class="icon-sm" />
                <span>Share</span>
            </button>
        </div>
    </div>
</div>

<style type="less">
    #board-header {
        padding: var(--spacing-4) var(--spacing-4);
    }
    #board-header-content {
        display: flex;
        justify-content: space-between;
        width: 78rem;

        div {
            display: flex;
            gap: var(--spacing-4);
            align-items: center;
        }
    }
</style>
