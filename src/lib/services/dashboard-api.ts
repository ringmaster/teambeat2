/**
 * Dashboard/Series API Service
 * Centralized API calls for dashboard, series, and board creation/management
 */

export interface Series {
	id: string;
	name: string;
	boards: any[];
	role: string;
	createdAt: string;
	updatedAt: string;
}

export interface SeriesListResponse {
	series: Series[];
}

export interface SeriesResponse {
	series: Series;
}

export interface SeriesUsersResponse {
	users: any[];
}

export interface EmailConfigResponse {
	isEmailConfigured: boolean;
}

export interface BoardResponse {
	board: any;
}

/**
 * Email Configuration
 */

export async function checkEmailConfig(): Promise<EmailConfigResponse> {
	const response = await fetch('/api/auth/email-config');
	if (!response.ok) {
		throw new Error('Failed to check email configuration');
	}
	return await response.json();
}

/**
 * Series Operations
 */

export async function listSeries(): Promise<SeriesListResponse> {
	const response = await fetch('/api/series');
	if (!response.ok) {
		throw new Error('Failed to list series');
	}
	return await response.json();
}

export async function createSeries(name: string): Promise<SeriesResponse> {
	const response = await fetch('/api/series', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: name.trim() })
	});

	const data = await response.json();

	if (!response.ok) {
		throw new Error(data.error || 'Failed to create series');
	}

	return data;
}

export async function renameSeries(seriesId: string, name: string): Promise<SeriesResponse> {
	const response = await fetch(`/api/series/${seriesId}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: name.trim() })
	});

	const data = await response.json();

	if (!response.ok) {
		throw new Error(data.error || 'Failed to rename series');
	}

	return data;
}

export async function deleteSeries(seriesId: string): Promise<void> {
	const response = await fetch(`/api/series/${seriesId}`, {
		method: 'DELETE'
	});

	if (!response.ok) {
		const data = await response.json();
		throw new Error(data.error || 'Failed to delete series');
	}
}

/**
 * Series User Management
 */

export async function listSeriesUsers(seriesId: string): Promise<SeriesUsersResponse> {
	const response = await fetch(`/api/series/${seriesId}/users`);
	if (!response.ok) {
		throw new Error('Failed to list series users');
	}
	return await response.json();
}

export async function addSeriesUser(seriesId: string, email: string, role: string = 'member'): Promise<void> {
	const response = await fetch(`/api/series/${seriesId}/users`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, role })
	});

	if (!response.ok) {
		const data = await response.json();
		throw new Error(data.error || 'Failed to add user');
	}
}

export async function removeSeriesUser(seriesId: string, userId: string): Promise<void> {
	const response = await fetch(`/api/series/${seriesId}/users?userId=${userId}`, {
		method: 'DELETE'
	});

	if (!response.ok) {
		const data = await response.json();
		throw new Error(data.error || 'Failed to remove user');
	}
}

export async function updateSeriesUserRole(seriesId: string, userId: string, role: string): Promise<void> {
	const response = await fetch(`/api/series/${seriesId}/users`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ userId, role })
	});

	if (!response.ok) {
		const data = await response.json();
		throw new Error(data.error || 'Failed to update user role');
	}
}

/**
 * Board Operations
 */

export async function createBoard(name: string, seriesId: string): Promise<BoardResponse> {
	const response = await fetch('/api/boards', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name, seriesId })
	});

	const data = await response.json();

	if (!response.ok) {
		throw new Error(data.error || 'Failed to create board');
	}

	return data;
}

export async function cloneBoardInto(targetBoardId: string, sourceBoardId: string): Promise<void> {
	const response = await fetch(`/api/boards/${targetBoardId}/clone`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ sourceId: sourceBoardId })
	});

	if (!response.ok) {
		const data = await response.json();
		throw new Error(data.error || 'Failed to clone board');
	}
}

/**
 * Helper function to create and clone a board in one operation
 */
export async function createAndCloneBoard(
	name: string,
	seriesId: string,
	sourceBoardId: string
): Promise<string> {
	// Create the new board
	const createData = await createBoard(name, seriesId);
	const newBoardId = createData.board.id;

	// Clone the source board into it
	await cloneBoardInto(newBoardId, sourceBoardId);

	return newBoardId;
}
