import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON
} from '@simplewebauthn/server';
import { db } from '../db/index.js';
import { userAuthenticators, users } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// WebAuthn configuration
const rpName = 'TeamBeat';
const rpID = 'localhost'; // In production, set this to your actual domain

// Dynamic configuration - determine from request
function getExpectedOrigin(request?: Request): string | string[] {
  // If we have a request, use its origin
  if (request && request.headers.get('origin')) {
    const requestOrigin = request.headers.get('origin')!;
    console.log('Using request origin for WebAuthn:', requestOrigin);
    return requestOrigin;
  }

  // For development, support common ports
  if (process.env.NODE_ENV === 'development') {
    console.log('Using development origins for WebAuthn');
    return ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];
  }

  // For production, use environment variable or default
  const prodOrigin = process.env.WEBAUTHN_ORIGIN || 'https://your-domain.com';
  console.log('Using production origin for WebAuthn:', prodOrigin);
  return prodOrigin;
}

function getExpectedRPID(request?: Request): string {
  // If we have a request, extract hostname from origin
  if (request && request.headers.get('origin')) {
    const requestOrigin = request.headers.get('origin')!;
    try {
      const url = new URL(requestOrigin);
      console.log('Using hostname from request for rpID:', url.hostname);
      return url.hostname;
    } catch (error) {
      console.error('Failed to parse origin URL:', error);
    }
  }

  // Default to localhost for development
  console.log('Using default rpID: localhost');
  return 'localhost';
}

export interface ChallengeStore {
  [userId: string]: string;
}

// In-memory challenge storage (use Redis in production)
const registrationChallenges: ChallengeStore = {};
const authenticationChallenges: ChallengeStore = {};

/**
 * Generate registration options for a new passkey
 */
export async function generatePasskeyRegistrationOptions(userId: string, userName: string, userDisplayName: string, request?: Request) {
  console.log('generatePasskeyRegistrationOptions called with:', { userId, userName, userDisplayName });

  try {
    // Get existing authenticators for this user
    console.log('Fetching existing authenticators for user:', userId);
    const existingAuthenticators = await db
      .select()
      .from(userAuthenticators)
      .where(eq(userAuthenticators.userId, userId));

    console.log('Found existing authenticators:', existingAuthenticators.length);

    const excludeCredentials = existingAuthenticators.map(auth => ({
      id: auth.credentialId,
      type: 'public-key' as const,
      transports: auth.transports ? JSON.parse(auth.transports) : undefined
    }));

    console.log('Exclude credentials:', excludeCredentials.length);
    console.log('Generating WebAuthn registration options with:', {
      rpName,
      rpID,
      userName,
      userDisplayName,
      excludeCredentialsCount: excludeCredentials.length
    });

    const options = await generateRegistrationOptions({
      rpName,
      rpID: getExpectedRPID(request),
      userID: new Uint8Array(Buffer.from(userId)),
      userName,
      userDisplayName,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform'
      },
      supportedAlgorithmIDs: [-7, -257] // ES256 and RS256
    });

    console.log('WebAuthn registration options generated, challenge:', options.challenge.substring(0, 20) + '...');

    // Store the challenge
    registrationChallenges[userId] = options.challenge;

    console.log('Challenge stored for user:', userId);
    return options;
  } catch (error) {
    console.error('Error in generatePasskeyRegistrationOptions:', error);
    throw error;
  }
}

/**
 * Verify passkey registration response
 */
