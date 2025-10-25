<script lang="ts">
import moment from "moment";
import { onMount } from "svelte";
import { toastStore } from "$lib/stores/toast";
import type { Board, Card, Column, Comment, Scene } from "$lib/types";
import { getUserDisplayName } from "$lib/utils/animalNames";
import AgreementsSection from "./AgreementsSection.svelte";
import ReviewCardGroup from "./ReviewCardGroup.svelte";
import ReviewColumn from "./ReviewColumn.svelte";
import Icon from "./ui/Icon.svelte";

interface Props {
	board: Board;
	scene: Scene;
	cards: Card[];
}

const { board, scene, cards }: Props = $props();

type ViewMode = "by-column" | "by-votes";
let viewMode = $state<ViewMode>("by-column");
let copying = $state(false);
let allComments = $state<Comment[]>([]);
let allAgreements = $state<any[]>([]);
let loading = $state(true);

onMount(async () => {
	await Promise.all([loadComments(), loadAgreements()]);
});

async function loadComments() {
	try {
		const response = await fetch(`/api/boards/${board.id}/comments`);
		if (response.ok) {
			const data = await response.json();
			allComments = data.comments || [];
		}
	} catch (error) {
		console.error("Failed to load comments:", error);
		toastStore.error("Failed to load comments");
	}
}

async function loadAgreements() {
	try {
		const response = await fetch(`/api/boards/${board.id}/agreements`);
		if (response.ok) {
			const data = await response.json();
			allAgreements = data.agreements || [];
		}
	} catch (error) {
		console.error("Failed to load agreements:", error);
		toastStore.error("Failed to load agreements");
	} finally {
		loading = false;
	}
}

// Get visible columns based on scene configuration
const visibleColumns = $derived(() => {
	if (!board.columns) return [];

	// Get column IDs that should be visible for this scene
	const hiddenColumnIds = board.hiddenColumnsByScene?.[scene.id] || [];

	return board.columns
		.filter((col) => !hiddenColumnIds.includes(col.id))
		.sort((a, b) => a.seq - b.seq);
});

// Filter cards to only those in visible columns
const visibleCards = $derived(() => {
	const visibleColumnIds = new Set(visibleColumns().map((c) => c.id));
	return cards.filter((card) => visibleColumnIds.has(card.columnId));
});

// Group cards by their lead card
interface CardGroup {
	leadCard: Card;
	subordinateCards: Card[];
	columnId: string;
	columnName: string;
}

const cardGroups = $derived((): CardGroup[] => {
	const cardsArray = visibleCards();
	const groups: CardGroup[] = [];
	const processedCardIds = new Set<string>();

	// Find all lead cards (cards that are group leads or have no group)
	const leadCards = cardsArray.filter((card) => {
		return card.isGroupLead || !card.groupId;
	});

	// For each lead card, find its subordinates
	for (const leadCard of leadCards) {
		if (processedCardIds.has(leadCard.id)) continue;

		const subordinateCards = cardsArray.filter(
			(card) =>
				card.groupId === leadCard.id ||
				(card.groupId === leadCard.groupId &&
					leadCard.groupId &&
					!card.isGroupLead &&
					card.id !== leadCard.id),
		);

		// Get column info
		const column = board.columns?.find((c) => c.id === leadCard.columnId);

		groups.push({
			leadCard,
			subordinateCards,
			columnId: leadCard.columnId,
			columnName: column?.title || "Unknown Column",
		});

		processedCardIds.add(leadCard.id);
		subordinateCards.forEach((card) => processedCardIds.add(card.id));
	}

	return groups;
});

// Sort groups by vote count (descending)
const sortedGroups = $derived(() => {
	return [...cardGroups()].sort((a, b) => {
		const aVotes = a.leadCard.voteCount || 0;
		const bVotes = b.leadCard.voteCount || 0;
		return bVotes - aVotes;
	});
});

// Group by column for column view
const groupsByColumn = $derived(() => {
	const columnMap = new Map<string, CardGroup[]>();

	for (const column of visibleColumns()) {
		const columnGroups = cardGroups()
			.filter((group) => group.columnId === column.id)
			.sort((a, b) => {
				const aVotes = a.leadCard.voteCount || 0;
				const bVotes = b.leadCard.voteCount || 0;
				return bVotes - aVotes;
			});

		if (columnGroups.length > 0) {
			columnMap.set(column.id, columnGroups);
		}
	}

	return columnMap;
});

