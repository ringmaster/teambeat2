<script lang="ts">
    import { onMount } from "svelte";
    import Dashboard from "$lib/components/Dashboard.svelte";
    import Welcome from "$lib/components/Welcome.svelte";

    let user: any = $state(null);
    let loading = $state(true);

    onMount(async () => {
        try {
            const userResponse = await fetch("/api/auth/me");
            if (userResponse.ok) {
                const userData = await userResponse.json();
                user = userData.user;
            }
        } catch (error) {
            console.error("Failed to load user data:", error);
        } finally {
            loading = false;
        }
    });
</script>

{#if loading}
    <div class="loading-page">
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <p class="loading-text">Loading TeamBeat...</p>
        </div>
    </div>
{:else if !user}
    <Welcome />
{:else}
    <Dashboard {user} />
{/if}


<style>
    .loading-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .loading-content {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-4);
    }

    .loading-spinner {
        width: 3rem;
        height: 3rem;
        border: 4px solid var(--input-border);
        border-top: 4px solid var(--color-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }

    .loading-text {
        color: var(--color-text-primary);
        font-weight: 500;
        font-size: 1rem;
        margin: 0;
    }
</style>
