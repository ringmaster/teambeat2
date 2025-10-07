import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSession } from '$lib/server/auth/session.js';
import { setSessionCookie } from '$lib/server/auth/index.js';
import { findUserByEmail, createUser } from '$lib/server/repositories/user.js';
import { dev } from '$app/environment';

export const GET: RequestHandler = async (event) => {
    const { cookies, url, request } = event;
    // Only allow in development mode for testing
    if (!dev) {
        return json({ error: 'Not available in production' }, { status: 403 });
    }
    
    // Get email from query param, default to test user
    const email = url.searchParams.get('email') || 'test@example.com';
    
    try {
        // Find or create test user
        let user = await findUserByEmail(email);
        
        if (!user) {
            // Create a test user if it doesn't exist
            user = await createUser({
                email,
                name: 'Test User',
                password: 'test123'
            });
        }
        
        if (!user) {
            return json({ error: 'Could not create test user' }, { status: 500 });
        }
        
        // Create session
        const sessionId = createSession(user.id, user.email);

        // Set session cookie
        setSessionCookie(event, sessionId);

        // Redirect to boards page or specific board
        const boardId = url.searchParams.get('boardId');
        const redirectUrl = boardId ? `/board/${boardId}` : '/';
        
        return new Response(null, {
            status: 302,
            headers: {
                Location: redirectUrl
            }
        });
    } catch (error) {
        console.error('Dev login error:', error);
        return json({ error: 'Login failed' }, { status: 500 });
    }
};