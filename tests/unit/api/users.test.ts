import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	GET as GetSeriesUsers,
	POST as AddUserToSeries,
	PUT as UpdateUserRole,
	DELETE as RemoveUserFromSeries
} from '../../../src/routes/api/series/[id]/users/+server';
import { createMockRequestEvent } from '../helpers/mock-request';

// Mock auth modules
vi.mock('../../../src/lib/server/auth/index', () => ({
	requireUserForApi: vi.fn()
}));

// Mock repositories
vi.mock('../../../src/lib/server/repositories/board-series', () => ({
	getUserRoleInSeries: vi.fn(),
	getSeriesMembers: vi.fn(),
	updateUserRoleInSeries: vi.fn(),
	addUserToSeries: vi.fn(),
	removeUserFromSeries: vi.fn(),
	hasActiveBoards: vi.fn()
}));

vi.mock('../../../src/lib/server/repositories/user', () => ({
	findUserByEmail: vi.fn()
}));

// Import mocked modules
import { requireUserForApi } from '../../../src/lib/server/auth/index';
import {
	getUserRoleInSeries,
	getSeriesMembers,
	updateUserRoleInSeries,
	addUserToSeries,
	removeUserFromSeries,
	hasActiveBoards
} from '../../../src/lib/server/repositories/board-series';
import { findUserByEmail } from '../../../src/lib/server/repositories/user';

describe('GET /api/series/[id]/users', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should list series members successfully', async () => {
		const mockUser = { userId: 'user-1', email: 'admin@example.com', name: 'Admin' };
		const mockMembers = [
			{ userId: 'user-1', email: 'admin@example.com', name: 'Admin', role: 'admin' },
			{ userId: '00000000-0000-4000-8000-000000000002', email: 'facilitator@example.com', name: 'Facilitator', role: 'facilitator' },
			{ userId: 'user-3', email: 'member@example.com', name: 'Member', role: 'member' }
		];

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('admin');
		vi.mocked(getSeriesMembers).mockResolvedValue(mockMembers);

		const event = createMockRequestEvent({
			method: 'GET',
			url: 'http://localhost:5173/api/series/series-1/users'
		});
		event.params = { id: 'series-1' };

		const response = await GetSeriesUsers(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(data.users).toEqual(mockMembers);
		expect(getSeriesMembers).toHaveBeenCalledWith('series-1');
	});

	it('should fail when user has no access to series', async () => {
		const mockUser = { userId: 'user-1', email: 'test@example.com', name: 'Test User' };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValue(null);

		const event = createMockRequestEvent({
			method: 'GET',
			url: 'http://localhost:5173/api/series/series-1/users'
		});
		event.params = { id: 'series-1' };

		const response = await GetSeriesUsers(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Access denied');
	});
});

