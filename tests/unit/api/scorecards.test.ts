import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as CreateDatasource } from '../../../src/routes/api/scorecards/[scorecardId]/datasources/+server';
import { PUT as UpdateDatasource, DELETE as DeleteDatasource } from '../../../src/routes/api/scorecards/[scorecardId]/datasources/[id]/+server';
import { createMockRequestEvent } from '../helpers/mock-request';

// Mock auth modules
vi.mock('../../../src/lib/server/auth/index', () => ({
	requireUser: vi.fn()
}));

// Mock repositories
vi.mock('../../../src/lib/server/repositories/scorecard', () => ({
	findScorecardById: vi.fn()
}));

vi.mock('../../../src/lib/server/repositories/scorecard-datasource', () => ({
	createDatasource: vi.fn(),
	updateDatasource: vi.fn(),
	deleteDatasource: vi.fn(),
	findDatasourceById: vi.fn()
}));

vi.mock('../../../src/lib/server/repositories/board-series', () => ({
	getUserRoleInSeries: vi.fn()
}));

// Mock error handler
vi.mock('../../../src/lib/server/api-utils', () => ({
	handleApiError: vi.fn((error, message) => {
		return new Response(JSON.stringify({ success: false, error: message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	})
}));

// Import mocked modules
import { requireUser } from '../../../src/lib/server/auth/index';
import { findScorecardById } from '../../../src/lib/server/repositories/scorecard';
import {
	createDatasource,
	updateDatasource,
	deleteDatasource,
	findDatasourceById
} from '../../../src/lib/server/repositories/scorecard-datasource';
import { getUserRoleInSeries } from '../../../src/lib/server/repositories/board-series';

describe('POST /api/scorecards/[scorecardId]/datasources', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should create datasource successfully', async () => {
		const mockUser = { userId: 'user-1', email: 'admin@example.com', name: 'Admin' };
		const mockScorecard = {
			id: 'scorecard-1',
			seriesId: 'series-1',
			name: 'Test Scorecard'
		};
		const mockDatasource = {
			id: 'datasource-1',
			scorecardId: 'scorecard-1',
			name: 'Test Datasource',
			sourceType: 'paste',
			rules: []
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findScorecardById).mockResolvedValue(mockScorecard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('admin');
		vi.mocked(createDatasource).mockResolvedValue(mockDatasource);

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/scorecards/scorecard-1/datasources',
			params: { scorecardId: 'scorecard-1' },
			body: {
				name: 'Test Datasource',
				source_type: 'paste',
				rules: []
			}
		});

		const response = await CreateDatasource(event);
		const data = await response.json();

		expect(response.status).toBe(201);
		expect(data.success).toBe(true);
		expect(data.datasource.name).toBe('Test Datasource');
		expect(createDatasource).toHaveBeenCalledWith({
			scorecardId: 'scorecard-1',
			name: 'Test Datasource',
			sourceType: 'paste',
			dataSchema: undefined,
			rules: [],
			apiConfig: undefined
		});
	});

	it('should fail when name is missing', async () => {
		const mockUser = { userId: 'user-1', email: 'admin@example.com', name: 'Admin' };
		const mockScorecard = {
			id: 'scorecard-1',
			seriesId: 'series-1',
			name: 'Test Scorecard'
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findScorecardById).mockResolvedValue(mockScorecard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('admin');

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/scorecards/scorecard-1/datasources',
			params: { scorecardId: 'scorecard-1' },
			body: {
				source_type: 'paste',
				rules: []
			}
		});

		const response = await CreateDatasource(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Name is required');
	});

	it('should fail with invalid source_type', async () => {
		const mockUser = { userId: 'user-1', email: 'admin@example.com', name: 'Admin' };
		const mockScorecard = {
			id: 'scorecard-1',
			seriesId: 'series-1',
			name: 'Test Scorecard'
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findScorecardById).mockResolvedValue(mockScorecard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('admin');

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/scorecards/scorecard-1/datasources',
			params: { scorecardId: 'scorecard-1' },
			body: {
				name: 'Test',
				source_type: 'invalid',
				rules: []
			}
		});

		const response = await CreateDatasource(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Valid source_type is required (paste or api)');
	});

	it('should fail when rules array is missing', async () => {
		const mockUser = { userId: 'user-1', email: 'admin@example.com', name: 'Admin' };
		const mockScorecard = {
			id: 'scorecard-1',
			seriesId: 'series-1',
			name: 'Test Scorecard'
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findScorecardById).mockResolvedValue(mockScorecard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('admin');

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/scorecards/scorecard-1/datasources',
			params: { scorecardId: 'scorecard-1' },
			body: {
				name: 'Test',
				source_type: 'paste'
			}
		});

		const response = await CreateDatasource(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Rules array is required');
	});

	it('should fail when user is member', async () => {
		const mockUser = { userId: 'user-1', email: 'member@example.com', name: 'Member' };
		const mockScorecard = {
			id: 'scorecard-1',
			seriesId: 'series-1',
			name: 'Test Scorecard'
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findScorecardById).mockResolvedValue(mockScorecard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('member');

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/scorecards/scorecard-1/datasources',
			params: { scorecardId: 'scorecard-1' },
			body: {
				name: 'Test',
				source_type: 'paste',
				rules: []
			}
		});

		const response = await CreateDatasource(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Insufficient permissions');
	});

	it('should fail when scorecard not found', async () => {
		const mockUser = { userId: 'user-1', email: 'admin@example.com', name: 'Admin' };

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findScorecardById).mockResolvedValue(null);

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/scorecards/scorecard-1/datasources',
			params: { scorecardId: 'scorecard-1' },
			body: {
				name: 'Test',
				source_type: 'paste',
				rules: []
			}
		});

		const response = await CreateDatasource(event);
		const data = await response.json();

		expect(response.status).toBe(404);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Scorecard not found');
	});
});

