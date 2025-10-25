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

const options = [
	{ value: 1, label: "Red", color: "#ef4444" },
	{ value: 3, label: "Yellow", color: "#eab308" },
	{ value: 5, label: "Green", color: "#22c55e" },
];

function handleSelection(selectedValue: number) {
	if (!disabled && onchange) {
		onchange(selectedValue);
	}
}
</script>

<div class="red-yellow-green-input">
    {#each options as option}
        <button
            class="option"
            class:selected={value === option.value}
            class:disabled
            onclick={() => handleSelection(option.value)}
            {disabled}
            type="button"
        >
            <div class="color-circle" style="background-color: {option.color}"></div>
            <span class="option-label">{option.label}</span>
        </button>
    {/each}
</div>

<style lang="less">
    .red-yellow-green-input {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.5rem;
    }

    .option {
        flex: 1;
        padding: 0.75rem 0.5rem;
        border: 2px solid var(--color-border);
        border-radius: 0.5rem;
        background-color: var(--color-bg-secondary);
        color: var(--color-text-primary);
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        min-height: 4rem;

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

    .color-circle {
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 50%;
        flex-shrink: 0;
        position: relative;
        z-index: 1;
    }

    .option-label {
        text-align: center;
        line-height: 1.3;
        position: relative;
        z-index: 1;
    }
</style>
