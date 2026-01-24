<script lang="ts">
import { onMount } from "svelte";
import { fade, fly } from "svelte/transition";
import { goto } from "$app/navigation";
import UserManagement from "$lib/components/UserManagement.svelte";
import BoardListingItem from "$lib/components/ui/BoardListingItem.svelte";
import DropdownMenu from "$lib/components/ui/DropdownMenu.svelte";
import Icon from "$lib/components/ui/Icon.svelte";
import InputWithButton from "$lib/components/ui/InputWithButton.svelte";
import Pill from "$lib/components/ui/Pill.svelte";
import * as dashboardApi from "$lib/services/dashboard-api";
import { generateBoardName } from "$lib/utils/board-name-generator";
import { seriesIdToShortCode } from "$lib/utils/short-codes";
import { toastStore } from "$lib/stores/toast";

interface Props {
	user: any;
}

let { user }: Props = $props();

let series: any[] = $state([]);
let loading = $state(true);
let newSeriesName = $state("");
let seriesError = $state("");
let creatingNewSeries = $state(false);
let isEmailConfigured = $state(false);

// Computed: Can user create resources (boards/series)?
let canCreateResources = $derived(() => {
	// If email is not configured, everyone can create
	if (!isEmailConfigured) return true;
	// If email is configured, only verified users can create
	return user?.emailVerified === true;
});
let boardNames = $state({} as Record<string, string>);
let boardErrors = $state({} as Record<string, string>);
let creatingBoards = $state({} as Record<string, boolean>);
let showDeleteModal = $state(false);
let seriesToDelete: any = $state(null);
let showUserManagementModal = $state(false);
let seriesToManage: any = $state(null);
let currentSeriesUsers = $state([]);
let cloningBoards = $state({} as Record<string, boolean>);
let collapsedSeries = $state({} as Record<string, boolean>);
let showRenameModal = $state(false);
let seriesToRename: any = $state(null);
let renameSeriesName = $state("");
let renameSeriesError = $state("");
let openDropdownSeriesId: string | null = $state(null);

onMount(async () => {
	try {
		// Check if email is configured
		const configData = await dashboardApi.checkEmailConfig();
		isEmailConfigured = configData.isEmailConfigured;

		// Load series
		const seriesData = await dashboardApi.listSeries();
		series = seriesData.series;

		series.forEach((s) => {
			initializeBoardName(s.id, s.name);
			// Set all series to collapsed by default
			collapsedSeries[s.id] = true;
		});
	} catch (error) {
		console.error("Failed to load dashboard data:", error);
	} finally {
		loading = false;
	}
});

async function createSeries() {
	if (!newSeriesName.trim()) {
		seriesError = "Series name is required";
		return;
	}

	if (newSeriesName.trim().length < 2) {
		seriesError = "Series name must be at least 2 characters";
		return;
	}

	creatingNewSeries = true;
	seriesError = "";

	try {
		const data = await dashboardApi.createSeries(newSeriesName.trim());
		series = [...series, data.series];
		initializeBoardName(data.series.id, data.series.boards.length);
		newSeriesName = "";
	} catch (error) {
		seriesError =
			error instanceof Error ? error.message : "Failed to create series";
	} finally {
		creatingNewSeries = false;
	}
}

function initializeBoardName(seriesId: string, boardCount: number) {
	if (!boardNames[seriesId]) {
		const currentDate = new Date().toISOString().split("T")[0];
		boardNames = {
			...boardNames,
			[seriesId]: generateBoardName(`${seriesId} ${boardCount} ${currentDate}`),
		};
	}
}

async function createBoard(seriesId: string) {
	const boardName = boardNames[seriesId]?.trim();

	if (!boardName) {
		boardErrors[seriesId] = "Board name is required";
		return;
	}

	if (boardName.length < 2) {
		boardErrors[seriesId] = "Board name must be at least 2 characters";
		return;
	}

	creatingBoards[seriesId] = true;
	boardErrors[seriesId] = "";

	try {
		const data = await dashboardApi.createBoard(boardName, seriesId);
		goto(`/board/${data.board.id}`);
	} catch (error) {
		boardErrors[seriesId] =
			error instanceof Error ? error.message : "Failed to create board";
	} finally {
		creatingBoards[seriesId] = false;
	}
}

function confirmDeleteSeries(seriesItem: any) {
	seriesToDelete = seriesItem;
	showDeleteModal = true;
}

function cancelDelete() {
	showDeleteModal = false;
	seriesToDelete = null;
}

async function deleteSeries() {
	if (!seriesToDelete) return;

	try {
		await dashboardApi.deleteSeries(seriesToDelete.id);
		series = series.filter((s) => s.id !== seriesToDelete.id);
		showDeleteModal = false;
		seriesToDelete = null;
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Failed to delete series";
		alert(errorMessage);
		console.error("Series deletion error:", error);
	}
}

async function openSeriesUserManagement(seriesItem: any) {
	seriesToManage = seriesItem;
	showUserManagementModal = true;

	try {
		const data = await dashboardApi.listSeriesUsers(seriesItem.id);
		currentSeriesUsers = data.users;
	} catch (error) {
		console.error("Failed to load users:", error);
	}
}

function closeUserManagementModal() {
	showUserManagementModal = false;
	seriesToManage = null;
	currentSeriesUsers = [];
}

async function handleUserAdded(email: string) {
	await dashboardApi.addSeriesUser(seriesToManage.id, email, "member");
	const data = await dashboardApi.listSeriesUsers(seriesToManage.id);
	currentSeriesUsers = data.users;
}

