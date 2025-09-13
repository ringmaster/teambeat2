<script lang="ts">
    import { onMount } from "svelte";
    import Icon from "$lib/components/ui/Icon.svelte";
    import {
        checkPasskeySupport,
        registerPasskey,
    } from "$lib/utils/webauthn.js";

    let passkeySupport = $state({ supported: false, available: false });
    let loading = $state(true);
    let registering = $state(false);
    let userPasskeys: any[] = $state([]);
    let message = $state("");
    let error = $state("");

    onMount(async () => {
        try {
            // Check passkey support
            passkeySupport = await checkPasskeySupport();

            // Load user's existing passkeys
            if (passkeySupport.supported) {
                await loadUserPasskeys();
            }
        } catch (err) {
            console.error("Failed to initialize passkey manager:", err);
            error = "Failed to load passkey information";
        } finally {
            loading = false;
        }
    });

    async function loadUserPasskeys() {
        try {
            const response = await fetch("/api/auth/webauthn/passkeys");
            if (response.ok) {
                const data = await response.json();
                userPasskeys = data.passkeys || [];
            }
        } catch (err) {
            console.error("Failed to load passkeys:", err);
        }
    }

    async function handleRegisterPasskey() {
        registering = true;
        error = "";
        message = "";

        try {
            const result = await registerPasskey();

            if (result.success) {
                message = "Passkey registered successfully!";
                await loadUserPasskeys();
            } else {
                error = result.error || "Failed to register passkey";
            }
        } catch {
            error = "Failed to register passkey";
        } finally {
            registering = false;
        }
    }

    async function deletePasskey(passkeyId: string) {
        try {
            const response = await fetch(
                `/api/auth/webauthn/passkeys/${passkeyId}`,
                {
                    method: "DELETE",
                },
            );

            if (response.ok) {
                message = "Passkey deleted successfully";
                await loadUserPasskeys();
            } else {
                const data = await response.json();
                error = data.error || "Failed to delete passkey";
            }
        } catch {
            error = "Failed to delete passkey";
        }
    }

    function formatDate(dateString: string) {
        return new Date(dateString).toLocaleDateString();
    }
</script>

