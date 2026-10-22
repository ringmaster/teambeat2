import moment from "moment";
import { getUserDisplayName } from "./animalNames";

// Builds the markdown summary of a review scene.
// Shared by ReviewScene.svelte (copy to clipboard) and the v1 review API,
// so both always produce the same text from the same data.

export type ReviewViewMode = "by-column" | "by-votes";

export interface ReviewColumn {
	id: string;
	title: string;
	seq: number;
}

export interface ReviewCard {
	id: string;
	columnId: string;
	content: string;
	notes?: string | null;
	groupId?: string | null;
	isGroupLead?: boolean | null;
	voteCount?: number;
	reactions?: Record<string, number>;
}

export interface ReviewComment {
	cardId: string;
	userName?: string | null;
	content: string;
	isReaction?: boolean | null;
	isAgreement?: boolean | null;
}

export interface ReviewAgreement {
	content: string;
	completed: boolean;
	completedAt?: string | null;
	source: "agreement" | "comment";
	cardId?: string;
	cardContent?: string;
}

export interface ReviewSurveyResult {
	question: { question: string };
	average: number;
	history?: { average: number }[];
}

export interface ReviewSurvey {
	sceneId: string;
	sceneTitle: string;
	results: ReviewSurveyResult[];
}

export interface ReviewCardGroup<TCard extends ReviewCard = ReviewCard> {
	leadCard: TCard;
	subordinateCards: TCard[];
	columnId: string;
	columnName: string;
}

export interface ReviewMarkdownInput {
	boardId: string;
	blameFreeMode: boolean;
	// Columns already filtered to those visible in the scene, sorted by seq
	visibleColumns: ReviewColumn[];
	// Cards already filtered to the visible columns
	cards: ReviewCard[];
	comments: ReviewComment[];
	agreements: ReviewAgreement[];
	surveys: ReviewSurvey[];
	viewMode: ReviewViewMode;
}

/**
 * Columns visible in a scene, sorted by seq.
 */
export function getVisibleReviewColumns<TColumn extends ReviewColumn>(
	columns: TColumn[],
	hiddenColumnIds: string[],
): TColumn[] {
	return columns
		.filter((col) => !hiddenColumnIds.includes(col.id))
		.sort((a, b) => a.seq - b.seq);
}

/**
 * Group cards by their lead card. A lead card is a group lead or an ungrouped card.
 */
export function groupReviewCards<TCard extends ReviewCard>(
	cards: TCard[],
	columns: ReviewColumn[],
): ReviewCardGroup<TCard>[] {
	const groups: ReviewCardGroup<TCard>[] = [];
	const processedCardIds = new Set<string>();

	const leadCards = cards.filter((card) => card.isGroupLead || !card.groupId);

	for (const leadCard of leadCards) {
		if (processedCardIds.has(leadCard.id)) continue;

		const subordinateCards = cards.filter(
			(card) =>
				card.groupId === leadCard.id ||
				(card.groupId === leadCard.groupId &&
					leadCard.groupId &&
					!card.isGroupLead &&
					card.id !== leadCard.id),
		);

		const column = columns.find((c) => c.id === leadCard.columnId);

		groups.push({
			leadCard,
			subordinateCards,
			columnId: leadCard.columnId,
			columnName: column?.title || "Unknown Column",
		});

		processedCardIds.add(leadCard.id);
		for (const card of subordinateCards) processedCardIds.add(card.id);
	}

	return groups;
}

function byVotesDescending(a: ReviewCardGroup, b: ReviewCardGroup): number {
	return (b.leadCard.voteCount || 0) - (a.leadCard.voteCount || 0);
}

/**
 * Card groups sorted by lead card votes, highest first.
 */
export function sortReviewGroupsByVotes<TCard extends ReviewCard>(
	groups: ReviewCardGroup<TCard>[],
): ReviewCardGroup<TCard>[] {
	return [...groups].sort(byVotesDescending);
}

/**
 * Card groups for each visible column, each list sorted by votes. Columns with no cards are left out.
 */
export function groupReviewCardsByColumn<TCard extends ReviewCard>(
	groups: ReviewCardGroup<TCard>[],
	visibleColumns: ReviewColumn[],
): Map<string, ReviewCardGroup<TCard>[]> {
	const columnMap = new Map<string, ReviewCardGroup<TCard>[]>();

	for (const column of visibleColumns) {
		const columnGroups = groups
			.filter((group) => group.columnId === column.id)
			.sort(byVotesDescending);

		if (columnGroups.length > 0) {
			columnMap.set(column.id, columnGroups);
		}
	}

	return columnMap;
}

export function calculatePercentChange(
	current: number,
	prior: number,
): { value: number; direction: "up" | "down" | "same" } {
	if (prior === 0) return { value: 0, direction: "same" };
	const change = ((current - prior) / prior) * 100;
	if (Math.abs(change) < 0.5) return { value: 0, direction: "same" };
	return {
		value: Math.abs(change),
		direction: change > 0 ? "up" : "down",
	};
}