// Get agreements (both board-level and comment-based)
const agreements = $derived(() => {
	return allAgreements.map((agreement) => {
		// For comment-based agreements, include card context
		if (agreement.source === "comment" && agreement.cardId) {
			return {
				...agreement,
				cardTitle: agreement.cardContent || "Unknown Card",
			};
		}
		// For board-level agreements, no card context needed
		return {
			...agreement,
			cardTitle: null,
		};
	});
});

// Get regular comments (non-reactions, non-agreements) grouped by card
const commentsByCardMap = $derived(() => {
	const map = new Map<string, Comment[]>();
	allComments
		.filter((comment) => !comment.isReaction && !comment.isAgreement)
		.forEach((comment) => {
			const existing = map.get(comment.cardId) || [];
			map.set(comment.cardId, [...existing, comment]);
		});
	return map;
});

// Function to get comments for a specific card
const getCommentsForCard = (cardId: string): Comment[] => {
	return commentsByCardMap().get(cardId) || [];
};

// Generate markdown content
function generateMarkdown(): string {
	let md = "";
	const isBlameFree = board.blameFreeMode || false;

	if (viewMode === "by-column") {
		// Group by column mode
		for (const column of visibleColumns()) {
			const groups = groupsByColumn().get(column.id);
			if (!groups || groups.length === 0) continue;

			md += `## ${column.title}\n\n`;

			for (const group of groups) {
				const voteCount = group.leadCard.voteCount || 0;
				md += `### ${group.leadCard.content} (${voteCount} ${voteCount === 1 ? "vote" : "votes"})\n\n`;

				if (group.leadCard.notes) {
					md += `${group.leadCard.notes}\n\n`;
				}

				// Add reactions if present
				if (
					group.leadCard.reactions &&
					Object.keys(group.leadCard.reactions).length > 0
				) {
					const reactionTexts = Object.entries(group.leadCard.reactions).map(
						([emoji, count]) => `(${count}×${emoji})`,
					);
					md += `${reactionTexts.join(" ")}\n\n`;
				}

				// Add lead card comments
				const leadComments = getCommentsForCard(group.leadCard.id);
				if (leadComments.length > 0) {
					md += `**Comments:**\n\n`;
					for (const comment of leadComments) {
						const author = getUserDisplayName(
							comment.userName || "Anonymous",
							board.id,
							isBlameFree,
						);
						md += `- ${author}: ${comment.content}\n`;
					}
					md += `\n`;
				}

				// Add subordinate cards with their details
				for (const subCard of group.subordinateCards) {
					md += `#### ${subCard.content}\n\n`;

					if (subCard.notes) {
						md += `${subCard.notes}\n\n`;
					}

					// Add reactions if present
					if (subCard.reactions && Object.keys(subCard.reactions).length > 0) {
						const reactionTexts = Object.entries(subCard.reactions).map(
							([emoji, count]) => `(${count}×${emoji})`,
						);
						md += `${reactionTexts.join(" ")}\n\n`;
					}

					const subComments = getCommentsForCard(subCard.id);
					if (subComments.length > 0) {
						md += `**Comments:**\n\n`;
						for (const comment of subComments) {
							const author = getUserDisplayName(
								comment.userName || "Anonymous",
								board.id,
								isBlameFree,
							);
							md += `- ${author}: ${comment.content}\n`;
						}
						md += `\n`;
					}
				}
			}
		}
	} else {
		// Sort all by votes mode
		md += `## All Cards\n\n`;

		for (const group of sortedGroups()) {
			const voteCount = group.leadCard.voteCount || 0;
			md += `### ${group.leadCard.content} (${voteCount} ${voteCount === 1 ? "vote" : "votes"})\n\n`;
			md += `Originally in: ${group.columnName}\n\n`;

			if (group.leadCard.notes) {
				md += `${group.leadCard.notes}\n\n`;
			}

			// Add reactions if present
			if (
				group.leadCard.reactions &&
				Object.keys(group.leadCard.reactions).length > 0
			) {
				const reactionTexts = Object.entries(group.leadCard.reactions).map(
					([emoji, count]) => `(${count}×${emoji})`,
				);
				md += `${reactionTexts.join(" ")}\n\n`;
			}

			// Add lead card comments
			const leadComments = getCommentsForCard(group.leadCard.id);
			if (leadComments.length > 0) {
				md += `**Comments:**\n\n`;
				for (const comment of leadComments) {
					const author = getUserDisplayName(
						comment.userName || "Anonymous",
						board.id,
						isBlameFree,
					);
					md += `- ${author}: ${comment.content}\n`;
				}
				md += `\n`;
			}

			// Add subordinate cards with their details
			for (const subCard of group.subordinateCards) {
				md += `#### ${subCard.content}\n\n`;

				if (subCard.notes) {
					md += `${subCard.notes}\n\n`;
				}

				// Add reactions if present
				if (subCard.reactions && Object.keys(subCard.reactions).length > 0) {
					const reactionTexts = Object.entries(subCard.reactions).map(
						([emoji, count]) => `(${count}×${emoji})`,
					);
					md += `${reactionTexts.join(" ")}\n\n`;
				}

				const subComments = getCommentsForCard(subCard.id);
				if (subComments.length > 0) {
					md += `**Comments:**\n\n`;
					for (const comment of subComments) {
						const author = getUserDisplayName(
							comment.userName || "Anonymous",
							board.id,
							isBlameFree,
						);
						md += `- ${author}: ${comment.content}\n`;
					}
					md += `\n`;
				}
			}
		}
	}

	// Add agreements section if there are any
	const agreementList = agreements();
	if (agreementList.length > 0) {
		md += `## Agreements\n\n`;
		for (const agreement of agreementList) {
			const source = agreement.cardTitle
				? `from: ${agreement.cardTitle}`
				: "board-level agreement";
			const checkbox = agreement.completed ? "[x]" : "[ ]";
			const completionDate =
				agreement.completed && agreement.completedAt
					? ` (Completed on ${formatDateYYYYMMDD(agreement.completedAt)})`
					: "";

			// Handle multi-line content with proper indentation
			const lines = agreement.content.split("\n");
			const firstLine = lines[0];
			const remainingLines = lines.slice(1);

			// First line with checkbox
			md += `- ${checkbox} **${firstLine}**\n`;

			// Remaining content lines, indented
			for (let i = 0; i < remainingLines.length; i++) {
				const line = remainingLines[i].trim();
				if (line) {
					// Add source info to the last non-empty line
					if (i === remainingLines.length - 1) {
						md += `    - ${line} (${source})${completionDate}\n`;
					} else {
						md += `    - ${line}\n`;
					}
				}
			}

			// If there were no remaining lines, add source on its own line
			if (
				remainingLines.length === 0 ||
				remainingLines.every((line) => !line.trim())
			) {
				md += `    - (${source})${completionDate}\n`;
			}
		}
	}

	return md;
}

