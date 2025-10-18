<script lang="ts">
    import { fly, fade } from "svelte/transition";
    import Icon from "$lib/components/ui/Icon.svelte";
    import type { Snippet } from "svelte";

    interface Props {
        buttonLabel?: string;
        buttonIcon?: string;
        buttonClass?: string;
        menuClass?: string;
        children?: Snippet;
        onOpenChange?: (isOpen: boolean) => void;
    }

    let { buttonLabel = "", buttonIcon = "ellipsis-vertical", buttonClass = "", menuClass = "", children, onOpenChange }: Props = $props();

    let isOpen = $state(false);
    let menuButton: HTMLButtonElement | undefined = $state();
    let menuContainer: HTMLDivElement | undefined = $state();

    function toggleMenu() {
        isOpen = !isOpen;
        onOpenChange?.(isOpen);
    }

    function closeMenu() {
        isOpen = false;
        onOpenChange?.(false);
    }

    function handleClickOutside(event: MouseEvent) {
        if (menuContainer && !menuContainer.contains(event.target as Node)) {
            closeMenu();
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Escape") {
            closeMenu();
            menuButton?.focus();
        }
    }

    $effect(() => {
        if (isOpen) {
            document.addEventListener("click", handleClickOutside);
            document.addEventListener("keydown", handleKeydown);
            return () => {
                document.removeEventListener("click", handleClickOutside);
                document.removeEventListener("keydown", handleKeydown);
            };
        }
    });
</script>

<div class="dropdown-container" class:is-open={isOpen} bind:this={menuContainer}>
    <button
        bind:this={menuButton}
        onclick={toggleMenu}
        class="dropdown-trigger {buttonClass}"
        aria-haspopup="true"
        aria-expanded={isOpen}
    >
        {#if buttonIcon}
            <Icon name={buttonIcon} size="sm" />
        {/if}
        {#if buttonLabel}
            <span>{buttonLabel}</span>
        {/if}
    </button>

    {#if isOpen}
        <div
            class="dropdown-menu {menuClass}"
            role="menu"
            transition:fly={{ y: -10, duration: 200 }}
        >
            {#if children}
                {@render children()}
            {/if}
        </div>
    {/if}
</div>

<style lang="less">
    .dropdown-container {
        position: relative;
        display: inline-block;

        &.is-open {
            z-index: 10001;
        }
    }

    .dropdown-trigger {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        padding: var(--spacing-2) var(--spacing-3);
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        color: var(--color-text-secondary);
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all var(--transition-fast);
        min-height: 44px;

        &:hover {
            background: color-mix(in srgb, var(--color-primary) 5%, transparent);
            border-color: var(--color-primary);
            color: var(--color-primary);
        }

        &:focus {
            outline: none;
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
        }

        &[aria-expanded="true"] {
            background: color-mix(in srgb, var(--color-primary) 10%, transparent);
            border-color: var(--color-primary);
            color: var(--color-primary);
        }
    }

    .dropdown-menu {
        position: absolute;
        right: 0;
        top: calc(100% + var(--spacing-1));
        min-width: 200px;
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        padding: var(--spacing-2);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: var(--spacing-1);
    }

    :global(.dropdown-menu-item) {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        padding: var(--spacing-2) var(--spacing-3);
        background: transparent;
        border: none;
        border-radius: var(--radius-md);
        color: var(--color-text-primary);
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all var(--transition-fast);
        text-align: left;
        width: 100%;
        min-height: 40px;
        text-decoration: none;

        &:hover {
            background: color-mix(in srgb, var(--color-primary) 10%, transparent);
            color: var(--color-primary);
            text-decoration: none;
        }

        &:focus {
            outline: none;
            background: color-mix(in srgb, var(--color-primary) 10%, transparent);
        }

        &.danger {
            color: var(--color-danger);

            &:hover {
                background: color-mix(in srgb, var(--color-danger) 10%, transparent);
            }
        }
    }

    :global(.dropdown-menu-separator) {
        height: 1px;
        background: var(--color-border);
        margin: var(--spacing-1) 0;
    }
</style>
