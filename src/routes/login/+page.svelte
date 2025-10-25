<script lang="ts">
import { onMount } from "svelte";
import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import { page } from "$app/stores";
import PasskeyLogin from "$lib/components/PasskeyLogin.svelte";
import Button from "$lib/components/ui/Button.svelte";
import Input from "$lib/components/ui/Input.svelte";

let email: string = $state("");
let password: string = $state("");
let error: string = $state("");
let loading: boolean = $state(false);
let redirectUrl: string = $state("");

// Validate redirect parameter to prevent open redirect attacks
function validateRedirect(redirect: string | null): string {
	if (!redirect) return "";
	// Allow internal paths only (must start with /)
	// This prevents external URLs and XSS attempts
	if (redirect.startsWith("/") && !redirect.startsWith("//")) {
		return redirect;
	}
	return "";
}

// Check if user is already logged in and redirect to dashboard
onMount(async () => {
	// Get and validate redirect URL from query string
	redirectUrl = validateRedirect($page.url.searchParams.get("redirect"));

	try {
		const response = await fetch("/api/auth/me");
		if (response.ok) {
			// User is already authenticated, redirect appropriately
			if (redirectUrl) {
				goto(redirectUrl);
			} else {
				goto(resolve("/"));
			}
		}
	} catch {
		// User not authenticated, show login form
		console.log("User not authenticated, showing login form");
	}
});