<div class="passkey-manager">
    <h2 class="section-title">Passkeys</h2>

    {#if message}
        <div class="alert alert-success">
            <Icon name="check" size="sm" />
            {message}
        </div>
    {/if}

    {#if error}
        <div class="alert alert-error">
            <Icon name="alert" size="sm" />
            {error}
        </div>
    {/if}

    {#if loading}
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p class="loading-text">Loading passkey information...</p>
        </div>
    {:else if !passkeySupport.supported}
        <div class="passkey-not-supported">
            <Icon name="alert" size="lg" />
            <h3>Passkeys Not Supported</h3>
            <p>
                Your browser doesn't support passkeys. Please use a modern
                browser like Chrome, Safari, Firefox, or Edge.
            </p>
        </div>
    {:else if !passkeySupport.available}
        <div class="passkey-not-available">
            <Icon name="info" size="lg" />
            <h3>Platform Authenticator Not Available</h3>
            <p>
                Your device doesn't support platform authentication (Touch ID,
                Face ID, Windows Hello, etc.). You may still be able to use
                external security keys.
            </p>
            <button
                class="btn-primary"
                onclick={handleRegisterPasskey}
                disabled={registering}
            >
                {registering ? "Registering..." : "Try Adding Passkey"}
            </button>
        </div>
    {:else}
        <div class="passkey-content">
            <div class="passkey-info">
                <Icon name="shield" size="lg" />
                <div class="info-text">
                    <h3>Secure Login with Passkeys</h3>
                    <p>
                        Passkeys provide a more secure and convenient way to
                        sign in. Use your fingerprint, face, or device PIN
                        instead of passwords.
                    </p>
                </div>
            </div>

            {#if userPasskeys.length > 0}
                <div class="existing-passkeys">
                    <h4>Your Passkeys</h4>
                    <div class="passkey-list">
                        {#each userPasskeys as passkey (passkey.id)}
                            <div class="passkey-item">
                                <div class="passkey-details">
                                    <Icon name="key" size="sm" />
                                    <div class="passkey-meta">
                                        <span class="passkey-type">
                                            {passkey.credentialDeviceType ===
                                            "singleDevice"
                                                ? "Platform Authenticator"
                                                : "Cross-Platform Authenticator"}
                                        </span>
                                        <span class="passkey-date"
                                            >Added {formatDate(
                                                passkey.createdAt,
                                            )}</span
                                        >
                                    </div>
                                </div>
                                <button
                                    class="btn-danger-outline btn-sm"
                                    onclick={() => deletePasskey(passkey.id)}
                                    title="Delete this passkey"
                                >
                                    <Icon name="trash" size="xs" />
                                </button>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            <div class="add-passkey">
                <button
                    class="btn-primary"
                    onclick={handleRegisterPasskey}
                    disabled={registering}
                >
                    {registering ? "Adding..." : "Add New Passkey"}
                </button>
                <p class="add-passkey-help">
                    You can add multiple passkeys for different devices or
                    backup options.
                </p>
            </div>
        </div>
    {/if}
</div>

<style>
    .passkey-manager {
        background: white;
        border-radius: var(--radius-lg);
        padding: var(--spacing-6);
        box-shadow: var(--shadow-sm);
        margin-bottom: var(--spacing-6);
    }

    .section-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--color-text-primary);
        margin-bottom: var(--spacing-4);
    }

    .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-3);
        padding: var(--spacing-8);
    }

    .loading-spinner {
        width: 2rem;
        height: 2rem;
        border: 3px solid var(--input-border);
        border-top: 3px solid var(--color-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    .loading-text {
        color: var(--color-text-secondary);
        font-size: 0.875rem;
    }

    .passkey-not-supported,
    .passkey-not-available {
        text-align: center;
        padding: var(--spacing-8);
        color: var(--color-text-secondary);
    }

    .passkey-not-supported h3,
    .passkey-not-available h3 {
        margin: var(--spacing-3) 0;
        color: var(--color-text-primary);
    }

    .passkey-info {
        display: flex;
        align-items: flex-start;
        gap: var(--spacing-4);
        margin-bottom: var(--spacing-6);
        padding: var(--spacing-4);
        background: var(--color-bg-secondary);
        border-radius: var(--radius-md);
    }

    .info-text h3 {
        margin: 0 0 var(--spacing-2) 0;
        color: var(--color-text-primary);
        font-size: 1rem;
    }

    .info-text p {
        margin: 0;
        color: var(--color-text-secondary);
        font-size: 0.875rem;
    }

    .existing-passkeys {
        margin-bottom: var(--spacing-6);
    }

    .existing-passkeys h4 {
        margin: 0 0 var(--spacing-3) 0;
        color: var(--color-text-primary);
        font-size: 1rem;
        font-weight: 600;
    }

    .passkey-list {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-2);
    }

    .passkey-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--spacing-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-bg-primary);
    }

    .passkey-details {
        display: flex;
        align-items: center;
        gap: var(--spacing-3);
    }

    .passkey-meta {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-1);
    }

    .passkey-type {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text-primary);
    }

    .passkey-date {
        font-size: 0.75rem;
        color: var(--color-text-muted);
    }

    .add-passkey {
        text-align: center;
    }

    .add-passkey-help {
        margin-top: var(--spacing-2);
        color: var(--color-text-secondary);
        font-size: 0.875rem;
    }

    .alert {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        padding: var(--spacing-3) var(--spacing-4);
        border-radius: var(--radius-md);
        margin-bottom: var(--spacing-4);
    }

    .alert-success {
        background: var(--status-success-bg);
        color: var(--status-success-text);
    }

    .alert-error {
        background: var(--status-error-bg);
        color: var(--status-error-text);
    }

    .btn-sm {
        padding: var(--spacing-1) var(--spacing-2);
        font-size: 0.75rem;
    }

    .btn-danger-outline {
        background: transparent;
        border: 1px solid var(--color-danger);
        color: var(--color-danger);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn-danger-outline:hover {
        background: var(--color-danger);
        color: white;
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
