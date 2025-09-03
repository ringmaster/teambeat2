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
        oninput?: (event: Event) => void;
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
        oninput
    }: Props = $props();
</script>

<input
    {type}
    {placeholder}
    bind:value
    {disabled}
    {required}
    {id}
    {name}
    class="input {className}"
    oninput={oninput}
/>

<style>
    .input {
        width: 100%;
        padding: var(--spacing-3);
        border: 1px solid rgb(var(--color-gray-200));
        border-radius: var(--radius-lg);
        font-size: 0.875rem;
        line-height: 1.25rem;
        transition: all var(--transition-fast);
        font-family: inherit;
        background-color: white;
    }

    .input:focus {
        outline: none;
        border-color: rgb(var(--color-blue-500));
        box-shadow: 0 0 0 1px rgb(var(--color-blue-500));
    }

    .input:disabled {
        background-color: rgb(var(--color-gray-50));
        opacity: 0.6;
        cursor: not-allowed;
    }

    .input::placeholder {
        color: rgb(var(--color-gray-400));
    }
</style>