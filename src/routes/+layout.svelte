<script lang="ts">
    import { onMount } from "svelte";
    import "../app.less";
    import Avatar from "$lib/components/ui/Avatar.svelte";

    let user: any = $state(null);
    let loading = $state(true);
    let mobileMenuOpen = $state(false);
    let { children } = $props();

    onMount(async () => {
        try {
            const response = await fetch("/api/auth/me");
            if (response.ok) {
                const data = await response.json();
                user = data.user;
            }
        } catch (error) {
            console.error("Failed to check authentication:", error);
        } finally {
            loading = false;
        }
    });
</script>

<svelte:head>
    <title>TeamBeat - Collaborative Retrospectives</title>
</svelte:head>

<div class="app-layout">
    <!-- Navigation -->
    <nav class="glass-effect sticky-header">
        <div class="page-container">
            <div class="header-layout">
                <div class="button-group">
                    <a href="/" class="nav-brand">
                        <svg
                            class="teambeat-logo"
                            aria-hidden="true"
                            focusable="false"
                            role="img"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 448 512"
                        >
                            <path
                                fill="currentColor"
                                d="M2.4 238.2C11.7 124.2 108.3 34 224 34c120 0 219.4 97.1 222.2 217.1c0 1.6 .1 3.2 .1 4.7c0 5.3-.2 10.6-.6 15.8c-.8 11.2-2.4 22.1-4.9 33.1l-131.5 0c-8.4 0-15.7-5.8-17.7-13.9l-4.6-18.9L257.6 404.7c-1.7 7.8-8.7 13.4-16.7 13.4c-8-.1-14.8-5.9-16.3-13.7L189.1 216c-.4-2.1-2.2-3.6-4.3-3.6s-4 1.5-4.3 3.6l-16 76c-1.6 7.3-8 12.7-15.6 12.8l-107.4 0c1.8 7 4.1 13.8 6.7 20.5c28.5 72 98.4 119.5 175.8 119.5c72.7 0 138.9-42 170.2-106.8l36.4 0C397.1 421.9 315.2 478 224 478c-95.7 0-181.2-61.8-211.1-152.8c-2.2-6.7-4.1-13.6-5.7-20.5C4.7 293.8 3 282.7 2.2 271.5l129.5 0c1.7 0 3.2-1.2 3.6-2.9l34.1-161.7c1.7-7.9 8.7-13.5 16.7-13.5c8 .1 14.9 5.9 16.3 13.8l35.9 190.8c.4 2.1 2.2 3.6 4.3 3.6c2.1 0 3.9-1.5 4.3-3.5l22.6-102c1.7-7.6 8.4-13.2 16.2-13.4l.3 0c7.7 0 14.5 5.3 16.3 12.9l18.7 76 91.2-.1c.4-5.2 .7-10.3 .7-15.6l0-4.7C410.3 149.2 325.8 66.8 224 66.8c-97.6 0-179.2 75.5-188.2 171.3l-33.4 0z"
                            />
                        </svg>
                        <span class="nav-brand-text">TeamBeat</span>
                    </a>
                </div>

                <!-- Desktop Navigation -->
                <div class="desktop-nav toolbar">
                    {#if loading}
                        <div class="button-group">
                            <div
                                class="icon-sm brand-surface-indigo loading-spinner"
                            ></div>
                            <div
                                class="icon-sm brand-surface-purple pulse-indicator staggered-animation-1"
                            ></div>
                            <div
                                class="icon-sm brand-surface-pink bounce-indicator staggered-animation-2"
                            ></div>
                        </div>
                    {:else if user}
                        <div class="toolbar">
                            <a
                                href="/"
                                class="text-interactive text-muted text-medium"
                                >Dashboard</a
                            >
                            <div class="toolbar">
                                <div class="button-group">
                                    <Avatar
                                        name={user.name}
                                        email={user.email}
                                    />
                                    <span class="text-secondary text-medium"
                                        >{user.name || user.email}</span
                                    >
                                </div>
                                <button
                                    class="btn-secondary"
                                    onclick={async () => {
                                        await fetch("/api/auth/logout", {
                                            method: "POST",
                                        });
                                        window.location.reload();
                                    }}
                                >
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    {:else}
                        <a href="/login" class="btn-secondary">Sign In</a>
                        <a href="/register" class="btn-primary">Register</a>
                    {/if}
                </div>

                <!-- Mobile menu button -->
                <div class="mobile-nav">
                    <button
                        onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
                        class="text-interactive text-muted"
                        style="padding: var(--spacing-2); background: none; border: none; cursor: pointer;"
                    >
                        <svg
                            class="icon-md"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            {#if mobileMenuOpen}
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            {:else}
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M4 6h16M4 12h16M4 18h16"
                                />
                            {/if}
                        </svg>
                    </button>
                </div>
            </div>
        </div>

        <!-- Mobile menu -->
        {#if mobileMenuOpen}
            <div class="mobile-nav slide-in-animation">
                <div class="form-group responsive-container">
                    {#if loading}
                        <div class="text-centered">Loading...</div>
                    {:else if user}
                        <div class="button-group surface-muted">
                            <Avatar name={user.name} email={user.email} />
                            <span class="text-secondary text-medium"
                                >{user.name || user.email}</span
                            >
                        </div>
                        <a
                            href="/"
                            class="text-interactive text-muted text-medium"
                            >Dashboard</a
                        >
                        <button
                            class="full-width status-text-danger text-medium"
                            onclick={async () => {
                                await fetch("/api/auth/logout", {
                                    method: "POST",
                                });
                                window.location.reload();
                            }}
                        >
                            Sign Out
                        </button>
                    {:else}
                        <a href="/login" class="btn-secondary full-width"
                            >Sign In</a
                        >
                        <a href="/register" class="btn-primary full-width"
                            >Register</a
                        >
                    {/if}
                </div>
            </div>
        {/if}
    </nav>

    <main class="main-content">
        {@render children?.()}
    </main>

    <!-- Footer -->
    <footer class="app-footer">
        <div class="page-container">
            <div class="footer-content">
                <div class="footer-left">
                    <svg
                        class="teambeat-logo"
                        aria-hidden="true"
                        focusable="false"
                        role="img"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 448 512"
                    >
                        <path
                            fill="currentColor"
                            d="M2.4 238.2C11.7 124.2 108.3 34 224 34c120 0 219.4 97.1 222.2 217.1c0 1.6 .1 3.2 .1 4.7c0 5.3-.2 10.6-.6 15.8c-.8 11.2-2.4 22.1-4.9 33.1l-131.5 0c-8.4 0-15.7-5.8-17.7-13.9l-4.6-18.9L257.6 404.7c-1.7 7.8-8.7 13.4-16.7 13.4c-8-.1-14.8-5.9-16.3-13.7L189.1 216c-.4-2.1-2.2-3.6-4.3-3.6s-4 1.5-4.3 3.6l-16 76c-1.6 7.3-8 12.7-15.6 12.8l-107.4 0c1.8 7 4.1 13.8 6.7 20.5c28.5 72 98.4 119.5 175.8 119.5c72.7 0 138.9-42 170.2-106.8l36.4 0C397.1 421.9 315.2 478 224 478c-95.7 0-181.2-61.8-211.1-152.8c-2.2-6.7-4.1-13.6-5.7-20.5C4.7 293.8 3 282.7 2.2 271.5l129.5 0c1.7 0 3.2-1.2 3.6-2.9l34.1-161.7c1.7-7.9 8.7-13.5 16.7-13.5c8 .1 14.9 5.9 16.3 13.8l35.9 190.8c.4 2.1 2.2 3.6 4.3 3.6c2.1 0 3.9-1.5 4.3-3.5l22.6-102c1.7-7.6 8.4-13.2 16.2-13.4l.3 0c7.7 0 14.5 5.3 16.3 12.9l18.7 76 91.2-.1c.4-5.2 .7-10.3 .7-15.6l0-4.7C410.3 149.2 325.8 66.8 224 66.8c-97.6 0-179.2 75.5-188.2 171.3l-33.4 0z"
                        />
                    </svg>
                    <span class="footer-copyright"
                        >© {new Date().getFullYear()} TeamBeat. Built for better
                        retrospectives.</span
                    >
                </div>
                <div class="footer-right">
                    <a href="/privacy" class="footer-link">Privacy</a>
                    <a href="/terms" class="footer-link">Terms</a>
                    <a href="/support" class="footer-link">Support</a>
                </div>
            </div>
        </div>
    </footer>
</div>

<style>
    .teambeat-logo {
        width: 1.5em;
        height: 1.5em;
        margin-right: 0.5em;
        vertical-align: middle;
        color: var(--title-bar-color);
    }
</style>
