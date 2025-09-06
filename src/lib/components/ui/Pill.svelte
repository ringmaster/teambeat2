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
    {@render children?.()}
</span>

<style lang="less">
    :global .pill {
        display: inline-block;
        font-weight: 500;
        border-radius: 9999px;
        text-align: center;
        white-space: nowrap;
        line-height: 1;
    }

    :global .pill-sm {
        font-size: 0.75rem;
        padding: 0.25rem 0.75rem;
    }

    :global .pill-md {
        font-size: 0.875rem;
        padding: 0.375rem 1rem;
    }

    :global .pill-lg {
        font-size: 1rem;
        padding: 0.5rem 1.25rem;
    }

    :global .pill-primary {
        background: var(--color-primary);
        color: white;
    }

    :global .pill-secondary {
        background: var(--color-secondary);
        color: white;
    }

    :global .pill-success {
        background: var(--color-success);
        color: white;
    }

    :global .pill-warning {
        background: var(--color-warning);
        color: var(--color-text-primary);
    }

    :global .pill-danger {
        background: var(--color-danger);
        color: white;
    }

    :global .pill-info {
        background: var(--color-info);
        color: white;
    }

    :global .pill-muted {
        background: var(--input-border);
        color: var(--color-text-secondary);
    }
</style>
