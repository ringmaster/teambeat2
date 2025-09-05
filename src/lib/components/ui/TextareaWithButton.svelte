<script lang="ts">
    interface Props {
        placeholder?: string;
        value?: string;
        disabled?: boolean;
        required?: boolean;
        id?: string;
        name?: string;
        class?: string;
        rows?: number;
        maxlength?: number;
        buttonText: string;
        buttonVariant?: 'primary' | 'secondary' | 'danger' | 'ghost';
        buttonDisabled?: boolean;
        oninput?: (event: Event) => void;
        onkeydown?: (event: KeyboardEvent) => void;
        onButtonClick?: (event: MouseEvent) => void;
    }

    let {
        placeholder = '',
        value = $bindable(''),
        disabled = false,
        required = false,
        id,
        name,
        class: className = '',
        rows = 3,
        maxlength,
        buttonText,
        buttonVariant = 'primary',
        buttonDisabled = false,
        oninput,
        onkeydown,
        onButtonClick
    }: Props = $props();

    let buttonClass = $derived.by(() => {
        let classes = ['textarea-button'];
        
        // Variant classes
        switch (buttonVariant) {
            case 'primary':
                classes.push('button-primary');
                break;
            case 'secondary':
                classes.push('button-secondary');
                break;
            case 'danger':
                classes.push('button-danger');
                break;
            case 'ghost':
                classes.push('button-ghost');
                break;
        }
        
        return classes.join(' ');
    });
</script>

<div class="textarea-with-button {className}">
    <textarea
        {placeholder}
        bind:value
        {disabled}
        {required}
        {id}
        {name}
        {rows}
        {maxlength}
        class="textarea-field"
        oninput={oninput}
        onkeydown={onkeydown}
    ></textarea>
    <button
        type="button"
        class={buttonClass}
        disabled={buttonDisabled || disabled}
        onclick={onButtonClick}
    >
        {buttonText}
    </button>
</div>

<style>
    .textarea-with-button {
        display: flex;
        border: 1px solid rgb(var(--color-gray-200));
        border-radius: var(--radius-lg);
        overflow: hidden;
        background-color: white;
        transition: all var(--transition-fast);
    }

    .textarea-with-button:focus-within {
        border-color: rgb(var(--color-blue-500));
        box-shadow: 0 0 0 1px rgb(var(--color-blue-500));
    }

    .textarea-field {
        flex: 1;
        padding: var(--spacing-3);
        border: none;
        font-size: 0.875rem;
        line-height: 1.25rem;
        font-family: inherit;
        background-color: transparent;
        outline: none;
        resize: vertical;
        min-height: calc(1.25rem * 3 + var(--spacing-3) * 2);
    }

    .textarea-field::placeholder {
        color: rgb(var(--color-gray-400));
    }

    .textarea-field:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        resize: none;
    }

    .textarea-button {
        padding: var(--spacing-3) var(--spacing-4);
        border: none;
        border-left: 1px solid rgb(var(--color-gray-200));
        font-size: 0.875rem;
        line-height: 1.25rem;
        font-weight: 500;
        cursor: pointer;
        transition: all var(--transition-fast);
        font-family: inherit;
        white-space: nowrap;
        align-self: flex-end;
    }

    .textarea-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    /* Button variants */
    .button-primary {
        background-color: rgb(var(--color-blue-500));
        color: white;
        border-left-color: rgb(var(--color-blue-500));
    }

    .button-primary:hover:not(:disabled) {
        background-color: rgb(var(--color-blue-600));
    }

    .button-secondary {
        background-color: rgb(var(--color-gray-50));
        color: rgb(var(--color-gray-700));
        border-left-color: rgb(var(--color-gray-200));
    }

    .button-secondary:hover:not(:disabled) {
        background-color: rgb(var(--color-gray-100));
    }

    .button-danger {
        background-color: rgb(var(--color-red-600));
        color: white;
        border-left-color: rgb(var(--color-red-600));
    }

    .button-danger:hover:not(:disabled) {
        background-color: rgb(var(--color-red-700));
    }

    .button-ghost {
        background-color: transparent;
        color: rgb(var(--color-gray-600));
        border-left-color: rgb(var(--color-gray-200));
    }

    .button-ghost:hover:not(:disabled) {
        background-color: rgb(var(--color-gray-50));
        color: rgb(var(--color-gray-900));
    }

    /* Disabled state for the entire component */
    .textarea-with-button:has(.textarea-field:disabled) {
        opacity: 0.6;
        background-color: rgb(var(--color-gray-50));
    }
</style>