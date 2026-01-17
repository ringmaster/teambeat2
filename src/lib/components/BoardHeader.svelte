<script lang="ts">
import { fly } from "svelte/transition";
import { getSceneCapability } from "$lib/utils/scene-capability";
import SceneDropdown from "./SceneDropdown.svelte";
import Icon from "./ui/Icon.svelte";
import Pill from "./ui/Pill.svelte";
import VotingToolbar from "./VotingToolbar.svelte";

interface Props {
	board: {
		id: string;
		name: string;
		seriesId?: string;
		series?: string;
		status?: string;
		blameFreeMode?: boolean;
		votingEnabled?: boolean;
		votingAllocation: number;
		scenes?: Array<{
			id: string;
			name: string;
			allowVoting?: boolean;
		}>;
		cloneSource?: {
			name: string;
			meetingDate?: string | null;
			createdAt: string;
		} | null;
	};
	userRole: string;
	currentScene: {
		id: string;
		name: string;
		allowVoting?: boolean;
	} | null;
	cards?: any[];
	agreements?: any[];
	lastHealthCheckDate?: string | null;
	scorecardCountsByScene?: Record<string, number>;
	showSceneDropdown: boolean;
	showBoardConfig?: boolean;
	connectedUsers?: number;
	userVoteAllocation?: {
		currentVotes: number;
		maxVotes: number;
		remainingVotes: number;
		canVote: boolean;
	};
	votingStats?: {
		totalUsers: number;
		activeUsers: number;
		usersWhoVoted: number;
		usersWhoHaventVoted: number;
		totalVotesCast: number;
		maxPossibleVotes: number;
		remainingVotes: number;
		maxVotesPerUser: number;
	};
	onConfigureClick: () => void;
	onShareBoardLink: () => void;
	onShareSeriesLink: () => void;
	onSceneChange: (sceneId: string) => void;
	onNextScene?: () => void;
	onShowSceneDropdown: (show: boolean) => void;
	onIncreaseAllocation?: () => Promise<void>;
	onResetVotes?: () => Promise<void>;
	onStartTimer?: () => void;
}

let {
	board,
	userRole,
	currentScene,
	cards = [],
	agreements = [],
	lastHealthCheckDate = null,
	scorecardCountsByScene = {},
	showSceneDropdown,
	showBoardConfig = false,
	connectedUsers = 0,
	userVoteAllocation,
	votingStats,
	onConfigureClick,
	onShareBoardLink,
	onShareSeriesLink,
	onSceneChange,
	onNextScene,
	onShowSceneDropdown,
	onIncreaseAllocation,
	onResetVotes,
	onStartTimer,
}: Props = $props();

// Share dropdown state
let shareDropdownOpen = $state(false);
let shareDropdownContainer: HTMLDivElement | undefined = $state();

// Context-aware default: active boards share series link, others share board link
let isActiveBoard = $derived(board.status === "active");
let hasSeriesId = $derived(!!board.seriesId);

function handlePrimaryShare() {
	if (isActiveBoard && hasSeriesId) {
		onShareSeriesLink();
	} else {
		onShareBoardLink();
	}
}

function handleShareBoardLink() {
	onShareBoardLink();
	closeShareDropdown();
}

function handleShareSeriesLink() {
	onShareSeriesLink();
	closeShareDropdown();
}

function toggleShareDropdown() {
	shareDropdownOpen = !shareDropdownOpen;
}

function closeShareDropdown() {
	shareDropdownOpen = false;
}

function handleClickOutside(event: MouseEvent) {
	if (shareDropdownContainer && !shareDropdownContainer.contains(event.target as Node)) {
		closeShareDropdown();
	}
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key === "Escape") {
		closeShareDropdown();
	}
}

$effect(() => {
	if (shareDropdownOpen) {
		document.addEventListener("click", handleClickOutside);
		document.addEventListener("keydown", handleKeydown);
		return () => {
			document.removeEventListener("click", handleClickOutside);
			document.removeEventListener("keydown", handleKeydown);
		};
	}
});

