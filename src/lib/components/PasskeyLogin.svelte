<script lang="ts">
    import { onMount } from "svelte";
    import Icon from "$lib/components/ui/Icon.svelte";
    import {
        checkPasskeySupport,
        authenticateWithPasskey,
        hasAvailablePasskeys,
    } from "$lib/utils/webauthn.js";

    let passkeySupport = $state({ supported: false, available: false });
    let hasPasskeys = $state(false);
    let loading = $state(true);
    let authenticating = $state(false);
    let error = $state("");

    onMount(async () => {
        try {
            // Check passkey support
            passkeySupport = await checkPasskeySupport();
            console.log(
                "PasskeyLogin: passkey support check result:",
                passkeySupport,
            );

            // Check if there are available passkeys for authentication
            if (passkeySupport.supported) {
                hasPasskeys = await hasAvailablePasskeys();
                console.log(
                    "PasskeyLogin: has available passkeys:",
                    hasPasskeys,
                );
            }
        } catch (err) {
            console.error("Failed to initialize passkey login:", err);
        } finally {
            loading = false;
            console.log(
                "PasskeyLogin: final state - loading:",
                loading,
                "supported:",
                passkeySupport.supported,
                "hasPasskeys:",
                hasPasskeys,
            );
        }
    });

    async function handlePasskeyLogin() {
        authenticating = true;
        error = "";

        try {
            const result = await authenticateWithPasskey();

            if (result.success) {
                // Redirect to dashboard after successful authentication
                window.location.href = "/";
            } else {
                error = result.error || "Authentication failed";
            }
        } catch {
            error = "Authentication failed. Please try again.";
        } finally {
            authenticating = false;
        }
    }

    // Show the component if passkeys are supported and available
    let showPasskeyLogin = $derived(
        !loading && passkeySupport.supported && hasPasskeys,
    );

    // Debug the derived value
    $effect(() => {
        console.log(
            "PasskeyLogin: showPasskeyLogin updated:",
            showPasskeyLogin,
            {
                loading,
                supported: passkeySupport.supported,
                hasPasskeys,
            },
        );
    });
</script>

{#if showPasskeyLogin}
    <div class="passkey-login">
        {#if error}
            <div class="alert alert-error">
                <Icon name="alert" size="sm" />
                {error}
            </div>
        {/if}

        <button
            class="btn-passkey"
            onclick={handlePasskeyLogin}
            disabled={authenticating}
        >
            {#if authenticating}
                <div class="btn-spinner"></div>
                Authenticating...
            {:else}
                <Icon name="fingerprint" size="sm" />
                Sign in with Passkey
            {/if}
        </button>
    </div>
{/if}

<style>
    .passkey-login {
        margin-bottom: var(--spacing-4);
    }

    .btn-passkey {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--spacing-2);
        background: var(--color-secondary);
        color: white;
        border: none;
        padding: var(--spacing-3) var(--spacing-6);
        border-radius: var(--radius-lg);
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        width: 100%;
    }

    .btn-passkey:hover:not(:disabled) {
        background: var(--color-secondary-dark, #5b21b6);
    }

    .btn-passkey:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }

    .btn-spinner {
        width: 1rem;
        height: 1rem;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top: 2px solid white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    .alert {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        padding: var(--spacing-3) var(--spacing-4);
        border-radius: var(--radius-md);
        margin-bottom: var(--spacing-4);
    }

    .alert-error {
        background: var(--status-error-bg);
        color: var(--status-error-text);
    }

    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }
</style>
