import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generatePasskeyAuthenticationOptions } from '$lib/server/auth/webauthn.js';

export const POST: RequestHandler = async ({ request }) => {
  try {
    console.log('WebAuthn authentication begin called');

    const body = await request.json();
    const { email } = body;

    console.log('WebAuthn authentication begin - email provided:', email || 'none');

    // Generate authentication options
    // Email is optional - if not provided, allows any registered passkey
    const options = await generatePasskeyAuthenticationOptions(email, request);

    console.log('WebAuthn authentication options generated successfully');
    return json(options);
  } catch (error) {
    console.error('WebAuthn authentication begin error:', error);
    console.error('Error details:', error.message, error.stack);
    return json({ error: 'Failed to generate authentication options' }, { status: 500 });
  }
};
