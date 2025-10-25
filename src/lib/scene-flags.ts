// Scene flag constants - shared between client and server
export const SCENE_FLAGS = {
	ALLOW_ADD_CARDS: "allow_add_cards",
	ALLOW_EDIT_CARDS: "allow_edit_cards",
	ALLOW_OBSCURE_CARDS: "allow_obscure_cards",
	ALLOW_MOVE_CARDS: "allow_move_cards",
	ALLOW_GROUP_CARDS: "allow_group_cards",
	ALLOW_SEQUENCE_CARDS: "allow_sequence_cards",
	SHOW_VOTES: "show_votes",
	ALLOW_VOTING: "allow_voting",
	SHOW_COMMENTS: "show_comments",
	ALLOW_COMMENTS: "allow_comments",
	MULTIPLE_VOTES_PER_CARD: "multiple_votes_per_card",
} as const;

// Type for scene flags
export type SceneFlag = (typeof SCENE_FLAGS)[keyof typeof SCENE_FLAGS];

// Default flags for each scene mode
export const SCENE_MODE_FLAGS: Record<string, SceneFlag[]> = {
	columns: [
		SCENE_FLAGS.ALLOW_ADD_CARDS,
		SCENE_FLAGS.ALLOW_EDIT_CARDS,
		SCENE_FLAGS.ALLOW_OBSCURE_CARDS,
		SCENE_FLAGS.ALLOW_MOVE_CARDS,
		SCENE_FLAGS.ALLOW_GROUP_CARDS,
		SCENE_FLAGS.ALLOW_SEQUENCE_CARDS,
		SCENE_FLAGS.ALLOW_VOTING,
		SCENE_FLAGS.SHOW_VOTES,
		SCENE_FLAGS.SHOW_COMMENTS,
		SCENE_FLAGS.ALLOW_COMMENTS,
	],
	present: [
		SCENE_FLAGS.SHOW_VOTES,
		SCENE_FLAGS.SHOW_COMMENTS,
		SCENE_FLAGS.ALLOW_COMMENTS,
	],
	review: [
		SCENE_FLAGS.ALLOW_VOTING,
		SCENE_FLAGS.SHOW_VOTES,
		SCENE_FLAGS.MULTIPLE_VOTES_PER_CARD,
		SCENE_FLAGS.SHOW_COMMENTS,
		SCENE_FLAGS.ALLOW_COMMENTS,
	],
	agreements: [SCENE_FLAGS.ALLOW_ADD_CARDS],
	scorecard: [SCENE_FLAGS.SHOW_COMMENTS, SCENE_FLAGS.ALLOW_COMMENTS],
	static: [],
	survey: [SCENE_FLAGS.ALLOW_ADD_CARDS],
};

// Human-readable flag labels for UI
export const FLAG_LABELS: Record<SceneFlag, string> = {
	[SCENE_FLAGS.ALLOW_ADD_CARDS]: "Allow adding cards",
	[SCENE_FLAGS.ALLOW_EDIT_CARDS]: "Allow editing cards",
	[SCENE_FLAGS.ALLOW_OBSCURE_CARDS]: "Obscure others' cards",
	[SCENE_FLAGS.ALLOW_MOVE_CARDS]: "Allow moving cards",
	[SCENE_FLAGS.ALLOW_GROUP_CARDS]: "Allow grouping cards",
	[SCENE_FLAGS.ALLOW_SEQUENCE_CARDS]: "Allow manual card ordering",
	[SCENE_FLAGS.SHOW_VOTES]: "Show vote counts",
	[SCENE_FLAGS.ALLOW_VOTING]: "Allow voting",
	[SCENE_FLAGS.SHOW_COMMENTS]: "Show comments",
	[SCENE_FLAGS.ALLOW_COMMENTS]: "Allow adding comments",
	[SCENE_FLAGS.MULTIPLE_VOTES_PER_CARD]: "Allow multiple votes per card",
};
