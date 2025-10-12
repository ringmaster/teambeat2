<script lang="ts">
    interface Props {
        name: string;
        size?: "xs" | "sm" | "md" | "lg" | "xl";
        class?: string;
        color?:
            | "primary"
            | "secondary"
            | "danger"
            | "warning"
            | "success"
            | "muted";
        circle?: boolean;
    }

    let {
        name,
        size = "md",
        class: className = "",
        color,
        circle = false,
    }: Props = $props();

    let iconClass = $derived.by(() => {
        let classes = ["icon", `icon-${size}`];

        if (circle) {
            classes.push("icon-circle");
        }

        if (color) {
            classes.push(`status-text-${color}`);
        }

        if (className) {
            classes.push(className);
        }

        return classes.join(" ");
    });

    // Icon path definitions - common icons used in the app
    const iconPaths = {
        teambeat:
            "M2.4 238.2C11.7 124.2 108.3 34 224 34c120 0 219.4 97.1 222.2 217.1c0 1.6 .1 3.2 .1 4.7c0 5.3-.2 10.6-.6 15.8c-.8 11.2-2.4 22.1-4.9 33.1l-131.5 0c-8.4 0-15.7-5.8-17.7-13.9l-4.6-18.9L257.6 404.7c-1.7 7.8-8.7 13.4-16.7 13.4c-8-.1-14.8-5.9-16.3-13.7L189.1 216c-.4-2.1-2.2-3.6-4.3-3.6s-4 1.5-4.3 3.6l-16 76c-1.6 7.3-8 12.7-15.6 12.8l-107.4 0c1.8 7 4.1 13.8 6.7 20.5c28.5 72 98.4 119.5 175.8 119.5c72.7 0 138.9-42 170.2-106.8l36.4 0C397.1 421.9 315.2 478 224 478c-95.7 0-181.2-61.8-211.1-152.8c-2.2-6.7-4.1-13.6-5.7-20.5C4.7 293.8 3 282.7 2.2 271.5l129.5 0c1.7 0 3.2-1.2 3.6-2.9l34.1-161.7c1.7-7.9 8.7-13.5 16.7-13.5c8 .1 14.9 5.9 16.3 13.8l35.9 190.8c.4 2.1 2.2 3.6 4.3 3.6c2.1 0 3.9-1.5 4.3-3.5l22.6-102c1.7-7.6 8.4-13.2 16.2-13.4l.3 0c7.7 0 14.5 5.3 16.3 12.9l18.7 76 91.2-.1c.4-5.2 .7-10.3 .7-15.6l0-4.7C410.3 149.2 325.8 66.8 224 66.8c-97.6 0-179.2 75.5-188.2 171.3l-33.4 0z",

        // Navigation & UI
        home: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
        close: "M6 18L18 6M6 6l12 12",
        "chevron-down": "M19 9l-7 7-7-7",
        "chevron-up": "M5 15l7-7 7 7",
        "chevron-right": "M9 5l7 7-7 7",
        "chevron-left": "M15 19l-7-7 7-7",
        menu: "M4 6h16M4 12h16M4 18h16",
        list: "M4 6h16M4 12h16M4 18h16",
        clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
        "grip-vertical":
            "M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z",

        // Actions
        plus: "M12 5v14m7-7H5",
        edit: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
        delete: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
        trash: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
        share: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z",
        settings:
            "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",

        // Status & Alerts
        warning:
            "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
        error: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z",
        check: "M5 13l4 4L19 7",
        alert: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
        info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
        "check-circle": "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
        "x-circle":
            "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
        "alert-triangle":
            "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
        x: "M6 18L18 6M6 6l12 12",

        // Users & Teams
        user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
        users: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M21 10.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z",
        "users-multiple":
            "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M21 10.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z",
        "users-cog":
            "M9 6a3 3 0 11-6 0 3 3 0 016 0zm8 0a3 3 0 11-6 0 3 3 0 016 0zm-4.07 11c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5zm13.86 3.03l.7-1.21c.09-.15.03-.34-.12-.42l-.83-.5c.1-.37.1-.76 0-1.14l.83-.49c.15-.09.21-.27.12-.42l-.7-1.21c-.09-.15-.27-.21-.42-.12l-.83.49c-.29-.24-.63-.42-.99-.49v-.99c0-.18-.14-.32-.32-.32h-1.4c-.18 0-.32.14-.32.32v.99c-.36.08-.7.26-.99.49l-.83-.49c-.15-.09-.33-.03-.42.12l-.7 1.21c-.09.15-.03.34.12.42l.83.49c-.1.38-.1.77 0 1.14l-.83.5c-.15.09-.21.27-.12.42l.7 1.21c.09.15.27.21.42.12l.83-.49c.29.24.63.42.99.49v.99c0 .18.14.32.32.32h1.4c.18 0 .32-.14.32-.32v-.99c.36-.08.7-.26.99-.49l.83.49c.15.09.33.03.42-.12zm-3.86.47a1.5 1.5 0 111.5-2.6 1.5 1.5 0 01-1.5 2.6z",

        // Voting & Actions
        vote: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
        "vote-multiple":
            "M9 12l2 2 4-4m1.09-9a16 16 0 014.91 0 16 16 0 010 18 16 16 0 01-4.91 0m-1.09-9a16 16 0 00-8 0 16 16 0 000 18 16 16 0 008 0",
        "arrow-up": "M7 14l5-5 5 5",
        "arrow-left": "M10 19l-7-7m0 0l7-7m-7 7h18",
        "arrow-right": "M14 5l7 7m0 0l-7 7m7-7H3",
        reset: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",

        // Security & Authentication
        logout: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
        shield: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
        key: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v-2H7v-2H5l-1.257-1.257A6 6 0 0117 7z",
        fingerprint:
            "M12.1 8.6c-1.1-.3-2.3-.3-3.4 0M8.5 12.1c0-1.9 1.6-3.5 3.5-3.5s3.5 1.6 3.5 3.5M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zM8.5 8.6c-.4-.1-.8-.1-1.2 0M15.5 8.6c.4-.1.8-.1 1.2 0M12 15.5c1.9 0 3.5-1.6 3.5-3.5M8.5 15.5c0-1.9 1.6-3.5 3.5-3.5",

        // Charts & Data
        "bar-chart":
            "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
        "chart-bar":
            "M2 20h3v-8H2v8zm5 0h3v-14H7v14zm5 0h3V9h-3v11zm5 0h3V4h-3v16zM3 3l7 7 4-4 7 7",
        scorecard: "M3 5h18v3H3V5zm0 6h18v3H3v-3zm0 6h18v3H3v-3z",

        // Loading & States
        spinner: "", // Special case - will use different rendering
        loading: "", // Special case - will use different rendering
    };

    let iconPath = $derived(iconPaths[name] || "");
    let isSpinner = $derived(name === "spinner" || name === "loading");
