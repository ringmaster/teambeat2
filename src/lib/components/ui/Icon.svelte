<script lang="ts">
    interface Props {
        name: string;
        size?: "sm" | "md" | "lg";
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
        // Navigation & UI
        close: "M6 18L18 6M6 6l12 12",
        "chevron-down": "M19 9l-7 7-7-7",
        "chevron-up": "M5 15l7-7 7 7",
        menu: "M4 6h16M4 12h16M4 18h16",

        // Actions
        plus: "M12 5v14m7-7H5",
        edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7",
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
        info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",

        // Users & Teams
        user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
        users: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z",

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
            d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
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
            background-color: color-mix(in srgb, var(--color-danger) 10%, transparent);
            border-color: color-mix(in srgb, var(--color-danger) 30%, transparent);
        }

        &.status-text-warning {
            background-color: color-mix(in srgb, var(--color-warning) 10%, transparent);
            border-color: color-mix(in srgb, var(--color-warning) 30%, transparent);
        }

        &.status-text-success {
            background-color: color-mix(in srgb, var(--color-success) 10%, transparent);
            border-color: color-mix(in srgb, var(--color-success) 30%, transparent);
        }

        &.status-text-info {
            background-color: color-mix(in srgb, var(--color-info) 10%, transparent);
            border-color: color-mix(in srgb, var(--color-info) 30%, transparent);
        }
    }
</style>
