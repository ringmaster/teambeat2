<script lang="ts">
import { onMount } from "svelte";
import { goto } from "$app/navigation";
import { page } from "$app/stores";
import Button from "$lib/components/ui/Button.svelte";

let status: "loading" | "success" | "error" = $state("loading");
let errorMessage: string = $state("");
let token: string = $state("");

onMount(async () => {
	token = $page.url.searchParams.get("token") || "";

	if (!token) {
		status = "error";
		errorMessage = "No verification token provided.";
		return;
	}

	try {
		const response = await fetch("/api/auth/verify-email", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ token }),
		});

		const data = await response.json();

		if (response.ok) {
			status = "success";
		} else {
			status = "error";
			errorMessage = data.error || "Verification failed.";
		}
	} catch (error) {
		status = "error";
		errorMessage = "Network error. Please try again.";
	}
});

function handleContinue() {
	goto("/");
}

function handleResend() {
	goto("/profile");
}
</script>

<div class="verify-page">
    <div class="verify-container">
        <div class="verify-card">
            {#if status === "loading"}
                <div class="status-icon loading">
                    <svg
                        class="loading-spinner"
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
                </div>
                <h1 class="verify-title">Verifying your email...</h1>
                <p class="verify-message">Please wait while we verify your email address.</p>
            {:else if status === "success"}
                <div class="status-icon success">
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
                            d="M5 13l4 4L19 7"
                        />
                    </svg>
                </div>
                <h1 class="verify-title">Email verified!</h1>
                <p class="verify-message">
                    Your email address has been successfully verified. You can now create boards and series.
                </p>
                <Button onclick={handleContinue} variant="primary" class="verify-button">
                    Continue to Dashboard
                </Button>
            {:else}
                <div class="status-icon error">
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
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </div>
                <h1 class="verify-title">Verification failed</h1>
                <p class="verify-message error-text">{errorMessage}</p>
                <div class="button-group">
                    <Button onclick={handleResend} variant="primary" class="verify-button">
                        Request New Link
                    </Button>
                    <Button onclick={handleContinue} variant="secondary" class="verify-button">
                        Go to Dashboard
                    </Button>
                </div>
            {/if}
        </div>
    </div>
</div>

<style lang="less">
    @import "$lib/styles/_mixins.less";

    .verify-page {
        .page-container();
        justify-content: center;
        padding: var(--spacing-4);
    }

    .verify-container {
        width: 100%;
        max-width: 32rem;
    }

    .verify-card {
        .card-surface();
        padding: var(--spacing-10);
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-6);
    }

    .status-icon {
        width: 5rem;
        height: 5rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;

        svg {
            width: 3rem;
            height: 3rem;
        }

        &.loading {
            background-color: var(--color-info-bg);
            color: var(--color-info);

            svg {
                animation: spin 1s linear infinite;
            }
        }

        &.success {
            background-color: var(--color-success-bg);
            color: var(--color-success);
        }

        &.error {
            background-color: var(--color-danger-bg);
            color: var(--color-danger);
        }
    }

    @keyframes spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }

    .verify-title {
        font-size: 1.875rem;
        font-weight: 700;
        margin: 0;
        color: var(--color-text-primary);
    }

    .verify-message {
        font-size: 1rem;
        color: var(--color-text-secondary);
        margin: 0;
        max-width: 28rem;

        &.error-text {
            color: var(--color-danger);
        }
    }

    .button-group {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-3);
        width: 100%;
        max-width: 20rem;
    }

    :global(.verify-button) {
        width: 100%;
    }
</style>