async function handleLogin() {
	if (!email || !password) {
		error = "Please fill in all fields";
		return;
	}

	loading = true;
	error = "";

	try {
		const response = await fetch("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		});

		const data = await response.json();

		if (response.ok) {
			// Redirect to requested page or dashboard
			if (redirectUrl) {
				window.location.href = redirectUrl;
			} else {
				window.location.href = "/";
			}
		} else {
			error = data.error || "Login failed";
		}
	} catch {
		error = "Network error. Please try again.";
	} finally {
		loading = false;
	}
}
</script>

<div class="login-page">
    <div class="login-container">
        <!-- Header -->
        <div class="login-header">
            <svg
                class="login-brand-icon"
                aria-hidden="true"
                focusable="false"
                role="img"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 448 512"
            >
                <defs>
                    <linearGradient
                        id="loginBrandGradient"
                        x1="-50%"
                        y1="-50%"
                        x2="150%"
                        y2="150%"
                        gradientUnits="objectBoundingBox"
                    >
                        <stop
                            offset="0%"
                            style="stop-color: var(--avatar-gradient-end);"
                        />
                        <stop
                            offset="50%"
                            style="stop-color: var(--avatar-gradient-start);"
                        />
                        <stop
                            offset="100%"
                            style="stop-color: var(--avatar-gradient-end);"
                        />
                        <animateTransform
                            attributeName="gradientTransform"
                            type="translate"
                            values="0 0; 10 10; 0 0"
                            dur="3s"
                            repeatCount="indefinite"
                        />
                    </linearGradient>
                </defs>
                <path
                    fill="url(#loginBrandGradient)"
                    d="M2.4 238.2C11.7 124.2 108.3 34 224 34c120 0 219.4 97.1 222.2 217.1c0 1.6 .1 3.2 .1 4.7c0 5.3-.2 10.6-.6 15.8c-.8 11.2-2.4 22.1-4.9 33.1l-131.5 0c-8.4 0-15.7-5.8-17.7-13.9l-4.6-18.9L257.6 404.7c-1.7 7.8-8.7 13.4-16.7 13.4c-8-.1-14.8-5.9-16.3-13.7L189.1 216c-.4-2.1-2.2-3.6-4.3-3.6s-4 1.5-4.3 3.6l-16 76c-1.6 7.3-8 12.7-15.6 12.8l-107.4 0c1.8 7 4.1 13.8 6.7 20.5c28.5 72 98.4 119.5 175.8 119.5c72.7 0 138.9-42 170.2-106.8l36.4 0C397.1 421.9 315.2 478 224 478c-95.7 0-181.2-61.8-211.1-152.8c-2.2-6.7-4.1-13.6-5.7-20.5C4.7 293.8 3 282.7 2.2 271.5l129.5 0c1.7 0 3.2-1.2 3.6-2.9l34.1-161.7c1.7-7.9 8.7-13.5 16.7-13.5c8 .1 14.9 5.9 16.3 13.8l35.9 190.8c.4 2.1 2.2 3.6 4.3 3.6c2.1 0 3.9-1.5 4.3-3.5l22.6-102c1.7-7.6 8.4-13.2 16.2-13.4l.3 0c7.7 0 14.5 5.3 16.3 12.9l18.7 76 91.2-.1c.4-5.2 .7-10.3 .7-15.6l0-4.7C410.3 149.2 325.8 66.8 224 66.8c-97.6 0-179.2 75.5-188.2 171.3l-33.4 0z"
                />
            </svg>
            <h2 class="login-title gradient-text">Welcome back</h2>
            <p class="login-subtitle">Sign in to your TeamBeat account</p>
        </div>

        <!-- Form Card -->
        <div class="form-card">
            {#if error}
                <div class="form-error">
                    <svg
                        class="icon-sm status-text-danger"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >
                        <path
                            fill-rule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clip-rule="evenodd"
                        />
                    </svg>
                    <span>{error}</span>
                </div>
            {/if}

            <form
                class="form-group"
                onsubmit={(e) => {
                    e.preventDefault();
                    handleLogin();
                }}
            >
                <div class="form-field">
                    <label for="email" class="form-label"> Email </label>
                    <Input
                        id="email"
                        type="email"
                        bind:value={email}
                        required
                        placeholder="Enter your email"
                        class="auth-input"
                    />
                </div>

                <div class="form-field">
                    <div class="password-label-row">
                        <label for="password" class="form-label"> Password </label>
                        <a href={resolve("/request-password-reset")} class="forgot-password-link">
                            Forgot password?
                        </a>
                    </div>
                    <Input
                        id="password"
                        type="password"
                        bind:value={password}
                        required
                        placeholder="Enter your password"
                        class="auth-input"
                    />
                </div>

                <Button
                    type="submit"
                    disabled={loading}
                    class="login-submit-button"
                    variant="primary"
                >
                    {#if loading}
                        <svg
                            class="loading-spinner icon-sm text-inverted"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle
                                class="pulse-indicator"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                stroke-width="4"
                            ></circle>
                            <path
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                        </svg>
                        <span>Signing in...</span>
                    {:else}
                        <span>Sign In</span>
                    {/if}
                </Button>
            </form>

            <!-- Passkey Login -->
            <hr class="login-divider" />
            <PasskeyLogin />
        </div>

        <!-- Footer -->
        <div class="login-footer">
            <p class="text-muted">
                Don't have an account?
                <a href={resolve(redirectUrl ? `/register?redirect=${encodeURIComponent(redirectUrl)}` : "/register")} class="login-signup-link"
                    >Sign up</a
                >
            </p>
        </div>
    </div>
</div>

<style lang="less">
    @import "$lib/styles/_mixins.less";

    .login-page {
        .page-container();
        justify-content: center;
        padding: 0 var(--spacing-4);
    }

    .login-container {
        width: 100%;
        max-width: 28rem;
        display: flex;
        flex-direction: column;
        gap: var(--spacing-8);
    }

    .login-header {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-4);
    }

    .login-brand-icon {
        width: 4rem;
        height: 4rem;
    }

    .login-title {
        font-size: 1.875rem;
        line-height: 2.25rem;
        font-weight: 700;
        margin: 0;
    }

    .login-subtitle {
        color: var(--color-text-secondary);
        font-size: 1rem;
        margin: 0;
    }

    .form-field {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-2);
    }

    .form-label {
        display: block;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--color-text-secondary);
    }

    .password-label-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .forgot-password-link {
        font-size: 0.875rem;
        color: var(--color-primary);
        text-decoration: none;
        transition: color var(--transition-fast);
    }

    .forgot-password-link:hover {
        color: var(--color-secondary);
        text-decoration: underline;
    }

    :global(.login-submit-button) {
        width: 100%;
    }

    .login-footer {
        text-align: center;
    }

    .login-signup-link {
        font-weight: 600;
        background: linear-gradient(
            to right,
            var(--color-primary),
            var(--color-secondary)
        );
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        text-decoration: none;
        margin-left: var(--spacing-1);
        transition: all var(--transition-fast);
    }

    .login-signup-link:hover {
        background: linear-gradient(
            to right,
            var(--avatar-gradient-start),
            var(--avatar-gradient-end)
        );
        -webkit-background-clip: text;
        background-clip: text;
    }

    .login-divider {
        border: none;
        height: 1px;
        background: var(--color-border);
        margin: var(--spacing-6) 0 var(--spacing-4) 0;
    }
</style>
