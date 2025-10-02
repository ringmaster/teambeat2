<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import Input from "$lib/components/ui/Input.svelte";
    import Button from "$lib/components/ui/Button.svelte";

    let email: string = $state("");
    let name: string = $state("");
    let password: string = $state("");
    let confirmPassword: string = $state("");
    let error: string = $state("");
    let loading: boolean = $state(false);

    // Check if user is already logged in and redirect to dashboard
    onMount(async () => {
        try {
            const response = await fetch("/api/auth/me");
            if (response.ok) {
                // User is already authenticated, redirect to dashboard
                goto("/");
            }
        } catch (err) {
            // User not authenticated, show register form
            console.log("User not authenticated, showing register form");
        }
    });

    async function handleRegister() {
        if (!email || !password) {
            error = "Email and password are required";
            return;
        }

        if (password !== confirmPassword) {
            error = "Passwords do not match";
            return;
        }

        if (password.length < 6) {
            error = "Password must be at least 6 characters";
            return;
        }

        loading = true;
        error = "";

        try {
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    name: name || undefined,
                    password,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                // Force a full page reload to update the authentication state
                window.location.href = "/";
            } else {
                error = data.error || "Registration failed";
            }
        } catch (err) {
            error = "Network error. Please try again.";
        } finally {
            loading = false;
        }
    }
</script>

<div class="register-page">
    <div class="register-container">
        <!-- Header -->
        <div class="register-header">
            <svg
                class="register-brand-icon"
                aria-hidden="true"
                focusable="false"
                role="img"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 448 512"
            >
                <defs>
                    <linearGradient
                        id="registerBrandGradient"
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
                    fill="url(#registerBrandGradient)"
                    d="M2.4 238.2C11.7 124.2 108.3 34 224 34c120 0 219.4 97.1 222.2 217.1c0 1.6 .1 3.2 .1 4.7c0 5.3-.2 10.6-.6 15.8c-.8 11.2-2.4 22.1-4.9 33.1l-131.5 0c-8.4 0-15.7-5.8-17.7-13.9l-4.6-18.9L257.6 404.7c-1.7 7.8-8.7 13.4-16.7 13.4c-8-.1-14.8-5.9-16.3-13.7L189.1 216c-.4-2.1-2.2-3.6-4.3-3.6s-4 1.5-4.3 3.6l-16 76c-1.6 7.3-8 12.7-15.6 12.8l-107.4 0c1.8 7 4.1 13.8 6.7 20.5c28.5 72 98.4 119.5 175.8 119.5c72.7 0 138.9-42 170.2-106.8l36.4 0C397.1 421.9 315.2 478 224 478c-95.7 0-181.2-61.8-211.1-152.8c-2.2-6.7-4.1-13.6-5.7-20.5C4.7 293.8 3 282.7 2.2 271.5l129.5 0c1.7 0 3.2-1.2 3.6-2.9l34.1-161.7c1.7-7.9 8.7-13.5 16.7-13.5c8 .1 14.9 5.9 16.3 13.8l35.9 190.8c.4 2.1 2.2 3.6 4.3 3.6c2.1 0 3.9-1.5 4.3-3.5l22.6-102c1.7-7.6 8.4-13.2 16.2-13.4l.3 0c7.7 0 14.5 5.3 16.3 12.9l18.7 76 91.2-.1c.4-5.2 .7-10.3 .7-15.6l0-4.7C410.3 149.2 325.8 66.8 224 66.8c-97.6 0-179.2 75.5-188.2 171.3l-33.4 0z"
                />
            </svg>
            <h2 class="register-title gradient-text">Get started</h2>
            <p class="register-subtitle">Create your TeamBeat account</p>
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
                    handleRegister();
                }}
            >
                <div>
                    <label for="email" class="form-label">
                        Email <span class="text-red-500">*</span>
                    </label>
                    <Input
                        id="email"
                        type="email"
                        bind:value={email}
                        required
                        placeholder="your@email.com"
                        class="auth-input"
                    />
                </div>

                <div>
                    <label for="name" class="form-label"> Full Name </label>
                    <Input
                        id="name"
                        type="text"
                        bind:value={name}
                        placeholder="Your full name"
                        class="auth-input"
                    />
                </div>

                <div>
                    <label for="password" class="form-label">
                        Password <span class="text-red-500">*</span>
                    </label>
                    <Input
                        id="password"
                        type="password"
                        bind:value={password}
                        required
                        placeholder="Create a password (6+ characters)"
                        class="auth-input"
                    />
                </div>

                <div>
                    <label for="confirmPassword" class="form-label">
                        Confirm Password <span class="text-red-500">*</span>
                    </label>
                    <Input
                        id="confirmPassword"
                        type="password"
                        bind:value={confirmPassword}
                        required
                        placeholder="Confirm your password"
                        class="auth-input"
                    />
                </div>

                <Button
                    type="submit"
                    disabled={loading}
                    class="register-submit-button"
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
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                        </svg>
                        <span>Creating account...</span>
                    {:else}
                        <span>Create Account</span>
                    {/if}
                </Button>
            </form>
        </div>

        <!-- Footer -->
        <div class="register-footer">
            <p class="text-muted">
                Already have an account?
                <a href="/login" class="register-signin-link">Sign in</a>
            </p>
        </div>
    </div>
</div>

<style lang="less">
    @import "$lib/styles/_mixins.less";

    .register-page {
        .page-container();
        background: var(--color-bg-primary);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 var(--spacing-4);
    }

    @media (min-width: 640px) {
        .register-page {
            padding: 0 var(--spacing-6);
        }
    }

    @media (min-width: 1024px) {
        .register-page {
            padding: 0 var(--spacing-8);
        }
    }

    .register-container {
        width: 100%;
        max-width: 28rem;
        display: flex;
        flex-direction: column;
        gap: var(--spacing-8);
    }

    .register-header {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-4);
    }

    .register-brand-icon {
        width: 4rem;
        height: 4rem;
    }

    .register-title {
        font-size: 1.875rem;
        line-height: 2.25rem;
        font-weight: 700;
        margin: 0;
    }

    .register-subtitle {
        color: var(--color-text-secondary);
        font-size: 1rem;
        margin: 0;
    }

    .register-submit-button {
        width: 100%;
        margin-top: var(--spacing-6);
    }

    .register-footer {
        text-align: center;
    }

    .register-signin-link {
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

    .register-signin-link:hover {
        background: linear-gradient(
            to right,
            var(--avatar-gradient-start),
            var(--avatar-gradient-end)
        );
        -webkit-background-clip: text;
        background-clip: text;
    }
</style>