export async function verifyPasskeyRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  request?: Request
): Promise<{ verified: boolean; authenticatorId?: string; error?: string }> {
  console.log('WebAuthn verification starting for userId:', userId);
  console.log('Available challenges:', Object.keys(registrationChallenges));

  const expectedChallenge = registrationChallenges[userId];
  if (!expectedChallenge) {
    console.log('No registration challenge found for userId:', userId);
    return { verified: false, error: 'No registration challenge found' };
  }

  console.log('Expected challenge found, proceeding with verification');
  console.log('Verification params:', {
    expectedOrigin: getExpectedOrigin(request),
    expectedRPID: rpID,
    responseId: response.id
  });

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: getExpectedOrigin(request),
      expectedRPID: getExpectedRPID(request),
      requireUserVerification: false
    });

    if (verification.verified && verification.registrationInfo) {
      const { registrationInfo } = verification;

      console.log('Registration info credential.id:', registrationInfo.credential.id);
      console.log('Response.id:', response.id);
      console.log('Response.rawId:', response.rawId);

      // Store the authenticator using the correct format from registrationInfo
      const authenticatorId = uuidv4();
      await db.insert(userAuthenticators).values({
        id: authenticatorId,
        userId,
        credentialId: response.id,
        credentialPublicKey: Buffer.from(registrationInfo.credential.publicKey).toString('base64url'),
        counter: registrationInfo.counter,
        credentialDeviceType: registrationInfo.credentialDeviceType || 'singleDevice',
        credentialBackedUp: registrationInfo.credentialBackedUp || false,
        transports: response.response.transports ? JSON.stringify(response.response.transports) : null
      });

      // Clean up the challenge
      delete registrationChallenges[userId];

      console.log('Registration verification successful, authenticatorId:', authenticatorId);
      return { verified: true, authenticatorId };
    }

    console.log('Registration verification failed - verification not verified');
    return { verified: false, error: 'Registration verification failed' };
  } catch (error) {
    console.error('WebAuthn registration verification error:', error);
    return { verified: false, error: `Verification failed: ${error.message || error}` };
  }
}

/**
 * Generate authentication options for passkey login
 */
export async function generatePasskeyAuthenticationOptions(userEmail?: string, request?: Request) {
  console.log('generatePasskeyAuthenticationOptions called with email:', userEmail || 'none');

  let allowCredentials;

  if (userEmail) {
    console.log('Email provided, looking up user and their authenticators');
    // Get user's authenticators if email provided
    const user = await db.select().from(users).where(eq(users.email, userEmail)).limit(1);
    console.log('Found user:', user.length > 0 ? 'yes' : 'no');

    if (user.length > 0) {
      const userAuths = await db
        .select()
        .from(userAuthenticators)
        .where(eq(userAuthenticators.userId, user[0].id));

      console.log('User has authenticators:', userAuths.length);

      allowCredentials = userAuths.map(auth => ({
        id: auth.credentialId,
        transports: auth.transports ? JSON.parse(auth.transports) : undefined
      }));
    }
  } else {
    console.log('No email provided, will allow any registered passkeys');
    // If no email provided, don't restrict allowCredentials
    // This allows any registered passkey to be used for authentication
    allowCredentials = undefined;
  }

  console.log('Generating authentication options with allowCredentials:', allowCredentials ? allowCredentials.length : 'none');

  const options = await generateAuthenticationOptions({
    rpID: getExpectedRPID(request),
    allowCredentials,
    userVerification: 'preferred'
  });

  // Store challenge with a temporary key since we might not have a user ID yet
  const challengeKey = userEmail || 'anonymous';
  authenticationChallenges[challengeKey] = options.challenge;

  console.log('Authentication options generated, challenge stored with key:', challengeKey);
  return options;
}

/**
 * Verify passkey authentication response
 */
