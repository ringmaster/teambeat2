<script lang="ts">
    interface Props {
        type?: 'text' | 'email' | 'password' | 'number';
        placeholder?: string;
        value?: string;
        disabled?: boolean;
        required?: boolean;
        id?: string;
        name?: string;
        class?: string;
        buttonText: string;
        buttonVariant?: 'primary' | 'secondary' | 'danger' | 'ghost';
        buttonDisabled?: boolean;
        oninput?: (event: Event) => void;
        onkeydown?: (event: KeyboardEvent) => void;
        onButtonClick?: (event: MouseEvent) => void;
    }

    let {
        type = 'text',
        placeholder = '',
        value = $bindable(''),
        disabled = false,
        required = false,
        id,
        name,
        class: className = '',
        buttonText,
        buttonVariant = 'primary',
        buttonDisabled = false,
        oninput,
        onkeydown,
        onButtonClick
    }: Props = $props();

    let buttonClass = $derived.by(() => {
        let classes = ['input-button'];
        
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

<div class="input-with-button {className}">
    <input
        {type}
        {placeholder}
        bind:value
        {disabled}
        {required}
        {id}
        {name}
        class="input-field"
        oninput={oninput}
        onkeydown={onkeydown}
    />
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
    .input-with-button {
        display: flex;
        border: 1px solid rgb(var(--color-gray-200));
        border-radius: var(--radius-lg);
        overflow: hidden;
        background-color: white;
        transition: all var(--transition-fast);
    }

    .input-with-button:focus-within {
        border-color: rgb(var(--color-blue-500));
        box-shadow: 0 0 0 1px rgb(var(--color-blue-500));
    }

    .input-field {
        flex: 1;
        padding: var(--spacing-3);
        border: none;
        font-size: 0.875rem;
        line-height: 1.25rem;
        font-family: inherit;
        background-color: transparent;
        outline: none;
    }

    .input-field::placeholder {
        color: rgb(var(--color-gray-400));
    }

    .input-field:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .input-button {
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
    }

    .input-button:disabled {
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
    .input-with-button:has(.input-field:disabled) {
        opacity: 0.6;
        background-color: rgb(var(--color-gray-50));
    }
</style>