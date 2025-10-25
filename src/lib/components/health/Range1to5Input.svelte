<script lang="ts">
interface Props {
	question: any;
	value?: number;
	disabled?: boolean;
	onchange?: (value: number) => void;
}

const {
	question,
	value = undefined,
	disabled = false,
	onchange,
}: Props = $props();

function handleSelection(selectedValue: number) {
	if (!disabled && onchange) {
		onchange(selectedValue);
	}
}
</script>

<div class="range-input">
    {#each [1, 2, 3, 4, 5] as rating}
        <button
            class="option"
            class:selected={value === rating}
            class:disabled
            onclick={() => handleSelection(rating)}
            {disabled}
            type="button"
        >
            <span class="rating-number">{rating}</span>
        </button>
    {/each}
</div>

<style lang="less">
    .range-input {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.5rem;
    }

    .option {
        flex: 1;
        padding: 0.75rem;
        border: 2px solid var(--color-border);
        border-radius: 0.5rem;
        background-color: var(--color-bg-secondary);
        color: var(--color-text-primary);
        font-size: 1.125rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 3.5rem;

        &:hover:not(.disabled) {
            border-color: var(--card-interactive-highlight);
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        &.selected {
            border-color: var(--btn-accent-bg);
            background-color: var(--btn-accent-bg);
            color: var(--btn-accent-text);
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.25)' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'%3E%3C/polyline%3E%3C/svg%3E");
            background-size: 150% 150%;
            background-position: center;
            background-repeat: no-repeat;

            &:hover:not(.disabled) {
                background-color: var(--btn-accent-bg-hover);
                border-color: var(--btn-accent-bg-hover);
            }
        }

        &.disabled {
            cursor: not-allowed;
            opacity: 0.6;
        }
    }

    .rating-number {
        font-size: 1.25rem;
        line-height: 1;
        position: relative;
        z-index: 1;
    }
</style>