export async function verifyPasskeyAuthentication(
  response: AuthenticationResponseJSON,
  userEmail?: string,
  request?: Request
): Promise<{ verified: boolean; user?: any; error?: string }> {
  const challengeKey = userEmail || 'anonymous';
  const expectedChallenge = authenticationChallenges[challengeKey];

  console.log('Challenge lookup - key:', challengeKey);
  console.log('Available challenges:', Object.keys(authenticationChallenges));
  console.log('Expected challenge found:', expectedChallenge ? 'yes' : 'no');

  if (!expectedChallenge) {
    return { verified: false, error: 'No authentication challenge found' };
  }

  try {
    // Find the authenticator by credential ID
    console.log('=== AUTHENTICATION DEBUG START ===');
    console.log('Raw response.rawId:', response.rawId);
    console.log('Raw response.id:', response.id);

    // Get all credential IDs from database first
    const allCreds = await db.select({ credentialId: userAuthenticators.credentialId }).from(userAuthenticators);
    console.log('All credential IDs in database:', allCreds.map(c => c.credentialId));

    // Find the authenticator by credential ID using correct format
    const credentialIdToFind = response.id;

    console.log('Looking for credentialId:', credentialIdToFind);

    const authenticatorResult = await db
      .select()
      .from(userAuthenticators)
      .where(eq(userAuthenticators.credentialId, credentialIdToFind))
      .limit(1);

    console.log('Found authenticators:', authenticatorResult.length);

    if (authenticatorResult.length === 0) {
      console.log('=== NO MATCH FOUND ===');
      console.log('Searched for credentialId:', credentialIdToFind);
      console.log('Database contains:', allCreds.map(c => c.credentialId));
      return { verified: false, error: 'Authenticator not found' };
    }

    const authenticator = authenticatorResult[0];
    console.log('Using authenticator for user:', authenticator.userId);

    // Get the user
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, authenticator.userId))
      .limit(1);

    if (userResult.length === 0) {
      return { verified: false, error: 'User not found' };
    }

    const user = userResult[0];
    console.log('Found user:', user.email);

    console.log('Authenticator found:', authenticator.id);

    // Create authenticator object in the format expected by verifyAuthenticationResponse
    const authenticatorDevice = {
      credentialID: new Uint8Array(Buffer.from(authenticator.credentialId, 'base64url')),
      credentialPublicKey: new Uint8Array(Buffer.from(authenticator.credentialPublicKey, 'base64url')),
      counter: authenticator.counter || 0,
      transports: authenticator.transports ? JSON.parse(authenticator.transports) : []
    };

    console.log('Authenticator device prepared:', {
      credentialID: authenticatorDevice.credentialID.length + ' bytes',
      credentialPublicKey: authenticatorDevice.credentialPublicKey.length + ' bytes',
      counter: authenticatorDevice.counter,
      transports: authenticatorDevice.transports
    });

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: getExpectedOrigin(request),
      expectedRPID: getExpectedRPID(request),
      credential: {
        id: authenticatorDevice.credentialID,
        publicKey: authenticatorDevice.credentialPublicKey,
        counter: authenticatorDevice.counter,
        transports: authenticatorDevice.transports || []
      },
      requireUserVerification: false
    });

    if (verification.verified) {
      // Update counter after successful authentication
      if (verification.authenticationInfo) {
        await db
          .update(userAuthenticators)
          .set({ counter: verification.authenticationInfo.newCounter })
          .where(eq(userAuthenticators.id, authenticator.id));
      }

      // Clean up challenge
      delete authenticationChallenges[challengeKey];

      return { verified: true, user };
    }

    return { verified: false, error: 'Authentication verification failed' };
  } catch (error) {
    console.error('WebAuthn authentication verification error:', error);
    return { verified: false, error: 'Verification failed' };
  }
}

/**
 * Get user's registered authenticators
 */
export async function getUserAuthenticators(userId: string) {
  return await db
    .select({
      id: userAuthenticators.id,
      credentialId: userAuthenticators.credentialId,
      credentialDeviceType: userAuthenticators.credentialDeviceType,
      credentialBackedUp: userAuthenticators.credentialBackedUp,
      transports: userAuthenticators.transports,
      createdAt: userAuthenticators.createdAt
    })
    .from(userAuthenticators)
    .where(eq(userAuthenticators.userId, userId));
}

/**
 * Delete a user's authenticator
 */
export async function deleteUserAuthenticator(userId: string, authenticatorId: string) {
  const result = await db
    .delete(userAuthenticators)
    .where(
      and(
        eq(userAuthenticators.id, authenticatorId),
        eq(userAuthenticators.userId, userId)
      )
    );

  return result.changes > 0;
}

/**
 * Check if user has any passkeys
 */
export async function userHasPasskeys(userId: string): Promise<boolean> {
  const result = await db
    .select()
    .from(userAuthenticators)
    .where(eq(userAuthenticators.userId, userId))
    .limit(1);

  return result.length > 0;
}
