<script lang="ts">
    interface Props {
        preset?: 'admin' | 'member' | 'facilitator' | 'draft' | 'active' | 'complete' | 'archived';
        variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';
        size?: 'sm' | 'md' | 'lg';
        class?: string;
        children?: any;
    }
    
    let {
        preset,
        variant,
        size = 'sm',
        class: className = '',
        children
    }: Props = $props();
    
    // Map presets to variants
    const presetVariants = {
        admin: 'danger',
        member: 'info',
        facilitator: 'success',
        draft: 'muted',
        active: 'primary',
        complete: 'success',
        archived: 'warning'
    };
    
    let pillVariant = $derived(preset ? presetVariants[preset] : (variant || 'muted'));
    
    let pillClass = $derived.by(() => {
        let classes = ['pill', `pill-${pillVariant}`, `pill-${size}`];
        
        if (className) {
            classes.push(className);
        }
        
        return classes.join(' ');
    });
</script>

<span class={pillClass}>
    {@render children?.()}
</span>

<style>
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
    background: rgb(var(--color-primary));
    color: white;
}

.pill-secondary {
    background: rgb(var(--color-secondary));
    color: white;
}

.pill-success {
    background: rgb(var(--color-success));
    color: white;
}

.pill-warning {
    background: rgb(var(--color-warning));
    color: rgb(var(--color-gray-900));
}

.pill-danger {
    background: rgb(var(--color-danger));
    color: white;
}

.pill-info {
    background: rgb(var(--color-info));
    color: white;
}

.pill-muted {
    background: rgb(var(--color-gray-200));
    color: rgb(var(--color-gray-700));
}
</style>