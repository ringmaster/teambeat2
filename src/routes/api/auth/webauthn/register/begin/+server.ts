import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { generatePasskeyRegistrationOptions } from '$lib/server/auth/webauthn.js';

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    console.log('WebAuthn registration begin called');

    // Require authenticated user
    const sessionUser = requireUser({ cookies } as any);

    if (!sessionUser) {
      console.log('WebAuthn registration begin: No authenticated user');
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('WebAuthn registration begin for user:', sessionUser.userId);
    console.log('Request origin:', request.headers.get('origin'));

    // Get full user details for proper passkey registration
    const { findUserById } = await import('$lib/server/repositories/user.js');
    const user = await findUserById(sessionUser.userId);

    if (!user) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    // Generate registration options
    const options = await generatePasskeyRegistrationOptions(
      user.id,
      user.email,
      user.name || user.email,
      request
    );

    console.log('WebAuthn registration options generated successfully');
    return json(options);
  } catch (error) {
    console.error('WebAuthn registration begin error:', error);
    console.error('Error details:', error.message, error.stack);
    return json({ error: 'Failed to generate registration options' }, { status: 500 });
  }
};
