import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getUserRoleInSeries, getSeriesMembers, addUserToSeries, removeUserFromSeries, updateUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { findUserByEmail } from '$lib/server/repositories/user.js';
import { z } from 'zod';

const addUserSchema = z.object({
	email: z.string().email(),
	role: z.enum(['admin', 'facilitator', 'member']).optional().default('member')
});

const updateUserRoleSchema = z.object({
	userId: z.string().uuid(),
	role: z.enum(['admin', 'facilitator', 'member'])
});

const removeUserSchema = z.object({
	userId: z.string().uuid()
});

export const GET: RequestHandler = async (event) => {
	try {
		const user = requireUser(event);
		const seriesId = event.params.id;
		
		// Check if user has access to this series
		const userRole = await getUserRoleInSeries(user.userId, seriesId);
		if (!userRole) {
			return json(
				{ success: false, error: 'Access denied' },
				{ status: 403 }
			);
		}
		
		const members = await getSeriesMembers(seriesId);
		
		return json({
			success: true,
			users: members
		});
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}
		
		return json(
			{ success: false, error: 'Failed to fetch users' },
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const user = requireUser(event);
		const seriesId = event.params.id;
		const body = await event.request.json();
		const data = addUserSchema.parse(body);
		
		// Check if user is admin of this series
		const userRole = await getUserRoleInSeries(user.userId, seriesId);
		if (userRole !== 'admin') {
			return json(
				{ success: false, error: 'Only series administrators can add users' },
				{ status: 403 }
			);
		}
		
		// Find the user by email
		const targetUser = await findUserByEmail(data.email);
		if (!targetUser) {
			return json(
				{ success: false, error: 'User not found. They need to create an account first.' },
				{ status: 404 }
			);
		}
		
		// Check if user is already in the series
		const existingRole = await getUserRoleInSeries(targetUser.id, seriesId);
		if (existingRole) {
			return json(
				{ success: false, error: 'User is already a member of this series' },
				{ status: 409 }
			);
		}
		
		// Add user to series
		await addUserToSeries(seriesId, targetUser.id, data.role);
		
		return json({
			success: true,
			message: 'User added successfully'
		});
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}
		
		if (error instanceof z.ZodError) {
			return json(
				{ success: false, error: 'Invalid input', details: error.errors },
				{ status: 400 }
			);
		}
		
		return json(
			{ success: false, error: 'Failed to add user' },
			{ status: 500 }
		);
	}
};

export const PUT: RequestHandler = async (event) => {
	try {
		const user = requireUser(event);
		const seriesId = event.params.id;
		const body = await event.request.json();
		const data = updateUserRoleSchema.parse(body);
		
		// Check if user is admin of this series
		const userRole = await getUserRoleInSeries(user.userId, seriesId);
		if (userRole !== 'admin') {
			return json(
				{ success: false, error: 'Only series administrators can change user roles' },
				{ status: 403 }
			);
		}
		
		// Check if target user exists in series
		const targetUserRole = await getUserRoleInSeries(data.userId, seriesId);
		if (!targetUserRole) {
			return json(
				{ success: false, error: 'User is not a member of this series' },
				{ status: 404 }
			);
		}
		
		// Don't allow changing role of other admins
		if (targetUserRole === 'admin' && user.userId !== data.userId) {
			return json(
				{ success: false, error: 'Cannot change role of other administrators' },
				{ status: 403 }
			);
		}
		
		// Update user role
		await updateUserRoleInSeries(seriesId, data.userId, data.role);
		
		return json({
			success: true,
			message: 'User role updated successfully'
		});
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}
		
		if (error instanceof z.ZodError) {
			return json(
				{ success: false, error: 'Invalid input', details: error.errors },
				{ status: 400 }
			);
		}
		
		return json(
			{ success: false, error: 'Failed to update user role' },
			{ status: 500 }
		);
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const user = requireUser(event);
		const seriesId = event.params.id;
		const url = new URL(event.request.url);
		const userIdToRemove = url.searchParams.get('userId');
		
		if (!userIdToRemove) {
			return json(
				{ success: false, error: 'User ID is required' },
				{ status: 400 }
			);
		}
		
		// Check if user is admin of this series
		const userRole = await getUserRoleInSeries(user.userId, seriesId);
		if (userRole !== 'admin') {
			return json(
				{ success: false, error: 'Only series administrators can remove users' },
				{ status: 403 }
			);
		}
		
		// Check if target user exists in series
		const targetUserRole = await getUserRoleInSeries(userIdToRemove, seriesId);
		if (!targetUserRole) {
			return json(
				{ success: false, error: 'User is not a member of this series' },
				{ status: 404 }
			);
		}
		
		// Don't allow removing other admins
		if (targetUserRole === 'admin' && user.userId !== userIdToRemove) {
			return json(
				{ success: false, error: 'Cannot remove other administrators' },
				{ status: 403 }
			);
		}
		
		// Remove user from series
		await removeUserFromSeries(seriesId, userIdToRemove);
		
		return json({
			success: true,
			message: 'User removed successfully'
		});
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}
		
		return json(
			{ success: false, error: 'Failed to remove user' },
			{ status: 500 }
		);
	}
};