// Generate HTML content
function generateHTML(): string {
	let html = "";
	const isBlameFree = board.blameFreeMode || false;

	if (viewMode === "by-column") {
		// Group by column mode
		for (const column of visibleColumns()) {
			const groups = groupsByColumn().get(column.id);
			if (!groups || groups.length === 0) continue;

			html += `<h2>${escapeHtml(column.title)}</h2>\n`;

			for (const group of groups) {
				const voteCount = group.leadCard.voteCount || 0;
				html += `<h3>${escapeHtml(group.leadCard.content)} (${voteCount} ${voteCount === 1 ? "vote" : "votes"})</h3>\n`;

				if (group.leadCard.notes) {
					html += `<p>${escapeHtml(group.leadCard.notes)}</p>\n`;
				}

				// Add reactions if present
				if (
					group.leadCard.reactions &&
					Object.keys(group.leadCard.reactions).length > 0
				) {
					const reactionTexts = Object.entries(group.leadCard.reactions).map(
						([emoji, count]) => `(${count}×${emoji})`,
					);
					html += `<p>${reactionTexts.join(" ")}</p>\n`;
				}

				// Add lead card comments
				const leadComments = getCommentsForCard(group.leadCard.id);
				if (leadComments.length > 0) {
					html += `<p><strong>Comments:</strong></p>\n<ul>\n`;
					for (const comment of leadComments) {
						const author = getUserDisplayName(
							comment.userName || "Anonymous",
							board.id,
							isBlameFree,
						);
						html += `<li>${escapeHtml(author)}: ${escapeHtml(comment.content)}</li>\n`;
					}
					html += `</ul>\n`;
				}

				// Add subordinate cards with their details
				for (const subCard of group.subordinateCards) {
					html += `<h4>${escapeHtml(subCard.content)}</h4>\n`;

					if (subCard.notes) {
						html += `<p>${escapeHtml(subCard.notes)}</p>\n`;
					}

					// Add reactions if present
					if (subCard.reactions && Object.keys(subCard.reactions).length > 0) {
						const reactionTexts = Object.entries(subCard.reactions).map(
							([emoji, count]) => `(${count}×${emoji})`,
						);
						html += `<p>${reactionTexts.join(" ")}</p>\n`;
					}

					const subComments = getCommentsForCard(subCard.id);
					if (subComments.length > 0) {
						html += `<p><strong>Comments:</strong></p>\n<ul>\n`;
						for (const comment of subComments) {
							const author = getUserDisplayName(
								comment.userName || "Anonymous",
								board.id,
								isBlameFree,
							);
							html += `<li>${escapeHtml(author)}: ${escapeHtml(comment.content)}</li>\n`;
						}
						html += `</ul>\n`;
					}
				}
			}
		}
	} else {
		// Sort all by votes mode
		html += `<h2>All Cards</h2>\n`;

		for (const group of sortedGroups()) {
			const voteCount = group.leadCard.voteCount || 0;
			html += `<h3>${escapeHtml(group.leadCard.content)} (${voteCount} ${voteCount === 1 ? "vote" : "votes"})</h3>\n`;
			html += `<p><em>Originally in: ${escapeHtml(group.columnName)}</em></p>\n`;

			if (group.leadCard.notes) {
				html += `<p>${escapeHtml(group.leadCard.notes)}</p>\n`;
			}

			// Add reactions if present
			if (
				group.leadCard.reactions &&
				Object.keys(group.leadCard.reactions).length > 0
			) {
				const reactionTexts = Object.entries(group.leadCard.reactions).map(
					([emoji, count]) => `(${count}×${emoji})`,
				);
				html += `<p>${reactionTexts.join(" ")}</p>\n`;
			}

			// Add lead card comments
			const leadComments = getCommentsForCard(group.leadCard.id);
			if (leadComments.length > 0) {
				html += `<p><strong>Comments:</strong></p>\n<ul>\n`;
				for (const comment of leadComments) {
					const author = getUserDisplayName(
						comment.userName || "Anonymous",
						board.id,
						isBlameFree,
					);
					html += `<li>${escapeHtml(author)}: ${escapeHtml(comment.content)}</li>\n`;
				}
				html += `</ul>\n`;
			}

			// Add subordinate cards with their details
			for (const subCard of group.subordinateCards) {
				html += `<h4>${escapeHtml(subCard.content)}</h4>\n`;

				if (subCard.notes) {
					html += `<p>${escapeHtml(subCard.notes)}</p>\n`;
				}

				// Add reactions if present
				if (subCard.reactions && Object.keys(subCard.reactions).length > 0) {
					const reactionTexts = Object.entries(subCard.reactions).map(
						([emoji, count]) => `(${count}×${emoji})`,
					);
					html += `<p>${reactionTexts.join(" ")}</p>\n`;
				}

				const subComments = getCommentsForCard(subCard.id);
				if (subComments.length > 0) {
					html += `<p><strong>Comments:</strong></p>\n<ul>\n`;
					for (const comment of subComments) {
						const author = getUserDisplayName(
							comment.userName || "Anonymous",
							board.id,
							isBlameFree,
						);
						html += `<li>${escapeHtml(author)}: ${escapeHtml(comment.content)}</li>\n`;
					}
					html += `</ul>\n`;
				}
			}
		}
	}

	// Add agreements section if there are any
	const agreementList = agreements();
	if (agreementList.length > 0) {
		html += `<h2>Agreements</h2>\n<ul style="list-style-type: none; padding-left: 0;">\n`;
		for (const agreement of agreementList) {
			const source = agreement.cardTitle
				? `from: ${escapeHtml(agreement.cardTitle)}`
				: "board-level agreement";
			const checked = agreement.completed ? "checked" : "";
			const strikethrough = agreement.completed
				? 'style="text-decoration: line-through;"'
				: "";
			const completionDate =
				agreement.completed && agreement.completedAt
					? ` (Completed on ${formatDateYYYYMMDD(agreement.completedAt)})`
					: "";

			// Handle multi-line content with proper indentation
			const lines = agreement.content.split("\n");
			const firstLine = lines[0];
			const remainingLines = lines.slice(1).filter((line) => line.trim());

			// First line with checkbox
			html += `<li><input type="checkbox" ${checked} /> <span ${strikethrough}><strong>${escapeHtml(firstLine)}</strong></span>`;

			// Remaining content lines, indented as nested list
			if (remainingLines.length > 0) {
				html += `\n<ul style="list-style-type: none; padding-left: 20px; margin-top: 5px;">\n`;
				for (let i = 0; i < remainingLines.length; i++) {
					const line = remainingLines[i].trim();
					if (line) {
						// Add source info to the last line
						if (i === remainingLines.length - 1) {
							html += `<li>${escapeHtml(line)} <em>(${source})${completionDate}</em></li>\n`;
						} else {
							html += `<li>${escapeHtml(line)}</li>\n`;
						}
					}
				}
				html += `</ul>\n`;
			} else {
				// If no remaining lines, add source on same line
				html += ` <em>(${source})${completionDate}</em>`;
			}

			html += `</li>\n`;
		}
		html += `</ul>\n`;
	}

	return html;
}

