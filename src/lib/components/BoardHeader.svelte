<script lang="ts">
import { getSceneCapability } from "$lib/utils/scene-capability";
import SceneDropdown from "./SceneDropdown.svelte";
import Icon from "./ui/Icon.svelte";
import Pill from "./ui/Pill.svelte";
import VotingToolbar from "./VotingToolbar.svelte";

interface Props {
	board: {
		id: string;
		name: string;
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
	onShareClick: () => void;
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
	onShareClick,
	onSceneChange,
	onNextScene,
	onShowSceneDropdown,
	onIncreaseAllocation,
	onResetVotes,
	onStartTimer,
}: Props = $props();

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

            <button
                onclick={onShareClick}
                class="toolbar-button share-board cooltipz--bottom"
                aria-label="Copy board URL"
            >
                <Icon name="share" class="icon-sm" />
                <span>Share</span>
            </button>
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
</style>
