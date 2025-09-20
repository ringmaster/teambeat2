<script lang="ts">
    import Icon from "./ui/Icon.svelte";
    import UserStatusModal from "./UserStatusModal.svelte";
    import { toastStore } from "$lib/stores/toast";
    import { slide } from "svelte/transition";

    interface Props {
        board: {
            id: string;
            name: string;
            votingEnabled: boolean;
            votingAllocation: number;
            blameFreeMode?: boolean;
        };
        userRole: string;
        connectedUsers: number;
        userVoteAllocation: {
            currentVotes: number;
            maxVotes: number;
            remainingVotes: number;
            canVote: boolean;
        };
        votingStats: {
            totalUsers: number;
            activeUsers: number;
            usersWhoVoted: number;
            usersWhoHaventVoted: number;
            totalVotesCast: number;
            maxPossibleVotes: number;
            remainingVotes: number;
            maxVotesPerUser: number;
        };
        onIncreaseAllocation?: () => Promise<void>;
        onResetVotes?: () => Promise<void>;
    }

    let {
        board,
        userRole,
        connectedUsers,
        userVoteAllocation,
        votingStats,
        onIncreaseAllocation,
        onResetVotes,
    }: Props = $props();

    let isIncreasing = $state(false);
    let isResetting = $state(false);
    let showUserStatusModal = $state(false);

    async function handleIncreaseAllocation() {
        if (isIncreasing || !onIncreaseAllocation) return;

        try {
            isIncreasing = true;
            await onIncreaseAllocation();
            toastStore.success("Voting allocation increased by 1");
        } catch (error) {
            console.error("Failed to increase allocation:", error);
            toastStore.error("Failed to increase voting allocation");
        } finally {
            isIncreasing = false;
        }
    }

    async function handleResetVotes() {
        if (isResetting || !onResetVotes) return;

        toastStore.warning(
            "This will delete all votes and set allocation to 0. Are you sure?",
            {
                autoHide: false,
                actions: [
                    {
                        label: "Reset Votes",
                        onClick: async () => {
                            try {
                                isResetting = true;
                                await onResetVotes();
                                toastStore.success("All votes have been reset");
                            } catch (error) {
                                console.error("Failed to reset votes:", error);
                                toastStore.error("Failed to reset votes");
                            } finally {
                                isResetting = false;
                            }
                        },
                        variant: "primary",
                    },
                    {
                        label: "Cancel",
                        onClick: () => {},
                        variant: "secondary",
                    },
                ],
            },
        );
    }

    let showAdminControls = $derived(
        ["admin", "facilitator"].includes(userRole),
    );

    // Use activeUsers from votingStats
    let displayedConnectedUsers = $derived(votingStats?.activeUsers || 0);

    function openUserStatusModal() {
        if (showAdminControls) {
            showUserStatusModal = true;
        }
    }
</script>

