import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { json } from "@sveltejs/kit";
import { setSessionCookie } from "$lib/server/auth/index.js";
import { createSession } from "$lib/server/auth/session.js";
import { verifyPasskeyAuthentication } from "$lib/server/auth/webauthn.js";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const body = await request.json();
		const { authenticationResponse, email } = body;

		if (!authenticationResponse) {
			return json(
				{ error: "Authentication response is required" },
				{ status: 400 },
			);
		}

		// Verify the authentication
		const verification = await verifyPasskeyAuthentication(
			authenticationResponse as AuthenticationResponseJSON,
			email,
			request,
		);

		if (verification.verified && verification.user) {
			// Create session
			const sessionId = createSession(
				verification.user.id,
				verification.user.email,
			);

			// Set session cookie
			setSessionCookie({ cookies } as any, sessionId);

			return json({
				verified: true,
				user: {
					id: verification.user.id,
					email: verification.user.email,
					name: verification.user.name,
				},
			});
		} else {
			return json(
				{
					verified: false,
					error: verification.error || "Authentication failed",
				},
				{ status: 400 },
			);
		}
	} catch (error) {
		console.error("WebAuthn authentication complete error:", error);
		return json(
			{ error: "Failed to complete authentication" },
			{ status: 500 },
		);
	}
};