describe('PUT /api/scorecards/[scorecardId]/datasources/[id]', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should update datasource successfully', async () => {
		const mockUser = { userId: 'user-1', email: 'admin@example.com', name: 'Admin' };
		const mockScorecard = {
			id: 'scorecard-1',
			seriesId: 'series-1',
			name: 'Test Scorecard'
		};
		const mockExistingDatasource = {
			id: 'datasource-1',
			scorecardId: 'scorecard-1',
			name: 'Old Name'
		};
		const mockUpdatedDatasource = {
			id: 'datasource-1',
			scorecardId: 'scorecard-1',
			name: 'New Name',
			rules: [{ id: 'rule-1' }]
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findScorecardById).mockResolvedValue(mockScorecard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('facilitator');
		vi.mocked(findDatasourceById).mockResolvedValue(mockExistingDatasource);
		vi.mocked(updateDatasource).mockResolvedValue(mockUpdatedDatasource);

		const event = createMockRequestEvent({
			method: 'PUT',
			url: 'http://localhost:5173/api/scorecards/scorecard-1/datasources/datasource-1',
			params: { scorecardId: 'scorecard-1', id: 'datasource-1' },
			body: {
				name: 'New Name',
				rules: [{ id: 'rule-1' }]
			}
		});

		const response = await UpdateDatasource(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(data.datasource.name).toBe('New Name');
		expect(updateDatasource).toHaveBeenCalledWith('datasource-1', {
			name: 'New Name',
			dataSchema: undefined,
			rules: [{ id: 'rule-1' }],
			apiConfig: undefined
		});
	});

	it('should fail when datasource not found', async () => {
		const mockUser = { userId: 'user-1', email: 'admin@example.com', name: 'Admin' };
		const mockScorecard = {
			id: 'scorecard-1',
			seriesId: 'series-1',
			name: 'Test Scorecard'
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findScorecardById).mockResolvedValue(mockScorecard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('admin');
		vi.mocked(findDatasourceById).mockResolvedValue(null);

		const event = createMockRequestEvent({
			method: 'PUT',
			url: 'http://localhost:5173/api/scorecards/scorecard-1/datasources/datasource-1',
			params: { scorecardId: 'scorecard-1', id: 'datasource-1' },
			body: {
				name: 'New Name'
			}
		});

		const response = await UpdateDatasource(event);
		const data = await response.json();

		expect(response.status).toBe(404);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Datasource not found');
	});

	it('should fail when datasource belongs to different scorecard', async () => {
		const mockUser = { userId: 'user-1', email: 'admin@example.com', name: 'Admin' };
		const mockScorecard = {
			id: 'scorecard-1',
			seriesId: 'series-1',
			name: 'Test Scorecard'
		};
		const mockExistingDatasource = {
			id: 'datasource-1',
			scorecardId: 'scorecard-999', // Different scorecard
			name: 'Old Name'
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findScorecardById).mockResolvedValue(mockScorecard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('admin');
		vi.mocked(findDatasourceById).mockResolvedValue(mockExistingDatasource);

		const event = createMockRequestEvent({
			method: 'PUT',
			url: 'http://localhost:5173/api/scorecards/scorecard-1/datasources/datasource-1',
			params: { scorecardId: 'scorecard-1', id: 'datasource-1' },
			body: {
				name: 'New Name'
			}
		});

		const response = await UpdateDatasource(event);
		const data = await response.json();

		expect(response.status).toBe(404);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Datasource not found');
	});
});

describe('DELETE /api/scorecards/[scorecardId]/datasources/[id]', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should delete datasource successfully', async () => {
		const mockUser = { userId: 'user-1', email: 'admin@example.com', name: 'Admin' };
		const mockScorecard = {
			id: 'scorecard-1',
			seriesId: 'series-1',
			name: 'Test Scorecard'
		};
		const mockExistingDatasource = {
			id: 'datasource-1',
			scorecardId: 'scorecard-1',
			name: 'Test Datasource'
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findScorecardById).mockResolvedValue(mockScorecard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('admin');
		vi.mocked(findDatasourceById).mockResolvedValue(mockExistingDatasource);
		vi.mocked(deleteDatasource).mockResolvedValue(undefined);

		const event = createMockRequestEvent({
			method: 'DELETE',
			url: 'http://localhost:5173/api/scorecards/scorecard-1/datasources/datasource-1',
			params: { scorecardId: 'scorecard-1', id: 'datasource-1' }
		});

		const response = await DeleteDatasource(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(deleteDatasource).toHaveBeenCalledWith('datasource-1');
	});

	it('should fail when user is member', async () => {
		const mockUser = { userId: 'user-1', email: 'member@example.com', name: 'Member' };
		const mockScorecard = {
			id: 'scorecard-1',
			seriesId: 'series-1',
			name: 'Test Scorecard'
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findScorecardById).mockResolvedValue(mockScorecard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('member');

		const event = createMockRequestEvent({
			method: 'DELETE',
			url: 'http://localhost:5173/api/scorecards/scorecard-1/datasources/datasource-1',
			params: { scorecardId: 'scorecard-1', id: 'datasource-1' }
		});

		const response = await DeleteDatasource(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Insufficient permissions');
	});

	it('should fail when datasource not found', async () => {
		const mockUser = { userId: 'user-1', email: 'admin@example.com', name: 'Admin' };
		const mockScorecard = {
			id: 'scorecard-1',
			seriesId: 'series-1',
			name: 'Test Scorecard'
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findScorecardById).mockResolvedValue(mockScorecard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('admin');
		vi.mocked(findDatasourceById).mockResolvedValue(null);

		const event = createMockRequestEvent({
			method: 'DELETE',
			url: 'http://localhost:5173/api/scorecards/scorecard-1/datasources/datasource-1',
			params: { scorecardId: 'scorecard-1', id: 'datasource-1' }
		});

		const response = await DeleteDatasource(event);
		const data = await response.json();

		expect(response.status).toBe(404);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Datasource not found');
	});
});