describe('PUT /api/series/[id]/users', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should update user role successfully as admin', async () => {
		const mockUser = { userId: '00000000-0000-4000-8000-000000000001', email: 'admin@example.com', name: 'Admin' };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValueOnce('admin').mockResolvedValueOnce('member');
		vi.mocked(updateUserRoleInSeries).mockResolvedValue(undefined);

		const event = createMockRequestEvent({
			method: 'PUT',
			url: 'http://localhost:5173/api/series/series-1/users',
			body: {
				userId: '00000000-0000-4000-8000-000000000002',
				role: 'facilitator'
			}
		});
		event.params = { id: 'series-1' };

		const response = await UpdateUserRole(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(updateUserRoleInSeries).toHaveBeenCalledWith('series-1', '00000000-0000-4000-8000-000000000002', 'facilitator');
	});

	it('should fail when non-admin tries to change roles', async () => {
		const mockUser = { userId: 'user-1', email: 'facilitator@example.com', name: 'Facilitator' };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('facilitator');

		const event = createMockRequestEvent({
			method: 'PUT',
			url: 'http://localhost:5173/api/series/series-1/users',
			body: {
				userId: '00000000-0000-4000-8000-000000000002',
				role: 'admin'
			}
		});
		event.params = { id: 'series-1' };

		const response = await UpdateUserRole(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Only series administrators can change user roles');
	});

	it('should fail when trying to change role of another admin', async () => {
		const mockUser = { userId: '00000000-0000-4000-8000-000000000001', email: 'admin@example.com', name: 'Admin' };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValueOnce('admin').mockResolvedValueOnce('admin');

		const event = createMockRequestEvent({
			method: 'PUT',
			url: 'http://localhost:5173/api/series/series-1/users',
			body: {
				userId: '00000000-0000-4000-8000-000000000003',
				role: 'facilitator'
			}
		});
		event.params = { id: 'series-1' };

		const response = await UpdateUserRole(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Cannot change role of other administrators');
	});

	it('should allow admin to change their own role', async () => {
		const mockUser = { userId: '00000000-0000-4000-8000-000000000001', email: 'admin@example.com', name: 'Admin' };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValueOnce('admin').mockResolvedValueOnce('admin');
		vi.mocked(updateUserRoleInSeries).mockResolvedValue(undefined);

		const event = createMockRequestEvent({
			method: 'PUT',
			url: 'http://localhost:5173/api/series/series-1/users',
			body: {
				userId: '00000000-0000-4000-8000-000000000001',
				role: 'member'
			}
		});
		event.params = { id: 'series-1' };

		const response = await UpdateUserRole(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(updateUserRoleInSeries).toHaveBeenCalledWith('series-1', '00000000-0000-4000-8000-000000000001', 'member');
	});

	it('should fail when user not in series', async () => {
		const mockUser = { userId: '00000000-0000-4000-8000-000000000001', email: 'admin@example.com', name: 'Admin' };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValueOnce('admin').mockResolvedValueOnce(null);

		const event = createMockRequestEvent({
			method: 'PUT',
			url: 'http://localhost:5173/api/series/series-1/users',
			body: {
				userId: '00000000-0000-4000-8000-000000000099',
				role: 'member'
			}
		});
		event.params = { id: 'series-1' };

		const response = await UpdateUserRole(event);
		const data = await response.json();

		expect(response.status).toBe(404);
		expect(data.success).toBe(false);
		expect(data.error).toBe('User is not a member of this series');
	});

	it('should validate role is one of admin, facilitator, or member', async () => {
		const mockUser = { userId: '00000000-0000-4000-8000-000000000001', email: 'admin@example.com', name: 'Admin' };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('admin');

		const event = createMockRequestEvent({
			method: 'PUT',
			url: 'http://localhost:5173/api/series/series-1/users',
			body: {
				userId: '00000000-0000-4000-8000-000000000002',
				role: 'invalid-role'
			}
		});
		event.params = { id: 'series-1' };

		const response = await UpdateUserRole(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Invalid input');
	});
});

describe('POST /api/series/[id]/users', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should add user to series successfully as admin', async () => {
		const mockUser = { userId: '00000000-0000-4000-8000-000000000001', email: 'admin@example.com', name: 'Admin' };
		const mockTargetUser = { id: '00000000-0000-4000-8000-000000000002', email: 'newuser@example.com', name: 'New User' };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValueOnce('admin').mockResolvedValueOnce(null);
		vi.mocked(findUserByEmail).mockResolvedValue(mockTargetUser);
		vi.mocked(hasActiveBoards).mockResolvedValue(true);
		vi.mocked(addUserToSeries).mockResolvedValue(undefined);

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/series/series-1/users',
			body: {
				email: 'newuser@example.com',
				role: 'member'
			}
		});
		event.params = { id: 'series-1' };

		const response = await AddUserToSeries(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(addUserToSeries).toHaveBeenCalledWith('series-1', '00000000-0000-4000-8000-000000000002', 'member');
	});

	it('should fail when non-admin tries to add user', async () => {
		const mockUser = { userId: '00000000-0000-4000-8000-000000000001', email: 'facilitator@example.com', name: 'Facilitator' };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('facilitator');

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/series/series-1/users',
			body: {
				email: 'newuser@example.com'
			}
		});
		event.params = { id: 'series-1' };

		const response = await AddUserToSeries(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Only series administrators can add users');
	});

	it('should fail when user not found by email', async () => {
		const mockUser = { userId: '00000000-0000-4000-8000-000000000001', email: 'admin@example.com', name: 'Admin' };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('admin');
		vi.mocked(findUserByEmail).mockResolvedValue(null);

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/series/series-1/users',
			body: {
				email: 'nonexistent@example.com'
			}
		});
		event.params = { id: 'series-1' };

		const response = await AddUserToSeries(event);
		const data = await response.json();

		expect(response.status).toBe(404);
		expect(data.success).toBe(false);
		expect(data.error).toBe('User not found. They need to create an account first.');
	});

	it('should fail when user already in series', async () => {
		const mockUser = { userId: '00000000-0000-4000-8000-000000000001', email: 'admin@example.com', name: 'Admin' };
		const mockTargetUser = { id: '00000000-0000-4000-8000-000000000002', email: 'existing@example.com', name: 'Existing User' };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValueOnce('admin').mockResolvedValueOnce('member');
		vi.mocked(findUserByEmail).mockResolvedValue(mockTargetUser);

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/series/series-1/users',
			body: {
				email: 'existing@example.com'
			}
		});
		event.params = { id: 'series-1' };

		const response = await AddUserToSeries(event);
		const data = await response.json();

		expect(response.status).toBe(409);
		expect(data.success).toBe(false);
		expect(data.error).toBe('User is already a member of this series');
	});
});

