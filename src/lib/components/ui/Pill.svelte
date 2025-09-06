<script lang="ts">
    interface Props {
        preset?:
            | "admin"
            | "member"
            | "facilitator"
            | "draft"
            | "active"
            | "complete"
            | "archived";
        variant?:
            | "primary"
            | "secondary"
            | "success"
            | "warning"
            | "danger"
            | "info"
            | "muted";
        size?: "sm" | "md" | "lg";
        class?: string;
        children?: any;
    }

    let {
        preset,
        variant,
        size = "sm",
        class: className = "",
        children,
    }: Props = $props();

    // Map presets to variants
    const presetVariants = {
        admin: "danger",
        member: "info",
        facilitator: "success",
        draft: "muted",
        active: "primary",
        complete: "success",
        archived: "warning",
    };

    let pillVariant = $derived(
        preset ? presetVariants[preset] : variant || "muted",
    );

    let pillClass = $derived.by(() => {
        let classes = ["pill", `pill-${pillVariant}`, `pill-${size}`];

        if (className) {
            classes.push(className);
        }

        return classes.join(" ");
    });
</script>

<span class={pillClass}>
    {#if false}
        <!-- Force these classes to exist for the component -->
        <span
            class="pill pill-icon pill-sm pill-md pill-lg pill-muted pill-primary pill-secondary pill-success pill-warning pill-danger pill-info"
            >x</span
        >
    {/if}
    {@render children?.()}
</span>

<style lang="less">
    .pill {
        display: inline-block;
        font-weight: 500;
        border-radius: 9999px;
        text-align: center;
        white-space: nowrap;
        line-height: 1;
    }

    .pill-sm {
        font-size: 0.75rem;
        padding: 0.25rem 0.75rem;
    }

    .pill-md {
        font-size: 0.875rem;
        padding: 0.375rem 1rem;
    }

    .pill-lg {
        font-size: 1rem;
        padding: 0.5rem 1.25rem;
    }

    .pill-primary {
        background: var(--color-primary);
        color: white;
    }

    .pill-secondary {
        background: var(--color-secondary);
        color: white;
    }

    .pill-success {
        background: var(--color-success);
        color: white;
    }

    .pill-warning {
        background: var(--color-warning);
        color: var(--color-text-primary);
    }

    .pill-danger {
        background: var(--color-danger);
        color: white;
    }

    .pill-info {
        background: var(--color-info);
        color: white;
    }

    .pill-muted {
        background: var(--input-border);
        color: var(--color-text-secondary);
    }
</style>
