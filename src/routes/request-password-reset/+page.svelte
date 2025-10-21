<script lang="ts">
    import { goto } from "$app/navigation";
    import Input from "$lib/components/ui/Input.svelte";
    import Button from "$lib/components/ui/Button.svelte";

    let email: string = $state("");
    let loading: boolean = $state(false);
    let submitted: boolean = $state(false);
    let error: string = $state("");

    async function handleSubmit() {
        if (!email) {
            error = "Please enter your email address";
            return;
        }

        loading = true;
        error = "";

        try {
            const response = await fetch("/api/auth/request-password-reset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok || response.status === 429) {
                // Show success for both OK and rate limit (don't reveal email existence)
                if (response.status === 429) {
                    error = data.error;
                } else {
                    submitted = true;
                }
            } else {
                error = data.error || "Failed to send reset email";
            }
        } catch {
            error = "Network error. Please try again.";
        } finally {
            loading = false;
        }
    }

    function handleBackToLogin() {
        goto("/login");
    }
</script>

<div class="reset-request-page">
    <div class="reset-request-container">
        <div class="reset-request-header">
            <h2 class="reset-request-title gradient-text">Reset your password</h2>
            {#if !submitted}
                <p class="reset-request-subtitle">
                    Enter your email address and we'll send you a link to reset your password.
                </p>
            {/if}
        </div>

        <div class="form-card">
            {#if submitted}
                <div class="success-message">
                    <div class="success-icon">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                        </svg>
                    </div>
                    <h3 class="success-title">Check your email</h3>
                    <p class="success-text">
                        If an account exists with that email, we've sent a password reset link.
                        Please check your inbox and spam folder.
                    </p>
                    <p class="success-hint">
                        The link will expire in 1 hour.
                    </p>
                </div>
                <Button onclick={handleBackToLogin} variant="primary" class="full-width-button">
                    Back to Login
                </Button>
            {:else}
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
                        handleSubmit();
                    }}
                >
                    <div class="form-field">
                        <label for="email" class="form-label"> Email address </label>
                        <Input
                            id="email"
                            type="email"
                            bind:value={email}
                            required
                            placeholder="Enter your email"
                            class="auth-input"
                        />
                    </div>

                    <Button
                        type="submit"
                        disabled={loading}
                        class="full-width-button"
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
                            <span>Sending...</span>
                        {:else}
                            <span>Send Reset Link</span>
                        {/if}
                    </Button>
                </form>

                <div class="back-to-login">
                    <a href="/login" class="back-link">
                        <svg
                            class="icon-sm"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M10 19l-7-7m0 0l7-7m-7 7h18"
                            />
                        </svg>
                        Back to login
                    </a>
                </div>
            {/if}
        </div>
    </div>
</div>

<style lang="less">
    @import "$lib/styles/_mixins.less";

    .reset-request-page {
        .page-container();
        justify-content: center;
        padding: 0 var(--spacing-4);
    }

    .reset-request-container {
        width: 100%;
        max-width: 28rem;
        display: flex;
        flex-direction: column;
        gap: var(--spacing-8);
    }

    .reset-request-header {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-4);
    }

    .reset-request-title {
        font-size: 1.875rem;
        line-height: 2.25rem;
        font-weight: 700;
        margin: 0;
    }

    .reset-request-subtitle {
        color: var(--color-text-secondary);
        font-size: 1rem;
        margin: 0;
        max-width: 24rem;
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

    :global(.full-width-button) {
        width: 100%;
    }

    .back-to-login {
        text-align: center;
        margin-top: var(--spacing-4);
    }

    .back-link {
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-2);
        color: var(--color-text-secondary);
        text-decoration: none;
        font-size: 0.875rem;
        transition: color var(--transition-fast);

        &:hover {
            color: var(--color-primary);
        }
    }

    .success-message {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-4);
        padding: var(--spacing-6) 0;
    }

    .success-icon {
        width: 4rem;
        height: 4rem;
        border-radius: 50%;
        background-color: var(--color-success-bg);
        color: var(--color-success);
        display: flex;
        align-items: center;
        justify-content: center;

        svg {
            width: 2rem;
            height: 2rem;
        }
    }

    .success-title {
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0;
        color: var(--color-text-primary);
    }

    .success-text {
        font-size: 1rem;
        color: var(--color-text-secondary);
        margin: 0;
        max-width: 24rem;
    }

    .success-hint {
        font-size: 0.875rem;
        color: var(--color-text-tertiary);
        margin: 0;
    }
</style>
