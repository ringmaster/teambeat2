import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { verifyPasskeyRegistration } from '$lib/server/auth/webauthn.js';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    // Require authenticated user
    const sessionUser = requireUser({ cookies } as any);

    if (!sessionUser) {
      console.log('WebAuthn registration: No authenticated user');
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('WebAuthn registration complete for user:', sessionUser.userId);

    const body = await request.json();
    const registrationResponse: RegistrationResponseJSON = body;

    if (!registrationResponse) {
      console.log('WebAuthn registration: No registration response provided');
      return json({ error: 'Registration response is required' }, { status: 400 });
    }

    console.log('WebAuthn registration response received:', {
      id: registrationResponse.id,
      type: registrationResponse.type,
      rawId: registrationResponse.rawId ? 'present' : 'missing'
    });

    // Verify the registration
    const verification = await verifyPasskeyRegistration(sessionUser.userId, registrationResponse, request);

    console.log('WebAuthn registration verification result:', {
      verified: verification.verified,
      error: verification.error
    });

    if (verification.verified) {
      return json({
        verified: true,
        authenticatorId: verification.authenticatorId
      });
    } else {
      return json({
        verified: false,
        error: verification.error || 'Registration failed'
      }, { status: 400 });
    }
  } catch (error) {
    console.error('WebAuthn registration complete error:', error);
    return json({ error: 'Failed to complete registration' }, { status: 500 });
  }
};
