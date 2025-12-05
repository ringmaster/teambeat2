<script lang="ts">
import { onMount } from "svelte";
import Icon from "./Icon.svelte";

interface Option {
	value: string;
	used?: boolean;
}

interface Props {
	value: string;
	options: Option[];
	placeholder?: string;
	onSelect: (value: string) => void;
	onInput?: (value: string) => void;
	disabled?: boolean;
}

let {
	value = $bindable(""),
	options = [],
	placeholder = "",
	onSelect,
	onInput,
	disabled = false,
}: Props = $props();

let isOpen = $state(false);
let highlightedIndex = $state(-1);
let inputElement: HTMLInputElement;
let dropdownElement: HTMLDivElement;
let valueOnFocus = $state("");  // Track value when input gained focus

// Fuzzy search implementation
function fuzzyMatch(str: string, pattern: string): number {
	if (!pattern) return 1;

	const strLower = str.toLowerCase();
	const patternLower = pattern.toLowerCase();

	let patternIdx = 0;
	let score = 0;
	let consecutiveMatches = 0;

	for (let i = 0; i < strLower.length; i++) {
		if (strLower[i] === patternLower[patternIdx]) {
			score += 1 + consecutiveMatches;
			consecutiveMatches++;
			patternIdx++;

			if (patternIdx === patternLower.length) {
				return score;
			}
		} else {
			consecutiveMatches = 0;
		}
	}

	return patternIdx === patternLower.length ? score : 0;
}

let filteredOptions = $derived.by(() => {
	if (!value) return options;

	return options
		.map((opt) => ({
			...opt,
			score: fuzzyMatch(opt.value, value),
		}))
		.filter((opt) => opt.score > 0)
		.sort((a, b) => b.score - a.score);
});

function handleFocus() {
	isOpen = true;
	highlightedIndex = -1;
	valueOnFocus = value;  // Store value when focus is gained
}

function handleBlur(e: FocusEvent) {
	// Delay to allow click events on dropdown items
	setTimeout(() => {
		if (!dropdownElement?.contains(e.relatedTarget as Node)) {
			isOpen = false;
			// Call onSelect if the value changed (user typed without selecting from dropdown)
			if (value !== valueOnFocus) {
				onSelect(value);
			}
		}
	}, 200);
}

function handleInput(e: Event) {
	const target = e.target as HTMLInputElement;
	value = target.value;
	highlightedIndex = -1;
	onInput?.(value);
}

function handleKeydown(e: KeyboardEvent) {
	if (!isOpen) {
		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			isOpen = true;
			e.preventDefault();
			return;
		}
		return;
	}

	switch (e.key) {
		case "ArrowDown":
			e.preventDefault();
			highlightedIndex = Math.min(
				highlightedIndex + 1,
				filteredOptions.length - 1,
			);
			scrollToHighlighted();
			break;

		case "ArrowUp":
			e.preventDefault();
			highlightedIndex = Math.max(highlightedIndex - 1, 0);
			scrollToHighlighted();
			break;

		case "Enter":
			e.preventDefault();
			if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
				selectOption(filteredOptions[highlightedIndex].value);
			}
			break;

		case "Escape":
			e.preventDefault();
			isOpen = false;
			highlightedIndex = -1;
			inputElement.blur();
			break;
	}
}

function selectOption(optionValue: string) {
	value = optionValue;
	valueOnFocus = optionValue;  // Update to prevent duplicate onSelect call in handleBlur
	onSelect(optionValue);
	isOpen = false;
	highlightedIndex = -1;
	inputElement.blur();
}

function scrollToHighlighted() {
	if (highlightedIndex < 0 || !dropdownElement) return;

	const highlightedElement = dropdownElement.querySelector(
		`[data-index="${highlightedIndex}"]`,
	) as HTMLElement;

	if (highlightedElement) {
		highlightedElement.scrollIntoView({
			block: "nearest",
			behavior: "smooth",
		});
	}
}

function handleClickOutside(e: MouseEvent) {
	if (
		inputElement &&
		!inputElement.contains(e.target as Node) &&
		dropdownElement &&
		!dropdownElement.contains(e.target as Node)
	) {
		isOpen = false;
	}
}

onMount(() => {
	document.addEventListener("mousedown", handleClickOutside);
	return () => {
		document.removeEventListener("mousedown", handleClickOutside);
	};
});
</script>

<div class="autocomplete-wrapper">
    <input
        bind:this={inputElement}
        type="text"
        class="input"
        {placeholder}
        {disabled}
        value={value}
        onfocus={handleFocus}
        onblur={handleBlur}
        oninput={handleInput}
        onkeydown={handleKeydown}
        autocomplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls="autocomplete-listbox"
    />

    {#if isOpen && filteredOptions.length > 0}
        <div
            bind:this={dropdownElement}
            class="autocomplete-dropdown"
            id="autocomplete-listbox"
            role="listbox"
        >
            {#each filteredOptions as option, index (option.value)}
                <button
                    type="button"
                    class="autocomplete-option"
                    class:highlighted={index === highlightedIndex}
                    data-index={index}
                    onclick={() => selectOption(option.value)}
                    role="option"
                    aria-selected={index === highlightedIndex}
                >
                    <span class="option-text">{option.value}</span>
                    {#if option.used}
                        <Icon name="check" size="sm" />
                    {/if}
                </button>
            {/each}
        </div>
    {/if}
</div>

<style lang="less">
    .autocomplete-wrapper {
        position: relative;
        width: 100%;
    }

    .input {
        width: 100%;
        padding: var(--spacing-2) var(--spacing-3);
        border: 1px solid var(--input-border);
        border-radius: var(--radius-md);
        font-size: var(--text-base);
        font-family: inherit;
        background: var(--color-bg-secondary);
        color: var(--color-text-primary);
        transition: all 0.2s ease;

        &:focus {
            outline: none;
            border-color: var(--input-border-focus);
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--input-border-focus) 10%, transparent);
        }

        &:disabled {
            background: var(--input-background-disabled);
            cursor: not-allowed;
            opacity: 0.6;
        }

        &::placeholder {
            color: var(--input-placeholder);
        }
    }

    .autocomplete-dropdown {
        position: absolute;
        top: calc(100% + var(--spacing-1));
        left: 0;
        right: 0;
        max-height: 300px;
        overflow-y: auto;
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        z-index: 1000;
    }

    .autocomplete-option {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--spacing-2) var(--spacing-3);
        border: none;
        background: transparent;
        color: var(--color-text-primary);
        font-size: var(--text-sm);
        text-align: left;
        cursor: pointer;
        transition: background-color 0.15s ease;
        border-bottom: 1px solid var(--surface-primary);

        &:last-child {
            border-bottom: none;
        }

        &:hover,
        &.highlighted {
            background: var(--interactive-hover);
        }

        &.highlighted {
            background: var(--surface-primary);
        }

        .option-text {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    }
</style>