function formatDate(dateString: string | null | undefined) {
	if (!dateString) return null;
	return new Date(dateString).toLocaleDateString("en-US", {
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

let cloneSourceDate = $derived(
	board.cloneSource
		? formatDate(board.cloneSource.meetingDate || board.cloneSource.createdAt)
		: null,
);
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
                    {#if board.cloneSource}
                        &bullet; from "{board.cloneSource.name}" on {cloneSourceDate}
                    {/if}
                </h2>
                <div class="board-name-row">
                    <h1>{board.name}</h1>
                    <div class="pills">
                        <Pill
                            size="sm"
                            tip="Your role on this board"
                            preset={userRole as
                                | "admin"
                                | "member"
                                | "facilitator"}>{userRole}</Pill
                        >
                        {#if board.status && board.status !== "active"}
                            <Pill
                                size="sm"
                                preset={board.status}
                                tip="Board status"
                            >
                                {board.status}
                            </Pill>
                        {/if}
                        {#if board.blameFreeMode}
                            <Pill
                                size="sm"
                                variant="danger"
                                tip="Usernames are replaced with animal names"
                                >Blame-free</Pill
                            >
                        {/if}
                    </div>
                </div>
            </header>
        </div>

        <!-- Right: Toolbar pills -->
        <div>
            {#if ["admin", "facilitator"].includes(userRole)}
                <!-- Scene dropdown/button -->
                {#if board?.scenes && board.scenes.length > 0}
                    <SceneDropdown
                        {board}
                        {currentScene}
                        {cards}
                        {agreements}
                        {lastHealthCheckDate}
                        {scorecardCountsByScene}
                        bind:showSceneDropdown
                        {onSceneChange}
                        {onNextScene}
                        {onShowSceneDropdown}
                    />
                {/if}
            {/if}

            {#if ["admin", "facilitator"].includes(userRole)}
                <button
                    onclick={onConfigureClick}
                    class="toolbar-button facilitator-configure cooltipz--bottom {showBoardConfig
                        ? 'active'
                        : ''}"
                    aria-label="Configure board settings"
                >
                    <Icon name="settings" size="sm" />
                </button>
            {/if}

            {#if ["admin", "facilitator"].includes(userRole) && onStartTimer}
                <button
                    class="toolbar-button facilitator-timer cooltipz--bottom"
                    aria-label="Start a poll for this board"
                    onclick={onStartTimer}
                >
                    <Icon name="clock" size="sm" />
                    <span>Poll</span>
                </button>
            {/if}

            <!-- Split Share Button -->
            <div class="share-split-button" class:is-open={shareDropdownOpen} bind:this={shareDropdownContainer}>
                <button
                    onclick={handlePrimaryShare}
                    class="toolbar-button share-primary cooltipz--bottom"
                    aria-label={isActiveBoard && hasSeriesId ? "Copy series link (always current board)" : "Copy board link"}
                >
                    <Icon name="share" size="sm" />
                    <span>Share</span>
                </button>
                <button
                    onclick={toggleShareDropdown}
                    class="toolbar-button share-dropdown-toggle"
                    aria-label="More share options"
                    aria-haspopup="true"
                    aria-expanded={shareDropdownOpen}
                >
                    <Icon name="chevron-down" size="sm" />
                </button>
                {#if shareDropdownOpen}
                    <div
                        class="share-dropdown-menu"
                        role="menu"
                        transition:fly={{ y: -10, duration: 200 }}
                    >
                        <button
                            onclick={handleShareBoardLink}
                            class="dropdown-menu-item"
                            role="menuitem"
                        >
                            <Icon name="clone" size="sm" />
                            <div class="menu-item-content">
                                <span class="menu-item-label">Copy board link</span>
                                <span class="menu-item-desc">Link to this specific board</span>
                            </div>
                        </button>
                        {#if hasSeriesId}
                            <button
                                onclick={handleShareSeriesLink}
                                class="dropdown-menu-item"
                                role="menuitem"
                            >
                                <Icon name="share" size="sm" />
                                <div class="menu-item-content">
                                    <span class="menu-item-label">Copy series link</span>
                                    <span class="menu-item-desc">Always goes to current board</span>
                                </div>
                            </button>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>

{#if board?.votingEnabled && getSceneCapability(currentScene, board?.status, 'allow_voting') && userVoteAllocation && votingStats}
    <VotingToolbar
        board={{
            id: board.id,
            name: board.name,
            votingEnabled: board.votingEnabled,
            votingAllocation: board.votingAllocation,
            blameFreeMode: board.blameFreeMode,
        }}
        {userRole}
        {connectedUsers}
        {userVoteAllocation}
        {votingStats}
        onIncreaseAllocation={["admin", "facilitator"].includes(userRole)
            ? onIncreaseAllocation
            : undefined}
        onResetVotes={["admin", "facilitator"].includes(userRole)
            ? onResetVotes
            : undefined}
    />
{/if}

<style lang="less">
    #board-header {
        padding: 0 var(--spacing-4);

        @media (min-width: 768px) {
            padding: 0 var(--spacing-6);
        }
    }

    #board-header-content {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-4);

        @media (min-width: 768px) {
            flex-direction: row;
            justify-content: space-between;
            gap: 0;
        }

        > div:first-child {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            width: 100%;

            @media (min-width: 768px) {
                width: auto;
            }
        }

        > div:last-child {
            display: flex;
            gap: var(--spacing-2);
            align-items: center;
            flex-wrap: wrap;

            @media (min-width: 768px) {
                gap: var(--spacing-4);
                flex-wrap: nowrap;
            }
        }
    }

    #board-title {
        .scene-date {
            font-size: var(--text-sm);
            color: var(--color-text-muted);
            margin: 0.3rem 0 -0.3rem 0.3rem;
            font-weight: normal;

            b {
                font-weight: 600;
            }
        }

        .board-name-row {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: var(--spacing-2);
            width: 100%;

            @media (min-width: 640px) {
                flex-direction: row;
                align-items: center;
                gap: var(--spacing-3);
                width: auto;
            }

            h1 {
                margin: 0;
                font-weight: bold;
                color: var(--text-primary);
                font-size: 1.5rem;

                @media (min-width: 768px) {
                    font-size: 1.875rem;
                }
            }

            .pills {
                display: flex;
                gap: var(--spacing-2);
                align-items: center;
                flex-wrap: wrap;
            }
        }
    }

    .toolbar-button.active {
        background: var(--color-primary);
        color: white;

        &:hover {
            background: var(--color-primary-hover);
        }
    }

    /* Split Share Button */
    .share-split-button {
        display: flex;
        position: relative;

        &.is-open {
            z-index: 10001;
        }

        .share-primary {
            border-top-right-radius: 0;
            border-bottom-right-radius: 0;
            border-right: none;
        }

        .share-dropdown-toggle {
            border-top-left-radius: 0;
            border-bottom-left-radius: 0;
            padding: var(--spacing-1) var(--spacing-2);
            min-width: auto;

            :global(svg) {
                transition: transform var(--transition-fast);
            }

            &[aria-expanded="true"] :global(svg) {
                transform: rotate(180deg);
            }
        }
    }

    .share-dropdown-menu {
        position: absolute;
        right: 0;
        top: calc(100% + var(--spacing-1));
        min-width: 240px;
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        padding: var(--spacing-2);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: var(--spacing-1);

        .dropdown-menu-item {
            display: flex;
            align-items: flex-start;
            gap: var(--spacing-3);
            padding: var(--spacing-3);
            background: transparent;
            border: none;
            border-radius: var(--radius-md);
            color: var(--color-text-primary);
            cursor: pointer;
            transition: all var(--transition-fast);
            text-align: left;
            width: 100%;

            :global(svg) {
                flex-shrink: 0;
                margin-top: 2px;
            }

            &:hover {
                background: color-mix(in srgb, var(--color-primary) 10%, transparent);
            }

            &:focus {
                outline: none;
                background: color-mix(in srgb, var(--color-primary) 10%, transparent);
            }
        }

        .menu-item-content {
            display: flex;
            flex-direction: column;
            gap: var(--spacing-1);
        }

        .menu-item-label {
            font-size: 0.875rem;
            font-weight: 500;
            color: var(--color-text-primary);
        }

        .menu-item-desc {
            font-size: 0.75rem;
            color: var(--color-text-secondary);
        }
    }
</style>
