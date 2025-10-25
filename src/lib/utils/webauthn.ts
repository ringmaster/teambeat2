import type {
	PublicKeyCredentialCreationOptionsJSON,
	PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import {
	browserSupportsWebAuthn,
	platformAuthenticatorIsAvailable,
	startAuthentication,
	startRegistration,
} from "@simplewebauthn/browser";

export interface PasskeySupport {
	supported: boolean;
	available: boolean;
}

/**
 * Check if the browser supports passkeys/WebAuthn
 */
export async function checkPasskeySupport(): Promise<PasskeySupport> {
	const supported = browserSupportsWebAuthn();
	let available = false;

	if (supported) {
		try {
			available = await platformAuthenticatorIsAvailable();
		} catch {
			available = false;
		}
	}

	return { supported, available };
}

/**
 * Register a new passkey for the current user
 */
export async function registerPasskey(): Promise<{
	success: boolean;
	error?: string;
}> {
	try {
		// Check support first
		const support = await checkPasskeySupport();
		if (!support.supported) {
			return {
				success: false,
				error: "WebAuthn is not supported in this browser",
			};
		}

		// Get registration options from server
		const optionsResponse = await fetch("/api/auth/webauthn/register/begin", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
		});

		if (!optionsResponse.ok) {
			const error = await optionsResponse.json();
			return {
				success: false,
				error: error.error || "Failed to start registration",
			};
		}

		const options: PublicKeyCredentialCreationOptionsJSON =
			await optionsResponse.json();

		// Start WebAuthn registration
		const registrationResponse = await startRegistration({
			optionsJSON: options,
		});

		// Send response to server for verification
		const verificationResponse = await fetch(
			"/api/auth/webauthn/register/complete",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(registrationResponse),
			},
		);

		const verificationResult = await verificationResponse.json();

		if (verificationResult.verified) {
			return { success: true };
		} else {
			return {
				success: false,
				error: verificationResult.error || "Registration verification failed",
			};
		}
	} catch (error) {
		console.error("Passkey registration error:", error);

		// Handle user cancellation gracefully
		if (error instanceof Error) {
			if (error.name === "NotAllowedError") {
				return {
					success: false,
					error: "Registration was cancelled or not allowed",
				};
			}
			if (error.name === "InvalidStateError") {
				return { success: false, error: "This device is already registered" };
			}
		}

		return { success: false, error: "Registration failed. Please try again." };
	}
}

/**
 * Authenticate with a passkey
 */
export async function authenticateWithPasskey(email?: string): Promise<{
	success: boolean;
	user?: { id: string; email: string; name: string };
	error?: string;
}> {
	try {
		// Check support first
		const support = await checkPasskeySupport();
		if (!support.supported) {
			return {
				success: false,
				error: "WebAuthn is not supported in this browser",
			};
		}

		// Get authentication options from server
		const optionsResponse = await fetch(
			"/api/auth/webauthn/authenticate/begin",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email }),
			},
		);

		if (!optionsResponse.ok) {
			const error = await optionsResponse.json();
			return {
				success: false,
				error: error.error || "Failed to start authentication",
			};
		}

		const options: PublicKeyCredentialRequestOptionsJSON =
			await optionsResponse.json();

		// Start WebAuthn authentication
		const authenticationResponse = await startAuthentication({
			optionsJSON: options,
		});

		// Send response to server for verification
		const verificationResponse = await fetch(
			"/api/auth/webauthn/authenticate/complete",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					authenticationResponse,
					email,
				}),
			},
		);

		const verificationResult = await verificationResponse.json();

		if (verificationResult.verified) {
			return {
				success: true,
				user: verificationResult.user,
			};
		} else {
			return {
				success: false,
				error: verificationResult.error || "Authentication verification failed",
			};
		}
	} catch (error) {
		console.error("Passkey authentication error:", error);

		// Handle user cancellation gracefully
		if (error instanceof Error) {
			if (error.name === "NotAllowedError") {
				return {
					success: false,
					error: "Authentication was cancelled or not allowed",
				};
			}
			if (error.name === "InvalidStateError") {
				return { success: false, error: "No passkey found for this device" };
			}
		}

		return {
			success: false,
			error: "Authentication failed. Please try again.",
		};
	}
}

/**
 * Check if user has passkeys available for authentication
 */
export async function hasAvailablePasskeys(email?: string): Promise<boolean> {
	try {
		const support = await checkPasskeySupport();

		if (!support.supported) {
			return false;
		}

		// Try to get authentication options - if successful, passkeys are available
		const optionsResponse = await fetch(
			"/api/auth/webauthn/authenticate/begin",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email }),
			},
		);

		return optionsResponse.ok;
	} catch (error) {
		console.error("hasAvailablePasskeys: error occurred:", error);
		return false;
	}
}
