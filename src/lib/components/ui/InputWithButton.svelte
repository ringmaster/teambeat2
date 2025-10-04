<script lang="ts">
    interface Props {
        type?: "text" | "email" | "password" | "number";
        placeholder?: string;
        value?: string;
        disabled?: boolean;
        required?: boolean;
        id?: string;
        name?: string;
        class?: string;
        buttonVariant?: "primary" | "secondary" | "danger" | "ghost";
        buttonDisabled?: boolean;
        buttonAriaLabel?: string;
        buttonClass?: string;
        oninput?: (event: Event) => void;
        onkeydown?: (event: KeyboardEvent) => void;
        onButtonClick?: (event: MouseEvent) => void;
        buttonContent: any;
    }

    let {
        type = "text",
        placeholder = "",
        value = $bindable(""),
        disabled = false,
        required = false,
        id,
        name,
        class: className = "",
        buttonVariant = "primary",
        buttonDisabled = false,
        buttonAriaLabel,
        buttonClass: additionalButtonClass = "",
        oninput,
        onkeydown,
        onButtonClick,
        buttonContent,
    }: Props = $props();

    let buttonClass = $derived.by(() => {
        let classes = ["input-button"];

        // Variant classes
        switch (buttonVariant) {
            case "primary":
                classes.push("button-primary");
                break;
            case "secondary":
                classes.push("button-secondary");
                break;
            case "danger":
                classes.push("button-danger");
                break;
            case "ghost":
                classes.push("button-ghost");
                break;
        }

        // Additional classes
        if (additionalButtonClass) {
            classes.push(additionalButtonClass);
        }

        return classes.join(" ");
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
        {oninput}
        {onkeydown}
        autocomplete="off"
    />
    <button
        type="button"
        class={buttonClass}
        disabled={buttonDisabled || disabled}
        onclick={onButtonClick}
        aria-label={buttonAriaLabel || undefined}
    >
        {@render buttonContent?.()}
    </button>
</div>

<style>
    .input-with-button {
        display: flex;
        border: 1px solid var(--input-border);
        border-radius: var(--radius-lg);
        overflow: hidden;
        background-color: white;
        transition: all var(--transition-fast);
    }

    .input-with-button:focus-within {
        border-color: var(--input-border-focus);
        box-shadow: 0 0 0 1px var(--input-border-focus);
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
        color: var(--input-placeholder);
    }

    .input-field:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .input-button {
        padding: var(--spacing-3) var(--spacing-4);
        border: none;
        border-left: 1px solid var(--input-border);
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
        background-color: var(--input-border-focus);
        color: white;
        border-left-color: var(--input-border-focus);
    }

    .button-primary:hover:not(:disabled) {
        background-color: var(--color-accent-hover);
    }

    .button-secondary {
        background-color: var(--surface-elevated);
        color: var(--color-text-secondary);
        border-left-color: var(--input-border);
    }

    .button-secondary:hover:not(:disabled) {
        background-color: var(--surface-primary);
    }

    .button-danger {
        background-color: var(--color-danger);
        color: white;
        border-left-color: var(--color-danger);
    }

    .button-danger:hover:not(:disabled) {
        background-color: var(--color-danger-hover);
    }

    .button-ghost {
        background-color: transparent;
        color: var(--color-text-secondary);
        border-left-color: var(--input-border);
    }

    .button-ghost:hover:not(:disabled) {
        background-color: var(--surface-elevated);
        color: var(--color-text-primary);
    }

    /* Disabled state for the entire component */
    .input-with-button:has(.input-field:disabled) {
        opacity: 0.6;
        background-color: var(--surface-elevated);
    }
</style>