describe('DELETE /api/series/[id]/users', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should remove user from series successfully as admin', async () => {
		const mockUser = { userId: '00000000-0000-4000-8000-000000000001', email: 'admin@example.com', name: 'Admin' };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValueOnce('admin').mockResolvedValueOnce('member');
		vi.mocked(removeUserFromSeries).mockResolvedValue(undefined);

		const event = createMockRequestEvent({
			method: 'DELETE',
			url: 'http://localhost:5173/api/series/series-1/users?userId=00000000-0000-4000-8000-000000000002'
		});
		event.params = { id: 'series-1' };

		const response = await RemoveUserFromSeries(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(removeUserFromSeries).toHaveBeenCalledWith('series-1', '00000000-0000-4000-8000-000000000002');
	});

	it('should fail when non-admin tries to remove user', async () => {
		const mockUser = { userId: 'user-1', email: 'facilitator@example.com', name: 'Facilitator' };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('facilitator');

		const event = createMockRequestEvent({
			method: 'DELETE',
			url: 'http://localhost:5173/api/series/series-1/users?userId=00000000-0000-4000-8000-000000000002'
		});
		event.params = { id: 'series-1' };

		const response = await RemoveUserFromSeries(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Only series administrators can remove users');
	});

	it('should fail when trying to remove user not in series', async () => {
		const mockUser = { userId: '00000000-0000-4000-8000-000000000001', email: 'admin@example.com', name: 'Admin' };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValueOnce('admin').mockResolvedValueOnce(null);

		const event = createMockRequestEvent({
			method: 'DELETE',
			url: 'http://localhost:5173/api/series/series-1/users?userId=00000000-0000-4000-8000-000000000099'
		});
		event.params = { id: 'series-1' };

		const response = await RemoveUserFromSeries(event);
		const data = await response.json();

		expect(response.status).toBe(404);
		expect(data.success).toBe(false);
		expect(data.error).toBe('User is not a member of this series');
	});

	it('should fail when trying to remove another admin', async () => {
		const mockUser = { userId: '00000000-0000-4000-8000-000000000001', email: 'admin@example.com', name: 'Admin' };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValueOnce('admin').mockResolvedValueOnce('admin');

		const event = createMockRequestEvent({
			method: 'DELETE',
			url: 'http://localhost:5173/api/series/series-1/users?userId=00000000-0000-4000-8000-000000000003'
		});
		event.params = { id: 'series-1' };

		const response = await RemoveUserFromSeries(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Cannot remove other administrators');
	});

	it('should allow admin to remove themselves', async () => {
		const mockUser = { userId: '00000000-0000-4000-8000-000000000001', email: 'admin@example.com', name: 'Admin' };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValueOnce('admin').mockResolvedValueOnce('admin');
		vi.mocked(removeUserFromSeries).mockResolvedValue(undefined);

		const event = createMockRequestEvent({
			method: 'DELETE',
			url: 'http://localhost:5173/api/series/series-1/users?userId=00000000-0000-4000-8000-000000000001'
		});
		event.params = { id: 'series-1' };

		const response = await RemoveUserFromSeries(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(removeUserFromSeries).toHaveBeenCalledWith('series-1', '00000000-0000-4000-8000-000000000001');
	});

	it('should fail when userId not provided', async () => {
		const mockUser = { userId: '00000000-0000-4000-8000-000000000001', email: 'admin@example.com', name: 'Admin' };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);

		const event = createMockRequestEvent({
			method: 'DELETE',
			url: 'http://localhost:5173/api/series/series-1/users'
		});
		event.params = { id: 'series-1' };

		const response = await RemoveUserFromSeries(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe('User ID is required');
	});
});