<div class="voting-toolbar" transition:slide={{ duration: 300 }}>
    <div class="voting-toolbar-content page-width page-container">
        <!-- Users connected -->
        {#if showAdminControls}
            <button
                class="stat-item clickable"
                onclick={openUserStatusModal}
                title="Click to view user voting status"
            >
                <span class="stat-value">{displayedConnectedUsers}</span>
                <svg class="users-icon" viewBox="0 0 164.49 119.26">
                    <path
                        fill="currentColor"
                        d="M82.24 0c14.75,0 26.73,11.98 26.73,26.73 0,14.75 -11.98,26.73 -26.73,26.73 -14.75,0 -26.73,-11.98 -26.73,-26.73 0,-14.75 11.98,-26.73 26.73,-26.73zm-57.57 18.51c10.23,0 18.51,8.28 18.51,18.5 0,10.23 -8.28,18.5 -18.51,18.5 -10.23,0 -18.5,-8.28 -18.5,-18.5 0,-10.23 8.28,-18.5 18.5,-18.5zm-24.67 84.3c0,-18.17 14.73,-32.9 32.9,-32.9 3.29,0 6.48,0.49 9.48,1.39 -8.46,9.46 -13.6,21.95 -13.6,35.62l0 4.11c0,2.93 0.62,5.71 1.72,8.22l-22.28 0c-4.55,0 -8.22,-3.68 -8.22,-8.22l0 -8.22zm133.98 16.45c1.11,-2.52 1.72,-5.29 1.72,-8.22l0 -4.11c0,-13.67 -5.14,-26.16 -13.6,-35.62 3.01,-0.9 6.19,-1.39 9.48,-1.39 18.17,0 32.9,14.73 32.9,32.9l0 8.22c0,4.55 -3.68,8.22 -8.22,8.22l-22.28 0zm-12.67 -82.24c0,-10.23 8.28,-18.5 18.51,-18.5 10.23,0 18.5,8.28 18.5,18.5 0,10.23 -8.28,18.5 -18.5,18.5 -10.23,0 -18.51,-8.28 -18.51,-18.5zm-80.19 69.91c0,-22.72 18.4,-41.12 41.12,-41.12 22.72,0 41.12,18.4 41.12,41.12l0 4.11c0,4.55 -3.68,8.22 -8.22,8.22l-65.8 0c-4.55,0 -8.22,-3.68 -8.22,-8.22l0 -4.11z"
                    />
                </svg>
            </button>
        {:else}
            <div class="stat-item" title="Connected users">
                <span class="stat-value">{displayedConnectedUsers}</span>
                <svg class="users-icon" viewBox="0 0 164.49 119.26">
                    <path
                        fill="currentColor"
                        d="M82.24 0c14.75,0 26.73,11.98 26.73,26.73 0,14.75 -11.98,26.73 -26.73,26.73 -14.75,0 -26.73,-11.98 -26.73,-26.73 0,-14.75 11.98,-26.73 26.73,-26.73zm-57.57 18.51c10.23,0 18.51,8.28 18.51,18.5 0,10.23 -8.28,18.5 -18.51,18.5 -10.23,0 -18.5,-8.28 -18.5,-18.5 0,-10.23 8.28,-18.5 18.5,-18.5zm-24.67 84.3c0,-18.17 14.73,-32.9 32.9,-32.9 3.29,0 6.48,0.49 9.48,1.39 -8.46,9.46 -13.6,21.95 -13.6,35.62l0 4.11c0,2.93 0.62,5.71 1.72,8.22l-22.28 0c-4.55,0 -8.22,-3.68 -8.22,-8.22l0 -8.22zm133.98 16.45c1.11,-2.52 1.72,-5.29 1.72,-8.22l0 -4.11c0,-13.67 -5.14,-26.16 -13.6,-35.62 3.01,-0.9 6.19,-1.39 9.48,-1.39 18.17,0 32.9,14.73 32.9,32.9l0 8.22c0,4.55 -3.68,8.22 -8.22,8.22l-22.28 0zm-12.67 -82.24c0,-10.23 8.28,-18.5 18.51,-18.5 10.23,0 18.5,8.28 18.5,18.5 0,10.23 -8.28,18.5 -18.5,18.5 -10.23,0 -18.51,-8.28 -18.51,-18.5zm-80.19 69.91c0,-22.72 18.4,-41.12 41.12,-41.12 22.72,0 41.12,18.4 41.12,41.12l0 4.11c0,4.55 -3.68,8.22 -8.22,8.22l-65.8 0c-4.55,0 -8.22,-3.68 -8.22,-8.22l0 -4.11z"
                    />
                </svg>
            </div>
        {/if}

        <!-- Total remaining votes across all users -->
        {#if showAdminControls}
            <button
                class="stat-item clickable"
                onclick={openUserStatusModal}
                title="Click to view detailed voting status"
            >
                <span class="stat-value">{votingStats.remainingVotes}</span>
                <svg class="votes-icon" viewBox="0 0 2315.49 2202.5">
                    <path
                        fill="currentColor"
                        d="M7.41 584.17c0,1861.94 -222.38,1606.48 1770.71,1606.48 552.07,0 436.83,-725.71 417.76,-1268.89 -440.38,226.34 92.11,1067.99 -454.28,1067.99 -284.61,0 -1270.84,38.26 -1478.6,-36.5 -94.71,-233.43 -96.22,-1481.84 0,-1715.83 235.04,-63.65 553.67,-37.22 821.5,-36.46 494.94,1.4 343.45,40.23 620.68,-191.8l-1204.95 -9.15c-386.93,0 -492.82,196.99 -492.82,584.17z"
                    />
                    <path
                        fill="currentColor"
                        d="M1240.96 1254.38c-133.58,-48.8 -242.66,-132.57 -372.64,-201.78l-114.28 94.15 505.54 679.08c110.59,-228.53 573.06,-848.02 761.79,-1026.27l252.79 -272.92c26.7,-29.04 16.63,-15.87 41.33,-48.46 -219.81,0 -214.36,0.03 -352.86,112.1l-485.84 434.37c-86.38,90.21 -132.43,146.9 -235.83,229.72z"
                    />
                    <path
                        fill="currentColor"
                        d="M616.43 1041.78c-100.92,-36.88 -183.33,-100.16 -281.54,-152.45l-86.34 71.13 381.94 513.06c83.55,-172.66 432.97,-640.69 575.55,-775.36l190.99 -206.21c20.17,-21.94 12.56,-12 31.22,-36.62 -166.07,0 -161.95,0.03 -266.6,84.7l-367.07 328.18c-65.25,68.15 -100.05,110.99 -178.17,173.56z"
                    />
                </svg>
            </button>
        {:else}
            <div class="stat-item" title="Total votes remaining">
                <span class="stat-value">{votingStats.remainingVotes}</span>
                <svg class="votes-icon" viewBox="0 0 2315.49 2202.5">
                    <path
                        fill="currentColor"
                        d="M7.41 584.17c0,1861.94 -222.38,1606.48 1770.71,1606.48 552.07,0 436.83,-725.71 417.76,-1268.89 -440.38,226.34 92.11,1067.99 -454.28,1067.99 -284.61,0 -1270.84,38.26 -1478.6,-36.5 -94.71,-233.43 -96.22,-1481.84 0,-1715.83 235.04,-63.65 553.67,-37.22 821.5,-36.46 494.94,1.4 343.45,40.23 620.68,-191.8l-1204.95 -9.15c-386.93,0 -492.82,196.99 -492.82,584.17z"
                    />
                    <path
                        fill="currentColor"
                        d="M1240.96 1254.38c-133.58,-48.8 -242.66,-132.57 -372.64,-201.78l-114.28 94.15 505.54 679.08c110.59,-228.53 573.06,-848.02 761.79,-1026.27l252.79 -272.92c26.7,-29.04 16.63,-15.87 41.33,-48.46 -219.81,0 -214.36,0.03 -352.86,112.1l-485.84 434.37c-86.38,90.21 -132.43,146.9 -235.83,229.72z"
                    />
                    <path
                        fill="currentColor"
                        d="M616.43 1041.78c-100.92,-36.88 -183.33,-100.16 -281.54,-152.45l-86.34 71.13 381.94 513.06c83.55,-172.66 432.97,-640.69 575.55,-775.36l190.99 -206.21c20.17,-21.94 12.56,-12 31.22,-36.62 -166.07,0 -161.95,0.03 -266.6,84.7l-367.07 328.18c-65.25,68.15 -100.05,110.99 -178.17,173.56z"
                    />
                </svg>
            </div>
        {/if}

        <!-- User's remaining votes / total allocation -->
        <div class="stat-item">
            <span class="stat-value">
                {userVoteAllocation.remainingVotes} / {userVoteAllocation.maxVotes}
            </span>
            <svg class="vote-icon" viewBox="0 0 512 512">
                <path
                    fill="currentColor"
                    d="M411.8 80.9l22.8-16.7 58 0L477.4 78.3c-47 43.2-105.7 109.9-159 181.1c-27.2 36.3-79.9 114.1-89.4 132.2c-3 5.5-5.7 9.9-6.3 9.9c-.6-.2-6.1-8.4-12.4-18.3c-17.1-26.8-43-62-80.7-109l-33.8-42L109 219c7.4-7.4 14.3-13.5 15.6-13.5c1.1 0 23.4 12.4 49.5 27.4l47.5 27.4 6.3-6.9c3.6-3.8 16.2-18.1 28-31.6c42-47.2 103.7-103.3 155.8-140.8zM62.4 102.6c11.2-4.2 15-4.4 129.7-4.4l118.1-.2-17.9 16.9-17.9 16.6-95.9 .2c-95.3 0-96.2 0-105.4 4.6c-7 3.6-10.8 7.4-14.1 14.3L54 159.9 54 407l4.8 9.3c3.4 6.9 7.2 10.8 14.1 14.3l9.2 4.6 247.1 0 9.3-4.9c6.9-3.4 10.8-7.2 14.3-14.1c4.4-9.1 4.6-11.4 4.6-68.1l0-58.6L374 268.3 390.3 247l.6 83.5c.4 81.2 .4 83.7-4 95.7c-6.3 16.4-21.9 32.1-38.4 38.1c-12 4.7-14.1 4.7-142.8 4.7c-128.6 0-130.7 0-142.8-4.7c-16.2-6.1-32-21.9-38.2-38.1c-4.6-12-4.6-14.1-4.6-142.8s0-130.7 4.6-142.8c5.9-16 22-32.1 37.5-38.2z"
                />
            </svg>

            {#if showAdminControls && onIncreaseAllocation && onResetVotes}
                <div class="admin-actions">
                    <!-- Increase allocation button -->
                    <button
                        class="toolbar-action increase-votes"
                        onclick={handleIncreaseAllocation}
                        disabled={isIncreasing}
                        title="Increase voting allocation by 1"
                    >
                        {#if isIncreasing}
                            <Icon name="loading" size="sm" />
                        {:else}
                            <svg class="vote-arrow-up" viewBox="0 0 12 12">
                                <path
                                    d="M6 3L10 9H2L6 3z"
                                    fill="currentColor"
                                />
                            </svg>
                        {/if}
                    </button>

                    <!-- Reset votes button -->
                    <button
                        class="toolbar-action reset-votes"
                        onclick={handleResetVotes}
                        disabled={isResetting}
                        title="Reset all votes and set allocation to 0"
                    >
                        {#if isResetting}
                            <Icon name="loading" size="sm" />
                        {:else}
                            <Icon name="reset" size="sm" color="danger" />
                        {/if}
                    </button>
                </div>
            {/if}
        </div>
    </div>

    <!-- User Status Modal -->
    <UserStatusModal
        open={showUserStatusModal}
        boardId={board.id}
        blameFreeMode={board.blameFreeMode || false}
        onClose={() => (showUserStatusModal = false)}
    />
</div>

<style lang="less">
    @import "../../app.less";
    .voting-toolbar {
        background-color: var(--surface-secondary);
        border-top: 1px solid var(--surface-tertiary);
        padding: var(--spacing-3) var(--spacing-4);
        font-size: var(--text-sm);
    }

    .voting-toolbar-content {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--spacing-4);
    }

    .stat-item {
        display: flex;
        align-items: center;
        color: var(--text-secondary);
        transition: all 0.2s ease;

        &.clickable {
            background: none;
            border: none;
            cursor: pointer;
            border-radius: var(--radius-md);
            padding: var(--spacing-2);
            margin: calc(var(--spacing-2) * -1);

            &:hover,
            &:focus {
                background-color: var(--surface-primary);
                transform: translateY(-1px);
                outline: 2px solid var(--color-primary);
                outline-offset: 2px;
            }
        }

        .stat-value {
            font-weight: 600;
            color: var(--text-primary);
            margin-right: 0.5rem;
            text-align: center;
        }
    }

    .toolbar-action {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        border: 1px solid lighten(@neutral-gray, 10%);
        border-radius: var(--radius-md);
        background-color: transparent;
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover:not(:disabled) {
            background-color: var(--surface-primary);
            border-color: var(--surface-secondary);
        }

        &:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        &.increase-votes:hover:not(:disabled) {
            background-color: color-mix(
                in srgb,
                var(--color-success) 10%,
                transparent
            );
            border-color: color-mix(
                in srgb,
                var(--color-success) 30%,
                transparent
            );
        }

        &.reset-votes:hover:not(:disabled) {
            background-color: color-mix(
                in srgb,
                var(--color-danger) 10%,
                transparent
            );
            border-color: color-mix(
                in srgb,
                var(--color-danger) 30%,
                transparent
            );
        }
    }

    .admin-actions {
        display: flex;
        align-items: center;
    }

    .vote-icon {
        width: 0.875rem;
        height: 0.875rem;
        color: var(--color-text-muted);
    }

    .vote-arrow-up {
        width: 0.75rem;
        height: 0.75rem;
        color: var(--color-success);
    }

    .users-icon {
        width: 1rem;
        height: 0.75rem;
        color: var(--color-text-muted);
    }

    .votes-icon {
        width: 0.875rem;
        height: 0.875rem;
        color: var(--color-text-muted);
    }
</style>