async function handleUserRemoved(userId: string) {
	try {
		await dashboardApi.removeSeriesUser(seriesToManage.id, userId);
		currentSeriesUsers = currentSeriesUsers.filter((u) => u.userId !== userId);
	} catch (error) {
		console.error("Failed to remove user:", error);
	}
}

async function handleUserRoleChanged(userId: string, newRole: string) {
	try {
		await dashboardApi.updateSeriesUserRole(seriesToManage.id, userId, newRole);
		currentSeriesUsers = currentSeriesUsers.map((u) =>
			u.userId === userId ? { ...u, role: newRole } : u,
		);
	} catch (error) {
		console.error("Failed to update user role:", error);
	}
}

async function cloneBoard(sourceBoard: any, seriesId: string) {
	const boardName = boardNames[seriesId]?.trim();

	if (!boardName) {
		boardErrors[seriesId] = "Board name is required";
		return;
	}

	if (boardName.length < 2) {
		boardErrors[seriesId] = "Board name must be at least 2 characters";
		return;
	}

	cloningBoards[sourceBoard.id] = true;
	boardErrors[seriesId] = "";

	try {
		const newBoardId = await dashboardApi.createAndCloneBoard(
			boardName,
			seriesId,
			sourceBoard.id,
		);
		goto(`/board/${newBoardId}`);
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Failed to clone board";
		alert(errorMessage);
	} finally {
		cloningBoards[sourceBoard.id] = false;
	}
}

function toggleSeriesCollapse(seriesId: string) {
	collapsedSeries[seriesId] = !collapsedSeries[seriesId];
}

function getLatestBoardForCollapsed(seriesItem: any) {
	if (!seriesItem.boards || seriesItem.boards.length === 0) {
		return null;
	}

	// Use server-computed current board ID (soonest upcoming active) if available
	if (seriesItem.currentBoardId) {
		const currentBoard = seriesItem.boards.find(
			(b: any) => b.id === seriesItem.currentBoardId
		);
		if (currentBoard) return currentBoard;
	}

	// Fallback: find soonest upcoming active board
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const activeBoards = seriesItem.boards.filter((b: any) => b.status === "active");

	// Find soonest upcoming active board
	const upcomingActive = activeBoards
		.filter((b: any) => {
			const boardDate = b.meetingDate ? new Date(b.meetingDate) : new Date(b.createdAt);
			boardDate.setHours(0, 0, 0, 0);
			return boardDate >= today;
		})
		.sort((a: any, b: any) => {
			const aDate = a.meetingDate ? new Date(a.meetingDate) : new Date(a.createdAt);
			const bDate = b.meetingDate ? new Date(b.meetingDate) : new Date(b.createdAt);
			return aDate.getTime() - bDate.getTime(); // Ascending - soonest first
		});

	if (upcomingActive.length > 0) {
		return upcomingActive[0];
	}

	// No upcoming active board - show most recently completed instead
	const completedBoards = seriesItem.boards
		.filter((b: any) => b.status === "completed")
		.sort((a: any, b: any) => {
			const aDate = a.meetingDate ? new Date(a.meetingDate) : new Date(a.createdAt);
			const bDate = b.meetingDate ? new Date(b.meetingDate) : new Date(b.createdAt);
			return bDate.getTime() - aDate.getTime(); // Descending - most recent first
		});

	return completedBoards.length > 0 ? completedBoards[0] : null;
}

function getNextDraftBoardForCollapsed(seriesItem: any, primaryBoard: any) {
	// Only for admin/facilitator users
	if (!["admin", "facilitator"].includes(seriesItem.role)) return null;

	// Use server-computed next draft board ID if available
	if (seriesItem.nextDraftBoardId) {
		const draftBoard = seriesItem.boards.find(
			(b: any) => b.id === seriesItem.nextDraftBoardId
		);
		// Don't show if it's the same as the primary board
		if (draftBoard && draftBoard.id !== primaryBoard?.id) {
			return draftBoard;
		}
	}

	// Fallback: find soonest upcoming draft board
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const upcomingDrafts = seriesItem.boards
		.filter((b: any) => {
			if (b.status !== "draft") return false;
			if (b.id === primaryBoard?.id) return false; // Don't duplicate primary
			const boardDate = b.meetingDate ? new Date(b.meetingDate) : new Date(b.createdAt);
			boardDate.setHours(0, 0, 0, 0);
			return boardDate >= today;
		})
		.sort((a: any, b: any) => {
			const aDate = a.meetingDate ? new Date(a.meetingDate) : new Date(a.createdAt);
			const bDate = b.meetingDate ? new Date(b.meetingDate) : new Date(b.createdAt);
			return aDate.getTime() - bDate.getTime(); // Ascending - soonest first
		});

	return upcomingDrafts.length > 0 ? upcomingDrafts[0] : null;
}

function openRenameSeries(seriesItem: any) {
	seriesToRename = seriesItem;
	renameSeriesName = seriesItem.name;
	renameSeriesError = "";
	showRenameModal = true;
}