// Escape HTML special characters
function escapeHtml(text: string): string {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

// Format date as yyyy-mm-dd
function formatDateYYYYMMDD(dateString: string | null): string {
	if (!dateString) return "";
	return moment(dateString).format("YYYY-MM-DD");
}

// Copy to clipboard
async function copyToClipboard() {
	copying = true;
	try {
		const markdown = generateMarkdown();
		const html = generateHTML();

		// Use Clipboard API with multipart data
		const clipboardItem = new ClipboardItem({
			"text/html": new Blob([html], { type: "text/html" }),
			"text/plain": new Blob([markdown], { type: "text/plain" }),
		});

		await navigator.clipboard.write([clipboardItem]);
		toastStore.success("Copied to clipboard");
	} catch (error) {
		console.error("Failed to copy to clipboard:", error);
		toastStore.error("Failed to copy to clipboard");
	} finally {
		copying = false;
	}
}
</script>

<div class="review-scene">
    <div class="review-toolbar">
        <div class="review-toolbar-content">
            <div class="view-toggle">
                <button
                    class="toggle-btn"
                    class:active={viewMode === "by-column"}
                    onclick={() => (viewMode = "by-column")}
                >
                    <svg
                        class="toggle-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                    >
                        <rect
                            x="3"
                            y="3"
                            width="7"
                            height="18"
                            rx="1"
                            stroke-width="2"
                        />
                        <rect
                            x="14"
                            y="3"
                            width="7"
                            height="18"
                            rx="1"
                            stroke-width="2"
                        />
                    </svg>
                    By Column
                </button>
                <button
                    class="toggle-btn"
                    class:active={viewMode === "by-votes"}
                    onclick={() => (viewMode = "by-votes")}
                >
                    <svg
                        class="votes-icon"
                        viewBox="0 0 2315.49 2202.5"
                        style="width: 1rem; height: 1rem;"
                    >
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

                    By&nbsp;Votes
                </button>
            </div>

            <button
                class="copy-action"
                onclick={copyToClipboard}
                disabled={copying}
                title="Copy review to clipboard"
            >
                {#if copying}
                    <Icon name="loading" size="sm" />
                {:else}
                    <svg
                        class="copy-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                    >
                        <rect
                            x="9"
                            y="9"
                            width="13"
                            height="13"
                            rx="2"
                            ry="2"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                        <path
                            d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                {/if}
                <span class="copy-label">Copy</span>
            </button>
        </div>
    </div>

    <div class="review-content">
        {#if loading}
            <div class="loading-state">
                <Icon name="loading" size="lg" />
                <p>Loading comments...</p>
            </div>
        {:else if viewMode === "by-column"}
            {#each visibleColumns() as column (column.id)}
                {@const groups = groupsByColumn().get(column.id)}
                {#if groups && groups.length > 0}
                    <ReviewColumn
                        {column}
                        {groups}
                        commentsByCard={getCommentsForCard}
                        blameFreeMode={board.blameFreeMode || false}
                        boardId={board.id}
                    />
                {/if}
            {/each}
        {:else}
            <div class="all-cards-section">
                <h2 class="section-title">All Cards</h2>
                {#each sortedGroups() as group (group.leadCard.id)}
                    <ReviewCardGroup
                        {group}
                        showColumnContext={true}
                        commentsByCard={getCommentsForCard}
                        blameFreeMode={board.blameFreeMode || false}
                        boardId={board.id}
                    />
                {/each}
            </div>
        {/if}

        {#if agreements().length > 0}
            <AgreementsSection agreements={agreements()} />
        {/if}

        {#if visibleCards().length === 0}
            <div class="empty-state">
                <p>No cards to display</p>
            </div>
        {/if}
    </div>
</div>

<style lang="less">
    @import "$lib/styles/_mixins.less";
    .review-scene {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
    }

    .review-toolbar {
        background-color: var(--surface-secondary);
        border-bottom: 1px solid var(--surface-tertiary);
        padding: 0.75rem 1rem;
        flex-shrink: 0;
    }

    .review-toolbar-content {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1.5rem;
    }

    .view-toggle {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .toggle-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.875rem;
        border: 1px solid var(--border-secondary);
        background: transparent;
        color: var(--text-secondary);
        border-radius: 0.375rem;
        cursor: pointer;
        font-size: 0.8125rem;
        font-weight: 500;
        transition: all 0.2s ease;

        &:hover:not(.active) {
            background: var(--surface-primary);
            border-color: var(--border-primary);
        }

        &.active {
            background: var(--surface-primary);
            color: var(--accent-primary);
            border-color: var(--accent-primary);
            box-shadow: 0 0 0 1px var(--accent-primary);
        }
    }

    .toggle-icon {
        width: 1rem;
        height: 1rem;
        flex-shrink: 0;
    }

    .copy-action {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.875rem;
        border: 1px solid var(--border-secondary);
        background: transparent;
        color: var(--text-secondary);
        border-radius: 0.375rem;
        cursor: pointer;
        font-size: 0.8125rem;
        font-weight: 500;
        transition: all 0.2s ease;

        &:hover:not(:disabled) {
            background: color-mix(
                in srgb,
                var(--accent-primary) 10%,
                transparent
            );
            border-color: color-mix(
                in srgb,
                var(--accent-primary) 30%,
                transparent
            );
            color: var(--accent-primary);
            transform: translateY(-1px);
        }

        &:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
    }

    .copy-icon {
        width: 1rem;
        height: 1rem;
        flex-shrink: 0;
    }

    .copy-label {
        white-space: nowrap;
    }

    .review-content {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 2rem;
        padding: 1.5rem;
    }

    .all-cards-section {
        display: flex;
        flex-direction: column;
        .page-width();
        gap: 1rem;
        width: 100%;
        background-color: white;
        backdrop-filter: none;
        border: none;
        box-shadow: 0 1px 3px #000000;
        border-radius: 1rem;
        padding: var(--spacing-8);
        box-shadow: var(--shadow-xl);
        margin: 0 auto;
        width: 60%;
    }

    .section-title {
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
        padding-bottom: 0.5rem;
        border-bottom: 2px solid var(--border-primary);
    }

    .loading-state,
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 1;
        height: 100%;
        color: var(--text-secondary);
        gap: 1rem;

        p {
            margin: 0;
            font-size: 1.125rem;
        }
    }
</style>
