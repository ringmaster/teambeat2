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

<div id="board-header" class="surface-primary content-divider">
    <div id="board-header-content" class="page-width page-container">
        <!-- Left: Board title with inline role/status pills -->
        <div>
            <header id="board-title">
                <h2 class="scene-date">
                    <b>{board.series || ""}</b> &bullet; {new Date().toLocaleDateString(
                        "en-US",
                        {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                        },
                    )}
                </h2>
                <div class="board-name-row">
                    <h1>{board.name}</h1>
                    <div class="pills">
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
                </div>
            </header>
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
        padding: 0 var(--spacing-4);
    }
    #board-header-content {
        display: flex;
        justify-content: space-between;

        > div:first-child {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
        }

        > div:last-child {
            display: flex;
            gap: var(--spacing-4);
            align-items: center;
        }
    }

    #board-title {
        .scene-date {
            font-size: var(--text-sm);
            color: var(--text-muted);
            margin: 0.3rem 0 -0.3rem 0.3rem;
            font-weight: normal;

            b {
                font-weight: 600;
            }
        }

        .board-name-row {
            display: flex;
            align-items: center;
            gap: var(--spacing-3);

            h1 {
                margin: 0;
                font-weight: bold;
                color: var(--text-primary);
            }

            .pills {
                display: flex;
                gap: var(--spacing-2);
                align-items: center;
            }
        }
    }
</style>