function splitAndSortBoardsByDate(boards: any[]) {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const upcoming: any[] = [];
	const past: any[] = [];

	boards.forEach((board) => {
		const boardDate = board.meetingDate
			? new Date(board.meetingDate)
			: new Date(board.createdAt);
		boardDate.setHours(0, 0, 0, 0);

		if (boardDate >= today) {
			upcoming.push(board);
		} else {
			past.push(board);
		}
	});

	// Sort upcoming boards in ascending order (earliest first)
	upcoming.sort((a, b) => {
		const aDate = a.meetingDate ? new Date(a.meetingDate) : new Date(a.createdAt);
		const bDate = b.meetingDate ? new Date(b.meetingDate) : new Date(b.createdAt);
		return aDate.getTime() - bDate.getTime();
	});

	// Sort past boards in descending order (most recent first)
	past.sort((a, b) => {
		const aDate = a.meetingDate ? new Date(a.meetingDate) : new Date(a.createdAt);
		const bDate = b.meetingDate ? new Date(b.meetingDate) : new Date(b.createdAt);
		return bDate.getTime() - aDate.getTime();
	});

	return { upcoming, past };
}

function closeRenameModal() {
	showRenameModal = false;
	seriesToRename = null;
	renameSeriesName = "";
	renameSeriesError = "";
}

async function renameSeries() {
	if (!seriesToRename) return;

	if (!renameSeriesName.trim()) {
		renameSeriesError = "Series name is required";
		return;
	}

	if (renameSeriesName.trim().length < 2) {
		renameSeriesError = "Series name must be at least 2 characters";
		return;
	}

	try {
		await dashboardApi.renameSeries(seriesToRename.id, renameSeriesName.trim());
		series = series.map((s) =>
			s.id === seriesToRename.id ? { ...s, name: renameSeriesName.trim() } : s,
		);
		closeRenameModal();
	} catch (error) {
		renameSeriesError =
			error instanceof Error ? error.message : "Failed to rename series";
	}
}

async function copySeriesLink(seriesId: string) {
	const shortCode = seriesIdToShortCode(seriesId);
	const url = `${window.location.origin}/b/${shortCode}`;

	try {
		await navigator.clipboard.writeText(url);
		toastStore.success("Series link copied to clipboard");
	} catch {
		toastStore.error("Failed to copy link to clipboard");
	}
}
</script>

