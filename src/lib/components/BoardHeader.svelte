<script lang="ts">
    import { onMount } from "svelte";
    import SceneDropdown from "./SceneDropdown.svelte";
    import Pill from "./ui/Pill.svelte";

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

    let headerContentDiv: HTMLDivElement;

    function updateHeaderWidth() {
        if (headerContentDiv) {
            const innerDiv = headerContentDiv.querySelector(
                ".board-header-content",
            );
            if (innerDiv) {
                const width = (innerDiv as HTMLElement).offsetWidth;
                document.documentElement.style.setProperty(
                    "--board-header-width",
                    `${width}px`,
                );
            }
        }
    }

    onMount(() => {
        updateHeaderWidth();
        // Update on window resize
        const handleResize = () => updateHeaderWidth();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    });
</script>

<div
    id="board-header"
    class="surface-primary content-divider page-container"
    style="padding: var(--spacing-4) var(--spacing-4);"
>
    <div
        id="board-header-content"
        class="page-width"
        bind:this={headerContentDiv}
    >
        <div
            class="board-header-content"
            style="display: flex; justify-content: space-between; align-items: center; width: 100%;"
        >
            <!-- Left: Board title with inline role/status pills -->
            <div
                style="display: flex; align-items: center; gap: var(--spacing-3);"
            >
                <h1 class="heading" style="margin: 0;">
                    {board.name} - {new Date(
                        board.createdAt,
                    ).toLocaleDateString("en-CA")}
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
            <div class="board-toolbar">
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
                    <svg
                        class="icon-sm"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                        />
                    </svg>
                    <span>Share</span>
                </button>
            </div>
        </div>
    </div>
</div>