</script>

{#if isSpinner}
    <!-- Spinner icons use a different SVG structure -->
    <svg
        class={iconClass}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
    >
        <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
        ></circle>
        <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
    </svg>
{:else if iconPath}
    <!-- Standard icons -->
    <svg
        class={iconClass}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d={iconPath}
        />
    </svg>
{:else}
    <!-- Fallback for unknown icons -->
    <svg
        class={iconClass}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
    </svg>
{/if}

<style lang="less">
    .icon-circle {
        border-radius: 50%;
        padding: 0.375rem;
        background-color: var(--surface-primary);
        border: 1px solid var(--surface-secondary);

        &.status-text-danger {
            background-color: color-mix(
                in srgb,
                var(--color-danger) 10%,
                transparent
            );
            border-color: color-mix(
                in srgb,
                var(--color-danger) 30%,
                transparent
            );
        }

        &.status-text-warning {
            background-color: color-mix(
                in srgb,
                var(--color-warning) 10%,
                transparent
            );
            border-color: color-mix(
                in srgb,
                var(--color-warning) 30%,
                transparent
            );
        }

        &.status-text-success {
            background-color: color-mix(
                in srgb,
                var(--color-success) 10%,
                transparent
            );
            border-color: color-mix(
                in srgb,
                var(--color-success) 30%,
                transparent
            );
        }

        &.status-text-info {
            background-color: color-mix(
                in srgb,
                var(--color-info) 10%,
                transparent
            );
            border-color: color-mix(
                in srgb,
                var(--color-info) 30%,
                transparent
            );
        }
    }
</style>
