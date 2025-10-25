<script lang="ts">
interface Props {
	placeholder?: string;
	value?: string;
	disabled?: boolean;
	required?: boolean;
	rows?: number;
	resize?: "none" | "both" | "horizontal" | "vertical";
	id?: string;
	name?: string;
	class?: string;
	oninput?: (event: Event) => void;
}

let {
	placeholder = "",
	value = $bindable(""),
	disabled = false,
	required = false,
	rows = 3,
	resize = "none",
	id,
	name,
	class: className = "",
	oninput,
}: Props = $props();
</script>

<textarea
    {placeholder}
    bind:value
    {disabled}
    {required}
    {rows}
    {id}
    {name}
    class="textarea {className}"
    style:resize={resize}
    oninput={oninput}
></textarea>

<style>
    .textarea {
        width: 100%;
        padding: var(--spacing-3);
        border: 1px solid var(--input-border);
        border-radius: var(--radius-lg);
        font-size: 0.875rem;
        line-height: 1.25rem;
        transition: all var(--transition-fast);
        font-family: inherit;
        background-color: white;
        min-height: 80px;
    }

    .textarea:focus {
        outline: none;
        border-color: var(--input-border-focus);
        box-shadow: 0 0 0 1px var(--input-border-focus);
    }

    .textarea:disabled {
        background-color: var(--input-background-disabled);
        opacity: 0.6;
        cursor: not-allowed;
    }

    .textarea::placeholder {
        color: var(--input-placeholder);
    }
</style>