function formatPercentChange(current: number, prior: number | undefined): string {
	if (prior === undefined) return "";
	const change = calculatePercentChange(current, prior);
	if (change.direction === "same") return "";
	const arrow = change.direction === "up" ? "↑" : "↓";
	return ` (${arrow}${change.value.toFixed(0)}%)`;
}

export function formatDateYYYYMMDD(dateString: string | null | undefined): string {
	if (!dateString) return "";
	return moment(dateString).format("YYYY-MM-DD");
}

function formatReactions(reactions: Record<string, number> | undefined): string {
	if (!reactions || Object.keys(reactions).length === 0) return "";
	const reactionTexts = Object.entries(reactions).map(
		([emoji, count]) => `(${count}×${emoji})`,
	);
	return `${reactionTexts.join(" ")}\n\n`;
}

export function buildReviewMarkdown(input: ReviewMarkdownInput): string {
	const { boardId, blameFreeMode, visibleColumns, viewMode } = input;

	// Regular comments (not reactions or agreements), grouped by card
	const commentsByCard = new Map<string, ReviewComment[]>();
	for (const comment of input.comments) {
		if (comment.isReaction || comment.isAgreement) continue;
		const existing = commentsByCard.get(comment.cardId) || [];
		commentsByCard.set(comment.cardId, [...existing, comment]);
	}

	function formatComments(cardId: string): string {
		const cardComments = commentsByCard.get(cardId) || [];
		if (cardComments.length === 0) return "";
		let md = `**Comments:**\n\n`;
		for (const comment of cardComments) {
			const author = getUserDisplayName(
				comment.userName || "Anonymous",
				boardId,
				blameFreeMode,
			);
			md += `- ${author}: ${comment.content}\n`;
		}
		return `${md}\n`;
	}

	function formatGroup(group: ReviewCardGroup, showColumn: boolean): string {
		const voteCount = group.leadCard.voteCount || 0;
		let md = `### ${group.leadCard.content} (${voteCount} ${voteCount === 1 ? "vote" : "votes"})\n\n`;

		if (showColumn) {
			md += `Originally in: ${group.columnName}\n\n`;
		}

		if (group.leadCard.notes) {
			md += `${group.leadCard.notes}\n\n`;
		}
		md += formatReactions(group.leadCard.reactions);
		md += formatComments(group.leadCard.id);

		for (const subCard of group.subordinateCards) {
			md += `#### ${subCard.content}\n\n`;
			if (subCard.notes) {
				md += `${subCard.notes}\n\n`;
			}
			md += formatReactions(subCard.reactions);
			md += formatComments(subCard.id);
		}

		return md;
	}

	const groups = groupReviewCards(input.cards, visibleColumns);
	let md = "";

	if (viewMode === "by-column") {
		const groupsByColumn = groupReviewCardsByColumn(groups, visibleColumns);
		for (const column of visibleColumns) {
			const columnGroups = groupsByColumn.get(column.id);
			if (!columnGroups || columnGroups.length === 0) continue;

			md += `## ${column.title}\n\n`;
			for (const group of columnGroups) {
				md += formatGroup(group, false);
			}
		}
	} else {
		md += `## All Cards\n\n`;
		for (const group of sortReviewGroupsByVotes(groups)) {
			md += formatGroup(group, true);
		}
	}

	for (const survey of input.surveys) {
		md += `## Survey: ${survey.sceneTitle}\n\n`;
		for (const result of survey.results) {
			const priorAverage = result.history?.[0]?.average;
			const changeText = formatPercentChange(result.average, priorAverage);
			md += `- **${result.question.question}**: ${result.average.toFixed(2)}${changeText}\n`;
		}
		md += `\n`;
	}

	if (input.agreements.length > 0) {
		md += `## Agreements\n\n`;
		for (const agreement of input.agreements) {
			// Comment-based agreements name the card they came from
			const cardTitle =
				agreement.source === "comment" && agreement.cardId
					? agreement.cardContent || "Unknown Card"
					: null;
			const source = cardTitle ? `from: ${cardTitle}` : "board-level agreement";
			const checkbox = agreement.completed ? "[x]" : "[ ]";
			const completionDate =
				agreement.completed && agreement.completedAt
					? ` (Completed on ${formatDateYYYYMMDD(agreement.completedAt)})`
					: "";

			const lines = agreement.content.split("\n");
			const firstLine = lines[0];
			const remainingLines = lines.slice(1);

			md += `- ${checkbox} **${firstLine}**\n`;

			// Remaining lines are indented; the source goes on the last line
			for (let i = 0; i < remainingLines.length; i++) {
				const line = remainingLines[i].trim();
				if (line) {
					if (i === remainingLines.length - 1) {
						md += `    - ${line} (${source})${completionDate}\n`;
					} else {
						md += `    - ${line}\n`;
					}
				}
			}

			if (remainingLines.length === 0 || remainingLines.every((line) => !line.trim())) {
				md += `    - (${source})${completionDate}\n`;
			}
		}
	}

	return md;
}