{#if loading}
    <div class="loading-page">
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <p class="loading-text">Loading TeamBeat...</p>
        </div>
    </div>
{:else}
    <div class="dashboard-container">
        <!-- Dashboard Header -->
        <div class="dashboard-header">
            <div class="header-content">
                <div>
                    <h1 class="dashboard-title">
                        Welcome back{user?.name ? `, ${user.name}` : ""}!
                    </h1>
                    <p class="dashboard-subtitle">
                        Ready to run an amazing team meeting?
                    </p>
                </div>
                <div class="add-series-form">
                    <InputWithButton
                        id="newSeriesInput"
                        type="text"
                        bind:value={newSeriesName}
                        placeholder={canCreateResources() ? "Enter series name..." : "Verify your email to create series"}
                        buttonVariant="primary"
                        buttonDisabled={creatingNewSeries ||
                            !newSeriesName.trim() ||
                            !canCreateResources()}
                        onButtonClick={createSeries}
                        onkeydown={(e) => {
                            if (e.key === "Enter") createSeries();
                        }}
                        class="series-input-with-button"
                        buttonClass="cooltipz--bottom"
                        buttonAriaLabel={canCreateResources() ? "Add series" : "Email verification required"}
                        disabled={!canCreateResources()}
                    >
                        {#snippet buttonContent()}
                            {#if creatingNewSeries}
                                Creating...
                            {:else}
                                <Icon name="plus" size="sm" />
                            {/if}
                        {/snippet}
                    </InputWithButton>
                </div>
            </div>
            {#if seriesError}
                <div class="form-error">
                    <svg
                        class="icon-sm status-text-danger"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >
                        <path
                            fill-rule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clip-rule="evenodd"
                        />
                    </svg>
                    <span>{seriesError}</span>
                </div>
            {/if}
        </div>

        <!-- Board Series -->
        <div class="all-series-section">
            <h2 class="section-title">Your Series</h2>
            {#if series.length === 0}
                <div class="empty-state">
                    <p class="empty-state-text">
                        No series yet. Create your first one to get started!
                    </p>
                    {#if !canCreateResources()}
                        <div class="verification-required-message">
                            <Icon name="alert" size="sm" />
                            <p>
                                Please verify your email address to create series and boards.
                                <a href="/profile">Go to profile</a> to resend verification email.
                            </p>
                        </div>
                    {:else}
                        <div class="space-y-4">
                            <div class="flex items-center space-x-2 justify-center">
                                <InputWithButton
                                    type="text"
                                    bind:value={newSeriesName}
                                    placeholder="Enter series name..."
                                    buttonVariant="primary"
                                    buttonDisabled={creatingNewSeries ||
                                        !newSeriesName.trim()}
                                    onButtonClick={createSeries}
                                    onkeydown={(e) => {
                                        if (e.key === "Enter") createSeries();
                                    }}
                                    class="min-w-64"
                                >
                                    {#snippet buttonContent()}
                                        {#if creatingNewSeries}
                                            Creating...
                                        {:else}
                                            <Icon name="plus" size="sm" />
                                        {/if}
                                    {/snippet}
                                </InputWithButton>
                            </div>
                            {#if seriesError}
                                <div
                                    class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center space-x-2"
                                >
                                    <svg
                                        class="w-5 h-5 text-red-500"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                    >
                                        <path
                                            fill-rule="evenodd"
                                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                            clip-rule="evenodd"
                                        />
                                    </svg>
                                    <span>{seriesError}</span>
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>
            {:else}
                <div class="series-grid">
                    {#each series as s (s.id)}
                        <div
                            class="series-card"
                            class:collapsed={collapsedSeries[s.id]}
                            class:has-open-dropdown={openDropdownSeriesId === s.id}
                        >
                            <div class="card-content">
                                <div class="series-card-header">
                                    <div class="series-card-info">
                                        <div class="series-card-title-row">
                                            <h3 class="card-title">
                                                {s.name}
                                            </h3>
                                            <Pill preset={s.role}>{s.role}</Pill
                                            >
                                        </div>
                                        {#if s.description && !collapsedSeries[s.id]}
                                            <p
                                                class="text-sm text-muted line-clamp-2"
                                            >
                                                {s.description}
                                            </p>
                                        {/if}
                                    </div>
                                    <div class="series-card-actions">
                                        <button
                                            onclick={() =>
                                                toggleSeriesCollapse(s.id)}
                                            class="collapse-toggle-icon"
                                            class:expanded={!collapsedSeries[
                                                s.id
                                            ]}
                                            aria-label={collapsedSeries[s.id]
                                                ? "Expand series"
                                                : "Collapse series"}
                                            aria-expanded={!collapsedSeries[
                                                s.id
                                            ]}
                                        >
                                            <Icon
                                                name="chevron-down"
                                                size="sm"
                                            />
                                        </button>
                                        {#if s.role === "admin"}
                                            <DropdownMenu
                                                buttonIcon="ellipsis-vertical"
                                                buttonClass="icon-button icon-button-secondary cooltipz--bottom"
                                                onOpenChange={(isOpen) => {
                                                    openDropdownSeriesId = isOpen ? s.id : null;
                                                }}
                                            >
                                                <button
                                                    onclick={() => copySeriesLink(s.id)}
                                                    class="dropdown-menu-item"
                                                    role="menuitem"
                                                >
                                                    <Icon
                                                        name="share"
                                                        size="sm"
                                                    />
                                                    Copy Link
                                                </button>
                                                <button
                                                    onclick={() =>
                                                        openRenameSeries(s)}
                                                    class="dropdown-menu-item"
                                                    role="menuitem"
                                                >
                                                    <Icon
                                                        name="edit"
                                                        size="sm"
                                                    />
                                                    Rename Series
                                                </button>
                                                <button
                                                    onclick={() =>
                                                        openSeriesUserManagement(
                                                            s,
                                                        )}
                                                    class="dropdown-menu-item"
                                                    role="menuitem"
                                                >
                                                    <Icon
                                                        name="users-cog"
                                                        size="sm"
                                                    />
                                                    Manage Users
                                                </button>
                                                <a
                                                    href="/series/{s.id}/scorecards"
                                                    class="dropdown-menu-item"
                                                    role="menuitem"
                                                >
                                                    <Icon
                                                        name="scorecard"
                                                        size="sm"
                                                    />
                                                    Scorecards
                                                </a>
                                                <div
                                                    class="dropdown-menu-separator"
                                                ></div>
                                                <button
                                                    onclick={() =>
                                                        confirmDeleteSeries(s)}
                                                    class="dropdown-menu-item danger"
                                                    role="menuitem"
                                                >
                                                    <Icon
                                                        name="trash"
                                                        size="sm"
                                                    />
                                                    Delete Series
                                                </button>
                                            </DropdownMenu>
                                        {/if}
                                    </div>
                                </div>

                                {#if collapsedSeries[s.id]}
                                    <!-- Collapsed view - show current board + next draft for admins -->
                                    {@const latestBoard = getLatestBoardForCollapsed(s)}
                                    {@const draftBoard = getNextDraftBoardForCollapsed(s, latestBoard)}
                                    <div class="collapsed-board-preview">
                                        {#if latestBoard}
                                            <BoardListingItem
                                                name={latestBoard.name}
                                                meetingDate={latestBoard.meetingDate}
                                                createdAt={latestBoard.createdAt}
                                                status={latestBoard.status}
                                                onclick={() => goto(`/board/${latestBoard.id}`)}
                                            >
                                                {#snippet actions()}
                                                    {#if latestBoard.status === 'completed' && (s.role === 'admin' || s.role === 'facilitator')}
                                                        <button
                                                            class="icon-button icon-button-secondary cooltipz--bottom"
                                                            aria-label="Clone board"
                                                            onclick={(e) => {
                                                                e.stopPropagation();
                                                                cloneBoard(latestBoard, s.id);
                                                            }}
                                                            disabled={cloningBoards[latestBoard.id]}
                                                        >
                                                            {#if cloningBoards[latestBoard.id]}
                                                                <Icon name="spinner" size="sm" />
                                                            {:else}
                                                                <Icon name="clone" size="sm" />
                                                            {/if}
                                                        </button>
                                                    {/if}
                                                {/snippet}
                                            </BoardListingItem>
                                        {/if}
                                        {#if draftBoard}
                                            <div class="draft-board-secondary">
                                                <BoardListingItem
                                                    name={draftBoard.name}
                                                    meetingDate={draftBoard.meetingDate}
                                                    createdAt={draftBoard.createdAt}
                                                    status={draftBoard.status}
                                                    onclick={() => goto(`/board/${draftBoard.id}`)}
                                                />
                                            </div>
                                        {/if}
                                        {#if !latestBoard && !draftBoard}
                                            <div class="no-boards-message">
                                                There are no active boards in this series.
                                            </div>
                                        {/if}
                                    </div>
                                {:else}
                                    <!-- Expanded view - show all boards and create new board form -->
                                    {@const activeDraftBoards = s.boards ? s.boards.filter((b: any) => ["active", "draft"].includes(b.status)) : []}
                                    {@const { upcoming, past } = splitAndSortBoardsByDate(activeDraftBoards)}
                                    <!-- Create New Board -->
                                    {#if !canCreateResources()}
                                        <div class="verification-required-message">
                                            <Icon name="alert" size="sm" />
                                            <p>
                                                Please verify your email address to create boards.
                                                <a href="/profile">Go to profile</a> to resend verification email.
                                            </p>
                                        </div>
                                    {:else}
                                        <InputWithButton
                                            type="text"
                                            bind:value={boardNames[s.id]}
                                            placeholder="Board name..."
                                            buttonVariant="primary"
                                            buttonDisabled={creatingBoards[s.id] ||
                                                !boardNames[s.id]?.trim()}
                                            onButtonClick={() =>
                                                createBoard(s.id, s.name)}
                                            onkeydown={(e) => {
                                                if (e.key === "Enter")
                                                    createBoard(s.id, s.name);
                                            }}
                                            class="board-input-with-button"
                                            buttonClass="cooltipz--bottom"
                                            buttonAriaLabel="Add board"
                                        >
                                            {#snippet buttonContent()}
                                                {#if creatingBoards[s.id]}
                                                    ...
                                                {:else}
                                                    <Icon name="plus" size="sm" />
                                                {/if}
                                            {/snippet}
                                        </InputWithButton>
                                    {/if}
                                    {#if boardErrors[s.id]}
                                        <div class="alert alert-error">
                                            <svg
                                                class="w-4 h-4"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fill-rule="evenodd"
                                                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                                    clip-rule="evenodd"
                                                />
                                            </svg>
                                            <span>{boardErrors[s.id]}</span>
                                        </div>
                                    {/if}

                                    <div class="space-y-3">
                                        <!-- Active and Draft Boards -->
                                        {#if activeDraftBoards.length > 0}
                                            <div class="board-section">
                                                <h4 class="board-section-title">
                                                    Active & Draft Boards:
                                                </h4>
                                                <div class="board-list">
                                                    {#if upcoming.length > 0}
                                                        <div class="board-date-group">
                                                            <span class="board-date-group-label">Upcoming</span>
                                                            {#each upcoming as board (board.id)}
                                                                <BoardListingItem
                                                                    name={board.name}
                                                                    meetingDate={board.meetingDate}
                                                                    createdAt={board.createdAt}
                                                                    status={board.status}
                                                                    onclick={() =>
                                                                        goto(
                                                                            `/board/${board.id}`,
                                                                        )}
                                                                />
                                                            {/each}
                                                        </div>
                                                    {/if}
                                                    {#if past.length > 0}
                                                        <div class="board-date-group">
                                                            <span class="board-date-group-label">Past</span>
                                                            {#each past as board (board.id)}
                                                                <BoardListingItem
                                                                    name={board.name}
                                                                    meetingDate={board.meetingDate}
                                                                    createdAt={board.createdAt}
                                                                    status={board.status}
                                                                    onclick={() =>
                                                                        goto(
                                                                            `/board/${board.id}`,
                                                                        )}
                                                                />
                                                            {/each}
                                                        </div>
                                                    {/if}
                                                </div>
                                            </div>
                                        {:else}
                                            <div class="alert">
                                                <p class="text-sm text-muted">
                                                    No active or draft boards
                                                    for this series
                                                </p>
                                            </div>
                                        {/if}

                                        <!-- Completed Boards -->
                                        {#if s.boards && s.boards.filter((b) => b.status === "completed").length > 0}
                                            <div
                                                class="board-section completed-boards-section"
                                            >
                                                <h4 class="board-section-title">
                                                    Completed Boards:
                                                </h4>
                                                <div class="board-list">
                                                    {#each s.boards
                                                        .filter((b) => b.status === "completed")
                                                        .slice(0, 5) as board (board.id)}
                                                        <BoardListingItem
                                                            name={board.name}
                                                            meetingDate={board.meetingDate}
                                                            createdAt={board.createdAt}
                                                            status="complete"
                                                            onclick={() =>
                                                                goto(
                                                                    `/board/${board.id}`,
                                                                )}
                                                        >
                                                            {#snippet actions()}
                                                                <button
                                                                    class="icon-button icon-button-secondary cooltipz--bottom"
                                                                    aria-label="Clone board"
                                                                    onclick={(
                                                                        e,
                                                                    ) => {
                                                                        e.stopPropagation();
                                                                        cloneBoard(
                                                                            board,
                                                                            s.id,
                                                                        );
                                                                    }}
                                                                    disabled={cloningBoards[
                                                                        board.id
                                                                    ]}
                                                                >
                                                                    {#if cloningBoards[board.id]}
                                                                        <Icon
                                                                            name="spinner"
                                                                            size="sm"
                                                                        />
                                                                    {:else}
                                                                        <Icon
                                                                            name="clone"
                                                                            size="sm"
                                                                        />
                                                                    {/if}
                                                                </button>
                                                            {/snippet}
                                                        </BoardListingItem>
                                                    {/each}
                                                </div>
                                            </div>
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
{/if}

<!-- Delete Series Confirmation Modal -->
{#if showDeleteModal && seriesToDelete}
    <div
        class="modal-overlay"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        onclick={cancelDelete}
        onkeydown={(e) => e.key === "Escape" && cancelDelete()}
    >
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
            class="modal-dialog"
            role="document"
            onclick={(e) => e.stopPropagation()}
        >
            <div class="modal-content">
                <div class="flex items-center gap-3 mb-4">
                    <div class="warning-icon">
                        <Icon name="warning" size="md" color="danger" circle />
                    </div>
                    <div>
                        <h3 class="modal-title">Delete Series</h3>
                        <p class="modal-subtitle">
                            This action cannot be undone
                        </p>
                    </div>
                </div>

                <div class="mb-6">
                    <p class="text-muted mb-4">
                        Are you sure you want to delete <strong
                            >"{seriesToDelete.name}"</strong
                        >?
                    </p>
                    <div class="warning-section">
                        <div class="flex gap-3">
                            <Icon
                                name="warning"
                                size="sm"
                                color="danger"
                                class="flex-shrink-0 mt-0.5"
                            />
                            <div>
                                <p
                                    class="text-sm font-medium status-text-danger mb-2"
                                >
                                    This will permanently delete:
                                </p>
                                <ul
                                    class="text-sm status-text-danger space-y-1"
                                >
                                    <li>All boards in this series</li>
                                    <li>All cards, votes, and comments</li>
                                    <li>All series member access</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-actions">
                    <button onclick={cancelDelete} class="btn-secondary">
                        Cancel
                    </button>
                    <button onclick={deleteSeries} class="btn-danger">
                        Delete Series
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}

<!-- User Management Modal -->
{#if showUserManagementModal && seriesToManage}
    <div
        class="modal-overlay"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        onclick={closeUserManagementModal}
        onkeydown={(e) => e.key === "Escape" && closeUserManagementModal()}
        transition:fade={{ duration: 300 }}
    >
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
            class="modal-dialog-large"
            role="document"
            onclick={(e) => e.stopPropagation()}
        >
            <!-- Header -->
            <div class="modal-header">
                <div>
                    <h2 class="modal-title">Manage Users</h2>
                    <p class="modal-subtitle">Series: {seriesToManage.name}</p>
                </div>
                <button
                    onclick={closeUserManagementModal}
                    class="close-button"
                    aria-label="Close user management"
                >
                    <Icon name="close" size="md" />
                </button>
            </div>

            <!-- Content -->
            <div class="modal-content">
                <UserManagement
                    seriesId={seriesToManage.id}
                    currentUserRole="admin"
                    bind:users={currentSeriesUsers}
                    onUserAdded={handleUserAdded}
                    onUserRemoved={handleUserRemoved}
                    onUserRoleChanged={handleUserRoleChanged}
                />
            </div>
        </div>
    </div>
{/if}

<!-- Rename Series Modal -->
{#if showRenameModal && seriesToRename}
    <div
        class="modal-overlay"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        onclick={closeRenameModal}
        onkeydown={(e) => e.key === "Escape" && closeRenameModal()}
        transition:fade={{ duration: 300 }}
    >
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
            class="modal-dialog"
            role="document"
            onclick={(e) => e.stopPropagation()}
        >
            <div class="modal-content">
                <div class="flex items-center gap-3 mb-4">
                    <div class="info-icon">
                        <Icon name="edit" size="md" color="primary" circle />
                    </div>
                    <div>
                        <h3 class="modal-title">Rename Series</h3>
                        <p class="modal-subtitle">Update the series name</p>
                    </div>
                </div>

                <div class="mb-6">
                    <label for="renameSeriesInput" class="form-label">
                        Series Name
                    </label>
                    <input
                        id="renameSeriesInput"
                        type="text"
                        bind:value={renameSeriesName}
                        placeholder="Enter series name..."
                        class="form-input"
                        onkeydown={(e) => {
                            if (e.key === "Enter") renameSeries();
                        }}
                        autofocus
                    />
                    {#if renameSeriesError}
                        <div class="form-error">
                            <Icon name="warning" size="sm" color="danger" />
                            <span>{renameSeriesError}</span>
                        </div>
                    {/if}
                </div>

                <div class="modal-actions">
                    <button onclick={closeRenameModal} class="btn-secondary">
                        Cancel
                    </button>
                    <button
                        onclick={renameSeries}
                        class="btn-primary"
                        disabled={!renameSeriesName.trim()}
                    >
                        Rename Series
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}

<style lang="less">
    .loading-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--color-bg-primary);
    }

    .loading-content {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-4);
    }

    .loading-spinner {
        width: 3rem;
        height: 3rem;
        border: 4px solid var(--input-border);
        border-top: 4px solid var(--color-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }

    .loading-text {
        color: var(--color-text-primary);
        font-weight: 500;
        font-size: 1rem;
        margin: 0;
    }

    /* Dashboard Container - Main layout with proper overflow */
    .dashboard-container {
        width: 100%;
        max-width: 80rem;
        margin: 0 auto;
        padding: var(--spacing-4);
        display: flex;
        flex-direction: column;
        gap: var(--spacing-6);
        height: 100%;
        overflow-y: auto;
        overflow-x: hidden; /* Prevent horizontal scroll */
        box-sizing: border-box;

        @media (min-width: 768px) {
            padding: var(--spacing-6);
            gap: var(--spacing-8);
        }

        @media (min-width: 1024px) {
            padding: var(--spacing-8);
        }

        /* Ensure all children respect box-sizing */
        * {
            box-sizing: border-box;
        }
    }

    /* Dashboard Header - Professional gradient background using brand colors */
    .dashboard-header {
        background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--color-primary) 5%, white),
            color-mix(in srgb, var(--color-secondary) 5%, white)
        );
        border: 1px solid var(--color-border);
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-sm);
        padding: var(--spacing-6);
        transition: box-shadow var(--transition-fast);

        &:hover {
            box-shadow: var(--shadow-md);
        }

        @media (min-width: 768px) {
            padding: var(--spacing-8);
        }
    }

    .header-content {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-4);
        justify-content: space-between;
        align-items: flex-start;

        @media (min-width: 768px) {
            flex-direction: row;
            align-items: center;
            gap: var(--spacing-6);
        }
    }

    /* Dashboard Title - Gradient text using brand colors */
    .dashboard-title {
        font-size: clamp(1.5rem, 4vw, 2rem);
        font-weight: 700;
        margin: 0;
        background: linear-gradient(
            135deg,
            var(--color-primary),
            var(--color-secondary)
        );
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        line-height: 1.2;
    }

    .dashboard-subtitle {
        color: var(--color-text-secondary);
        margin: var(--spacing-2) 0 0 0;
        font-size: clamp(0.875rem, 2vw, 1rem);
        font-weight: 500;
    }

    .add-series-form {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        width: 100%;
        max-width: 100%; /* Prevent overflow */

        @media (min-width: 768px) {
            width: auto;
            min-width: 280px;
            max-width: 400px;
        }
    }

    /* All Series Section */
    .all-series-section {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-4);
    }

    .section-title {
        font-size: clamp(1.125rem, 3vw, 1.5rem);
        font-weight: 700;
        color: var(--color-text-primary);
        margin: 0;
        padding-bottom: var(--spacing-2);
        border-bottom: 2px solid
            color-mix(in srgb, var(--color-primary) 20%, transparent);
    }

    /* Empty State - Enhanced visual design */
    .empty-state {
        text-align: center;
        padding: var(--spacing-12) var(--spacing-6);
        background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--color-primary) 3%, white),
            color-mix(in srgb, var(--color-secondary) 3%, white)
        );
        border-radius: var(--radius-xl);
        border: 2px dashed var(--color-border);
        transition: all var(--transition-fast);

        &:hover {
            border-color: var(--color-border-hover);
            box-shadow: var(--shadow-sm);
        }
    }

    .empty-state-text {
        color: var(--color-text-secondary);
        margin: 0 0 var(--spacing-6) 0;
        font-size: 1rem;
        font-weight: 500;
    }

    .verification-required-message {
        display: flex;
        align-items: flex-start;
        gap: var(--spacing-3);
        padding: var(--spacing-4);
        background: var(--color-warning-bg);
        border: 1px solid color-mix(in srgb, var(--color-warning) 20%, transparent);
        border-radius: var(--radius-lg);
        color: var(--color-text-primary);
        font-size: 0.875rem;
        margin: var(--spacing-4) 0;

        :global(svg) {
            flex-shrink: 0;
            color: var(--color-warning);
            margin-top: 2px;
        }

        p {
            margin: 0;
            line-height: 1.5;
        }

        a {
            color: var(--color-primary);
            font-weight: 600;
            text-decoration: underline;
            transition: color var(--transition-fast);

            &:hover {
                color: var(--color-secondary);
            }
        }
    }

    /* Series Grid - CSS Grid layout for proper horizontal then vertical tiling */
    .series-grid {
        display: grid;
        gap: var(--spacing-6);
        grid-template-columns: 1fr;
        position: relative;
        isolation: isolate;

        /* Two columns on desktop */
        @media (min-width: 1024px) {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    /* Series Card - Enhanced visual hierarchy */
    .series-card {
        background: white;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-sm);
        padding: var(--spacing-6);
        transition: all var(--transition-fast);
        position: relative;
        overflow: visible;
        display: flex;
        flex-direction: column;

        /* Subtle left border accent */
        &::before {
            content: "";
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 4px;
            background: linear-gradient(
                180deg,
                var(--color-accent),
                var(--color-secondary)
            );
            opacity: 0;
            transition: opacity var(--transition-fast);
        }

        &:hover {
            box-shadow: var(--shadow-md);
            transform: translateY(-2px);
            border-color: var(--color-primary);

            &::before {
                opacity: 1;
            }
        }

        &.collapsed {
            padding: var(--spacing-4) var(--spacing-6);
        }

        &.has-open-dropdown {
            z-index: 10002;
        }
    }

    .series-card-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: var(--spacing-4);
        margin-bottom: var(--spacing-4);
        position: relative;
        z-index: 1;
    }

    .series-card-info {
        flex: 1;
        min-width: 0; /* Allow flex item to shrink */
        overflow: hidden; /* Contain long text */
    }

    .series-card-title-row {
        display: flex;
        align-items: center;
        gap: var(--spacing-3);
        margin-bottom: var(--spacing-2);
        flex-wrap: wrap;
    }

    .card-title {
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--color-text-primary);
        margin: 0;
        line-height: 1.4;
        overflow-wrap: break-word; /* Break long words */
        word-wrap: break-word;
    }

    .card-content {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-4);
    }

    .series-card-actions {
        display: flex;
        gap: var(--spacing-2);
        flex-shrink: 0;
        flex-wrap: wrap;

        @media (max-width: 767px) {
            width: 100%;
            justify-content: flex-end;
        }
    }

    /* Collapse Toggle Button - Icon Only */
    .collapse-toggle-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--spacing-2);
        background: color-mix(in srgb, var(--color-primary) 5%, transparent);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        color: var(--color-text-secondary);
        cursor: pointer;
        transition: all var(--transition-fast);
        min-width: 44px;
        min-height: 44px;

        :global(svg) {
            transition: transform var(--transition-fast);
        }

        &.expanded :global(svg) {
            transform: rotate(180deg);
        }

        &:hover {
            background: color-mix(
                in srgb,
                var(--color-primary) 10%,
                transparent
            );
            border-color: var(--color-primary);
            color: var(--color-primary);
        }

        &:focus {
            outline: none;
            box-shadow: 0 0 0 3px
                color-mix(in srgb, var(--color-primary) 15%, transparent);
        }
    }

    /* Collapsed Board Preview */
    .collapsed-board-preview {
        padding-top: var(--spacing-3);
    }

    .draft-board-secondary {
        margin-top: var(--spacing-2);
        opacity: 0.8;
        border-left: 3px solid var(--color-warning);
        padding-left: var(--spacing-2);
    }

    .no-boards-message {
        padding: var(--spacing-4);
        text-align: center;
        color: var(--color-text-secondary);
        font-size: 0.875rem;
        font-style: italic;
        background: color-mix(in srgb, var(--color-primary) 2%, white);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
    }

    /* Board Section */
    .board-section {
        background: color-mix(in srgb, var(--color-primary) 2%, white);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: var(--spacing-4);
        transition: all var(--transition-fast);

        &:hover {
            background: color-mix(in srgb, var(--color-primary) 4%, white);
        }
    }

    .board-section-title {
        font-size: 0.875rem;
        font-weight: 600;
        margin: 0 0 var(--spacing-3) 0;
        color: var(--color-text-primary);
        text-transform: uppercase;
        letter-spacing: 0.025em;
    }

    .board-list {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-2);
    }

    .board-date-group {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-2);
    }

    .board-date-group-label {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: var(--spacing-2) 0 var(--spacing-1) 0;
        border-bottom: 1px solid var(--color-border);
        margin-bottom: var(--spacing-1);
    }

    /* Alert Styles - Replace Tailwind classes */
    .alert {
        padding: var(--spacing-3) var(--spacing-4);
        border-radius: var(--radius-lg);
        font-size: 0.875rem;
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        background: color-mix(in srgb, var(--color-primary) 3%, white);
        border: 1px solid var(--color-border);
        color: var(--color-text-secondary);

        p {
            margin: 0;
        }
    }

    .alert-error {
        background: var(--status-error-bg);
        border-color: color-mix(in srgb, var(--color-danger) 20%, transparent);
        color: var(--status-error-text);

        svg {
            color: var(--color-danger);
        }
    }

    /* Form Error - Consistent styling */
    .form-error {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        padding: var(--spacing-3) var(--spacing-4);
        background: var(--status-error-bg);
        border: 1px solid
            color-mix(in srgb, var(--color-danger) 20%, transparent);
        border-radius: var(--radius-lg);
        color: var(--status-error-text);
        font-size: 0.875rem;
        margin-top: var(--spacing-3);

        svg {
            flex-shrink: 0;
            color: var(--color-danger);
        }

        span {
            line-height: 1.4;
        }
    }

    /* Warning Icon */
    .warning-icon {
        width: 2.5rem;
        height: 2.5rem;
        background: color-mix(in srgb, var(--color-danger) 10%, transparent);
        border: 2px solid
            color-mix(in srgb, var(--color-danger) 20%, transparent);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    /* Info Icon */
    .info-icon {
        width: 2.5rem;
        height: 2.5rem;
        background: color-mix(in srgb, var(--color-primary) 10%, transparent);
        border: 2px solid
            color-mix(in srgb, var(--color-primary) 20%, transparent);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    /* Form Elements */
    .form-label {
        display: block;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--color-text-primary);
        margin-bottom: var(--spacing-2);
    }

    .form-input {
        width: 100%;
        padding: var(--spacing-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        font-size: 1rem;
        color: var(--color-text-primary);
        background: var(--color-bg-primary);
        transition: all var(--transition-fast);

        &:focus {
            outline: none;
            border-color: var(--color-primary);
            box-shadow: 0 0 0 3px
                color-mix(in srgb, var(--color-primary) 15%, transparent);
        }

        &::placeholder {
            color: var(--color-text-tertiary);
        }
    }

    /* Warning Section */
    .warning-section {
        background: var(--status-error-bg);
        border: 1px solid
            color-mix(in srgb, var(--color-danger) 20%, transparent);
        border-radius: var(--radius-lg);
        padding: var(--spacing-4);

        ul {
            margin: 0;
            padding-left: var(--spacing-5);

            li {
                line-height: 1.6;
            }
        }
    }

    /* Icon Size Classes */
    .w-4,
    .h-4 {
        width: 1rem;
        height: 1rem;
    }

    .w-5,
    .h-5 {
        width: 1.25rem;
        height: 1.25rem;
    }

    /* Utility Classes - Replace Tailwind */
    .text-sm {
        font-size: 0.875rem;
        line-height: 1.25rem;
    }

    .text-muted {
        color: var(--color-text-secondary);
    }

    .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .space-y-4 > * + * {
        margin-top: var(--spacing-4);
    }

    .space-y-3 > * + * {
        margin-top: var(--spacing-3);
    }

    .space-y-1 > * + * {
        margin-top: var(--spacing-1);
    }

    .flex {
        display: flex;
    }

    .items-center {
        align-items: center;
    }

    .justify-center {
        justify-content: center;
    }

    .space-x-2 > * + * {
        margin-left: var(--spacing-2);
    }

    .gap-3 {
        gap: var(--spacing-3);
    }

    .mb-4 {
        margin-bottom: var(--spacing-4);
    }

    .mb-2 {
        margin-bottom: var(--spacing-2);
    }

    .mb-6 {
        margin-bottom: var(--spacing-6);
    }

    /* Responsive Adjustments */
    @media (max-width: 767px) {
        .series-card-actions {
            flex-direction: row;
            width: 100%;
            justify-content: flex-end;
        }

        .series-card-title-row {
            flex-direction: column;
            align-items: flex-start;
        }
    }
</style>
