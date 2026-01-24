export interface User {
	id: string;
	name: string;
	email: string;
	createdAt?: string;
	updatedAt?: string;
}

export interface Board {
	id: string;
	name: string;
	seriesId: string;
	status: "draft" | "active" | "completed" | "archived";
	blameFreeMode: boolean;
	votingAllocation: number;
	currentSceneId?: string;
	createdAt?: string;
	updatedAt?: string;
	columns?: Column[];
	scenes?: Scene[];
}

export interface Scene {
	id: string;
	boardId: string;
	title: string;
	description?: string;
	mode:
		| "columns"
		| "present"
		| "review"
		| "agreements"
		| "scorecard"
		| "static"
		| "survey"
		| "quadrant";
	seq: number;
	selectedCardId?: string | null;
	flags: string[]; // Scene capability flags
	createdAt?: string;
}

export interface Column {
	id: string;
	boardId: string;
	title: string;
	seq: number;
	createdAt?: string;
	updatedAt?: string;
}

export interface Card {
	id: string;
	columnId: string;
	userId?: string;
	content: string;
	notes?: string | null;
	groupId?: string | null;
	isGroupLead?: boolean;
	voteCount?: number;
	userVoted?: boolean;
	createdAt?: string;
	updatedAt?: string;
}

export interface Comment {
	id: string;
	cardId: string;
	userId: string;
	userName?: string;
	content: string;
	isAgreement?: boolean;
	createdAt?: string;
}

export interface Vote {
	id: string;
	cardId: string;
	userId: string;
	createdAt?: string;
}
