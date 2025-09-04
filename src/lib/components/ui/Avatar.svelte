<script lang="ts">
    interface Props {
        name?: string;
        email?: string;
        size?: "sm" | "md" | "lg";
        class?: string;
    }

    let {
        name = "",
        email = "",
        size = "md",
        class: className = "",
    }: Props = $props();

    let displayText = $derived.by(() => {
        if (name) {
            return name[0].toUpperCase();
        } else if (email) {
            return email[0].toUpperCase();
        }
        return "?";
    });

    let sizeClass = $derived.by(() => {
        switch (size) {
            case "sm":
                return "avatar-sm";
            case "md":
                return "avatar-md";
            case "lg":
                return "avatar-lg";
            default:
                return "avatar-md";
        }
    });
</script>

<div class="avatar {sizeClass} {className}">
    {displayText}
</div>

<style>
    .avatar {
        background: linear-gradient(
            to bottom right,
            rgb(var(--color-indigo-400)),
            rgb(var(--color-purple-500))
        );
        border-radius: var(--radius-full);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        flex-shrink: 0;
    }

    .avatar-sm {
        width: 1.5rem;
        height: 1.5rem;
        font-size: 0.75rem;
    }

    .avatar-md {
        width: 2rem;
        height: 2rem;
        font-size: 0.875rem;
    }

    .avatar-lg {
        width: 2.5rem;
        height: 2.5rem;
        font-size: 1rem;
    }
</style>
