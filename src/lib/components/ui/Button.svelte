<script lang="ts">
    interface Props {
        variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
        size?: 'sm' | 'md' | 'lg';
        type?: 'button' | 'submit' | 'reset';
        disabled?: boolean;
        onclick?: (event: MouseEvent) => void;
        class?: string;
    }

    let {
        variant = 'primary',
        size = 'md',
        type = 'button',
        disabled = false,
        onclick,
        class: className = '',
        children
    }: Props = $props();

    let buttonClass = $derived(() => {
        let classes = ['btn'];
        
        // Variant classes
        switch (variant) {
            case 'primary':
                classes.push('btn-primary');
                break;
            case 'secondary':
                classes.push('btn-secondary');
                break;
            case 'danger':
                classes.push('btn-danger');
                break;
            case 'ghost':
                classes.push('btn-ghost');
                break;
        }
        
        // Size classes
        switch (size) {
            case 'sm':
                classes.push('btn-sm');
                break;
            case 'md':
                classes.push('btn-md');
                break;
            case 'lg':
                classes.push('btn-lg');
                break;
        }
        
        if (className) {
            classes.push(className);
        }
        
        return classes.join(' ');
    });
</script>

<button
    {type}
    {disabled}
    class={buttonClass}
    onclick={onclick}
>
    {@render children?.()}
</button>

<style>
    .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-lg);
        font-weight: 500;
        transition: all var(--transition-fast);
        cursor: pointer;
        border: none;
        text-decoration: none;
        font-family: inherit;
    }

    .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    /* Variants */
    .btn-primary {
        background-color: rgb(var(--color-blue-500));
        color: white;
    }

    .btn-primary:hover:not(:disabled) {
        background-color: rgb(var(--color-blue-600));
        box-shadow: var(--shadow-md);
    }

    .btn-secondary {
        background-color: rgb(255 255 255 / 0.5);
        color: rgb(var(--color-gray-700));
    }

    .btn-secondary:hover:not(:disabled) {
        background-color: white;
        box-shadow: var(--shadow-md);
    }

    .btn-danger {
        background-color: rgb(var(--color-red-600));
        color: white;
    }

    .btn-danger:hover:not(:disabled) {
        background-color: rgb(var(--color-red-700));
        box-shadow: var(--shadow-md);
    }

    .btn-ghost {
        background-color: transparent;
        color: rgb(var(--color-gray-600));
    }

    .btn-ghost:hover:not(:disabled) {
        background-color: rgb(var(--color-gray-100));
        color: rgb(var(--color-gray-900));
    }

    /* Sizes */
    .btn-sm {
        padding: var(--spacing-1) var(--spacing-3);
        font-size: 0.75rem;
        line-height: 1rem;
    }

    .btn-md {
        padding: var(--spacing-2) var(--spacing-4);
        font-size: 0.875rem;
        line-height: 1.25rem;
    }

    .btn-lg {
        padding: var(--spacing-3) var(--spacing-6);
        font-size: 1rem;
        line-height: 1.5rem;
    }
</style>