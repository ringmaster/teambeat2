import { describe, expect, it } from "vitest";
import {
	buildReviewMarkdown,
	calculatePercentChange,
	getVisibleReviewColumns,
	groupReviewCards,
	type ReviewMarkdownInput,
} from "../../../src/lib/utils/review-markdown";
import { getUserDisplayName } from "../../../src/lib/utils/animalNames";

const columns = [
	{ id: "col-b", title: "To improve", seq: 2 },
	{ id: "col-a", title: "Went well", seq: 1 },
];

function input(overrides: Partial<ReviewMarkdownInput> = {}): ReviewMarkdownInput {
	return {
		boardId: "board-1",
		blameFreeMode: false,
		visibleColumns: getVisibleReviewColumns(columns, []),
		cards: [],
		comments: [],
		agreements: [],
		surveys: [],
		viewMode: "by-column",
		...overrides,
	};
}

describe("getVisibleReviewColumns", () => {
	it("drops hidden columns and sorts by seq", () => {
		expect(getVisibleReviewColumns(columns, [])).toEqual([columns[1], columns[0]]);
		expect(getVisibleReviewColumns(columns, ["col-a"])).toEqual([columns[0]]);
	});
});

describe("groupReviewCards", () => {
	it("puts grouped cards under their lead card", () => {
		const cards = [
			{ id: "lead", columnId: "col-a", content: "Lead", isGroupLead: true, groupId: null },
			{ id: "child", columnId: "col-a", content: "Child", isGroupLead: false, groupId: "lead" },
			{ id: "solo", columnId: "col-b", content: "Solo", isGroupLead: false, groupId: null },
		];

		const groups = groupReviewCards(cards, columns);

		expect(groups.map((g) => g.leadCard.id)).toEqual(["lead", "solo"]);
		expect(groups[0].subordinateCards.map((c) => c.id)).toEqual(["child"]);
		expect(groups[0].columnName).toBe("Went well");
	});

	it("names an unknown column", () => {
		const groups = groupReviewCards([{ id: "x", columnId: "gone", content: "X" }], columns);
		expect(groups[0].columnName).toBe("Unknown Column");
	});
});

describe("calculatePercentChange", () => {
	it("reports direction and size, and treats tiny or zero-base changes as the same", () => {
		expect(calculatePercentChange(4, 2)).toEqual({ value: 100, direction: "up" });
		expect(calculatePercentChange(1, 2)).toEqual({ value: 50, direction: "down" });
		expect(calculatePercentChange(2.001, 2)).toEqual({ value: 0, direction: "same" });
		expect(calculatePercentChange(3, 0)).toEqual({ value: 0, direction: "same" });
	});
});

describe("buildReviewMarkdown", () => {
	it("returns an empty string when there is nothing to show", () => {
		expect(buildReviewMarkdown(input())).toBe("");
	});

	it("groups cards under columns sorted by votes, with notes, reactions, comments, and grouped cards", () => {
		const markdown = buildReviewMarkdown(
			input({
				cards: [
					{ id: "c1", columnId: "col-a", content: "Fast deploys", voteCount: 1, notes: "Took 5 min", reactions: { "👍": 2 } },
					{ id: "c2", columnId: "col-a", content: "Pairing", voteCount: 3, isGroupLead: true },
					{ id: "c3", columnId: "col-a", content: "More pairing", groupId: "c2", notes: "Mob too" },
					{ id: "c4", columnId: "col-b", content: "Flaky tests", voteCount: 0 },
				],
				comments: [
					{ cardId: "c1", userName: "Ann", content: "Agreed" },
					{ cardId: "c1", userName: null, content: "Same" },
					{ cardId: "c1", userName: "Bo", content: "👍", isReaction: true },
					{ cardId: "c1", userName: "Bo", content: "Keep it", isAgreement: true },
					{ cardId: "c3", userName: "Cy", content: "Yes" },
				],
			}),
		);

		expect(markdown).toBe(
			[
				"## Went well\n\n",
				"### Pairing (3 votes)\n\n",
				"#### More pairing\n\n",
				"Mob too\n\n",
				"**Comments:**\n\n- Cy: Yes\n\n",
				"### Fast deploys (1 vote)\n\n",
				"Took 5 min\n\n",
				"(2×👍)\n\n",
				"**Comments:**\n\n- Ann: Agreed\n- Anonymous: Same\n\n",
				"## To improve\n\n",
				"### Flaky tests (0 votes)\n\n",
			].join(""),
		);
	});

	it("lists all cards by votes with their column in by-votes mode", () => {
		const markdown = buildReviewMarkdown(
			input({
				viewMode: "by-votes",
				cards: [
					{ id: "c1", columnId: "col-a", content: "Low", voteCount: 1 },
					{ id: "c2", columnId: "col-b", content: "High", voteCount: 2 },
				],
			}),
		);

		expect(markdown).toBe(
			"## All Cards\n\n" +
				"### High (2 votes)\n\nOriginally in: To improve\n\n" +
				"### Low (1 vote)\n\nOriginally in: Went well\n\n",
		);
	});

	it("uses animal names for comment authors in blame-free mode", () => {
		const markdown = buildReviewMarkdown(
			input({
				blameFreeMode: true,
				cards: [{ id: "c1", columnId: "col-a", content: "Card" }],
				comments: [{ cardId: "c1", userName: "Ann", content: "Hi" }],
			}),
		);

		const animalName = getUserDisplayName("Ann", "board-1", true);
		expect(animalName).not.toBe("Ann");
		expect(markdown).toContain(`- ${animalName}: Hi\n`);
		expect(markdown).not.toContain("Ann");
	});

	it("adds survey averages with the change from the prior board", () => {
		const markdown = buildReviewMarkdown(
			input({
				surveys: [
					{
						sceneId: "s1",
						sceneTitle: "Team health",
						results: [
							{ question: { question: "Morale" }, average: 4, history: [{ average: 2 }] },
							{ question: { question: "Focus" }, average: 3, history: [{ average: 4 }] },
							{ question: { question: "Fun" }, average: 3, history: [] },
						],
					},
				],
			}),
		);

		expect(markdown).toBe(
			"## Survey: Team health\n\n" +
				"- **Morale**: 4.00 (↑100%)\n" +
				"- **Focus**: 3.00 (↓25%)\n" +
				"- **Fun**: 3.00\n\n",
		);
	});

	it("lists agreements with their source, completion date, and extra lines", () => {
		const markdown = buildReviewMarkdown(
			input({
				agreements: [
					{ source: "agreement", content: "Ship weekly", completed: false },
					{
						source: "comment",
						cardId: "c1",
						cardContent: "Flaky tests",
						content: "Fix CI\nQuarantine flaky tests",
						completed: true,
						completedAt: "2026-10-01T12:00:00Z",
					},
					{ source: "comment", cardId: "c2", content: "Orphan", completed: false },
				],
			}),
		);

		expect(markdown).toBe(
			"## Agreements\n\n" +
				"- [ ] **Ship weekly**\n    - (board-level agreement)\n" +
				"- [x] **Fix CI**\n    - Quarantine flaky tests (from: Flaky tests) (Completed on 2026-10-01)\n" +
				"- [ ] **Orphan**\n    - (from: Unknown Card)\n",
		);
	});
});
