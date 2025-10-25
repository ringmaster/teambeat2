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
	buttonVariant?: "primary" | "secondary" | "danger" | "ghost" | "light";
	buttonDisabled?: boolean;
	oninput?: (event: Event) => void;
	onkeydown?: (event: KeyboardEvent) => void;
	onButtonClick?: (event: MouseEvent) => void;
	buttonContent: any;
}

let {
	placeholder = "",
	value = $bindable(""),
	disabled = false,
	required = false,
	id,
	name,
	class: className = "",
	rows = 3,
	maxlength,
	buttonVariant = "primary",
	buttonDisabled = false,
	oninput,
	onkeydown,
	onButtonClick,
	buttonContent,
}: Props = $props();

let buttonClass = $derived.by(() => {
	let classes = ["textarea-button"];

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
		case "light":
			classes.push("button-light");
			break;
	}

	return classes.join(" ");
});

function handleKeydown(event: KeyboardEvent) {
	if (event.key === "Enter" && !event.shiftKey) {
		event.preventDefault();
		if (onButtonClick && !buttonDisabled && !disabled) {
			onButtonClick(new MouseEvent("click", { bubbles: true }));
		}
	}

	// Call the original onkeydown handler if provided
	if (onkeydown) {
		onkeydown(event);
	}
}
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
        onkeydown={handleKeydown}
    ></textarea>
    <button
        type="button"
        class={buttonClass}
        disabled={buttonDisabled || disabled}
        onclick={onButtonClick}
    >
        {@render buttonContent?.()}
    </button>
</div>

<style>
    .textarea-with-button {
        display: flex;
        border: 1px solid var(--input-border);
        border-radius: var(--radius-lg);
        overflow: hidden;
        background-color: white;
        transition: all var(--transition-fast);
    }

    .textarea-with-button:focus-within {
        border-color: var(--input-border-focus);
        box-shadow: 0 0 0 1px var(--input-border-focus);
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
        resize: none;
        min-height: calc(1.25rem * 3 + var(--spacing-3) * 2);
    }

    .textarea-field::placeholder {
        color: var(--input-placeholder);
    }

    .textarea-field:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        resize: none;
    }

    .textarea-button {
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
        align-self: stretch;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .textarea-button:disabled {
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
        background-color: var(--input-border-focus);
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

    .button-light {
        background-color: white;
        color: #000000;
        border-left: none;
    }

    .button-light:hover:not(:disabled) {
        background-color: #f5f5f5;
        color: #000000;
    }

    /* Disabled state for the entire component */
    .textarea-with-button:has(.textarea-field:disabled) {
        opacity: 0.6;
        background-color: var(--surface-elevated);
    }
</style>