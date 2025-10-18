<script lang="ts">
    import { page } from "$app/stores";

    interface NavItem {
        label: string;
        href: string;
        path: string;
    }

    const navItems: NavItem[] = [
        { label: "Performance", href: "/admin/performance", path: "/admin/performance" },
        { label: "Schema", href: "/admin/schema", path: "/admin/schema" },
        { label: "Series", href: "/admin/series", path: "/admin/series" },
    ];

    let currentPath = $derived($page.url.pathname);
</script>

<nav class="admin-nav">
    <div class="admin-nav-content">
        <div class="nav-tabs">
            {#each navItems as item}
                <a
                    href={item.href}
                    class="nav-tab"
                    class:active={currentPath === item.path}
                >
                    {item.label}
                </a>
            {/each}
        </div>
    </div>
</nav>

<style lang="less">
    @import "$lib/styles/_mixins.less";

    .admin-nav {
        background-color: var(--surface-secondary);
        border-bottom: 1px solid var(--surface-tertiary);
        padding: var(--spacing-3) var(--spacing-4);
        width: 100%;
    }

    .admin-nav-content {
        max-width: var(--board-header-width);
        margin: 0 auto;
        display: flex;
        justify-content: center;
    }

    .nav-tabs {
        display: flex;
        gap: 0;
        background-color: color-mix(in srgb, var(--color-primary) 8%, transparent);
        border-radius: var(--radius-lg);
        padding: 0.25rem;
        border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
    }

    .nav-tab {
        padding: 0.5rem 1.25rem;
        border: none;
        border-radius: calc(var(--radius-lg) - 0.125rem);
        background-color: transparent;
        color: var(--color-primary);
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        min-height: 36px;
        white-space: nowrap;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;

        &:hover:not(.active) {
            background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
            color: var(--color-primary-hover);
        }

        &.active {
            background-color: var(--btn-primary-bg);
            color: var(--btn-primary-text);
            box-shadow:
                inset 0 1px 2px rgba(0, 0, 0, 0.1),
                0 1px 2px rgba(0, 0, 0, 0.05);
        }
    }
</style>
