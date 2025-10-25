<script lang="ts">
import { cubicOut } from "svelte/easing";
import { fade, fly } from "svelte/transition";
import Button from "$lib/components/ui/Button.svelte";
import Input from "$lib/components/ui/Input.svelte";
import Textarea from "$lib/components/ui/Textarea.svelte";
import type { RPNEvaluationResult } from "$lib/types/scorecard";
import { type ParseResult, parseData, parseFile } from "$lib/utils/data-parser";
import { evaluateRPN } from "$lib/utils/rpn-evaluator";
import { parseRPNString } from "$lib/utils/rpn-parser";

interface Props {
	show: boolean;
	initialRule?: string;
	initialData?: string;
	initialIterateOver?: string | null;
	onClose: () => void;
	onUpdateRule?: (rule: string) => void;
}

let {
	show = false,
	initialRule = "",
	initialData = "",
	initialIterateOver = null,
	onClose,
	onUpdateRule,
}: Props = $props();

let dialogElement: HTMLDivElement = $state() as HTMLDivElement;

// State
let dataInput = $state("");
let rpnRule = $state("");
let iterateOver = $state<string | null>(null);
let parsedData = $state<any>(null);
let parseError = $state<string | null>(null);
let executionResult = $state<RPNEvaluationResult | null>(null);
let isDragging = $state(false);
let hasRun = $state(false);
let lastInitializedRule = $state("");

// Initialize when modal opens (only once per opening)
$effect(() => {
	if (show && initialRule !== lastInitializedRule) {
		rpnRule = initialRule;
		dataInput = initialData;
		iterateOver = initialIterateOver;
		lastInitializedRule = initialRule;
		hasRun = false;
		executionResult = null;
	}
});

// Parse data whenever dataInput changes
$effect(() => {
	if (dataInput.trim()) {
		const result = parseData(dataInput);
		if (result.success) {
			parsedData = result.data;
			parseError = null;
		} else {
			parsedData = null;
			parseError = result.error || "Failed to parse data";
		}
	} else {
		parsedData = null;
		parseError = null;
	}
});

function handleDragOver(e: DragEvent) {
	e.preventDefault();
	isDragging = true;
}

function handleDragLeave(e: DragEvent) {
	e.preventDefault();
	isDragging = false;
}

async function handleDrop(e: DragEvent) {
	e.preventDefault();
	isDragging = false;

	const files = e.dataTransfer?.files;
	if (!files || files.length === 0) return;

	const file = files[0];
	const result = await parseFile(file);

	if (result.success && result.data) {
		// Convert parsed data back to formatted string for display
		dataInput = JSON.stringify(result.data, null, 2);
		parsedData = result.data;
		parseError = null;
	} else {
		parseError = result.error || "Failed to parse file";
		parsedData = null;
	}
}

function handleFileSelect(e: Event) {
	const input = e.target as HTMLInputElement;
	const file = input.files?.[0];
	if (!file) return;

	parseFile(file).then((result) => {
		if (result.success && result.data) {
			dataInput = JSON.stringify(result.data, null, 2);
			parsedData = result.data;
			parseError = null;
		} else {
			parseError = result.error || "Failed to parse file";
			parsedData = null;
		}
	});
}

function runTest() {
	if (!rpnRule.trim()) {
		executionResult = {
			success: false,
			error: "Please enter an RPN rule",
			stackTrace: [],
		};
		hasRun = true;
		return;
	}

	if (!parsedData) {
		executionResult = {
			success: false,
			error: "Please provide test data",
			stackTrace: [],
		};
		hasRun = true;
		return;
	}

	try {
		// Parse the RPN string into an expression
		const expression = parseRPNString(rpnRule);

		// Handle iterate_over setting (treat empty string as null)
		const effectiveIterateOver = iterateOver?.trim() || null;

		if (effectiveIterateOver === null) {
			// Aggregate: evaluate once with full data
			const result = evaluateRPN(expression, parsedData);
			executionResult = result;
		} else {
			// Detail: iterate over array
			const items = getValueByPath(parsedData, effectiveIterateOver);

			if (!Array.isArray(items)) {
				executionResult = {
					success: false,
					error: `Iterate Over path "${effectiveIterateOver}" did not resolve to an array`,
					stackTrace: [],
				};
				hasRun = true;
				return;
			}

			// Get item name for context (e.g., "tickets" -> "ticket")
			const itemName = getItemName(effectiveIterateOver);

			// Evaluate for first matching item (for demonstration)
			let foundMatch = false;
			for (let i = 0; i < items.length; i++) {
				const context = {
					...parsedData,
					[itemName]: items[i],
					_index: i,
				};

				const result = evaluateRPN(expression, context);
				if (result.success) {
					executionResult = {
						...result,
						message: `Evaluated with ${itemName} at index ${i}`,
					};
					foundMatch = true;
					break;
				}
			}

			if (!foundMatch) {
				executionResult = {
					success: false,
					error: "No matching items found in array",
					stackTrace: [],
				};
			}
		}

		hasRun = true;
	} catch (error) {
		executionResult = {
			success: false,
			error:
				error instanceof Error ? error.message : "Failed to parse RPN rule",
			stackTrace: [],
		};
		hasRun = true;
	}
}

function getValueByPath(obj: any, path: string): any {
	if (path === "$") return obj;
	const parts = path.split(".");
	let current = obj;
	for (const part of parts) {
		if (current === null || current === undefined) return null;
		current = current[part];
	}
	return current;
}

function getItemName(arrayPath: string): string {
	if (arrayPath === "$") return "$";
	const parts = arrayPath.split(".");
	const arrayName = parts[parts.length - 1];
	if (arrayName.endsWith("s") && !arrayName.endsWith("ss")) {
		return arrayName.slice(0, -1);
	}
	return arrayName;
}

function handleUpdateRule() {
	if (onUpdateRule) {
		onUpdateRule(rpnRule);
	}
	handleClose();
}

function handleClose() {
	dataInput = "";
	rpnRule = "";
	parsedData = null;
	parseError = null;
	executionResult = null;
	hasRun = false;
	onClose();
}

// Handle escape key
function handleKeydown(event: KeyboardEvent) {
	if (event.key === "Escape" && show) {
		handleClose();
	}
}

// Handle overlay click
function handleOverlayClick(event: MouseEvent) {
	if (event.target === event.currentTarget) {
		handleClose();
	}
}

// Focus management
$effect(() => {
	if (show && dialogElement) {
		const focusableElements = dialogElement.querySelectorAll(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
		);
		if (focusableElements.length > 0) {
			(focusableElements[0] as HTMLElement).focus();
		}
	}
});

function formatStackValue(value: any): string {
	if (value === null) return "null";
	if (value === undefined) return "undefined";
	if (typeof value === "string") return `"${value}"`;
	if (typeof value === "boolean") return value ? "true" : "false";
	if (typeof value === "number") return String(value);
	if (Array.isArray(value)) {
		return `[${value.map(formatStackValue).join(", ")}]`;
	}
	if (typeof value === "object") {
		return JSON.stringify(value);
	}
	return String(value);
}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show}
    <div
        class="rpn-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rpn-modal-title"
        tabindex="-1"
        transition:fade={{ duration: 200 }}
        onclick={handleOverlayClick}
    >
        <div
            bind:this={dialogElement}
            class="rpn-modal-dialog"
            role="document"
            tabindex="0"
            transition:fly={{ y: -20, duration: 300, easing: cubicOut }}
            onclick={(e) => e.stopPropagation()}
        >
            <!-- Modal Header -->
            <div class="rpn-modal-header">
                <h2 id="rpn-modal-title">RPN Rule Tester</h2>
                <button
                    onclick={handleClose}
                    class="rpn-close-button"
                    aria-label="Close modal"
                >
                    ×
                </button>
            </div>

            <!-- Modal Body with .band for vertical layout -->
            <div class="rpn-modal-body band">
                <div class="modal-panels ring">
            <!-- Left Panel: Data Input -->
            <div class="data-panel band">
                <div class="panel-header">
                    <h3>Test Data</h3>
                    <label class="file-upload-btn">
                        📁 Upload
                        <input
                            type="file"
                            accept=".json,.csv,.yaml,.yml"
                            onchange={handleFileSelect}
                            style="display: none;"
                        />
                    </label>
                </div>

                <div
                    class="data-input-wrapper expand"
                    class:dragging={isDragging}
                    ondragover={handleDragOver}
                    ondragleave={handleDragLeave}
                    ondrop={handleDrop}
                    role="region"
                    aria-label="Data input area with file drop support"
                >
                    <Textarea
                        bind:value={dataInput}
                        placeholder="Paste JSON, CSV, or YAML data here, or drag and drop a file..."
                        rows={15}
                        resize="vertical"
                        class="data-textarea"
                    />
                    {#if isDragging}
                        <div class="drop-overlay">
                            <div class="drop-message">📥 Drop file here</div>
                        </div>
                    {/if}
                </div>

                {#if parseError}
                    <div class="error-message">
                        <strong>Parse Error:</strong>
                        {parseError}
                    </div>
                {:else if parsedData}
                    <div class="success-message">
                        ✓ Data parsed successfully ({Array.isArray(parsedData)
                            ? `${parsedData.length} items`
                            : "object"})
                    </div>
                {/if}
            </div>

            <!-- Right Panel: RPN Rule Testing -->
            <div class="rule-panel band">
                <div class="panel-header">
                    <h3>RPN Rule</h3>
                </div>

                <div class="rule-input-wrapper">
                    <Input
                        bind:value={rpnRule}
                        placeholder="Enter RPN expression (e.g., $.count 10 gt)"
                        class="rule-input"
                    />
                    <Button
                        onclick={runTest}
                        disabled={!rpnRule.trim() || !parsedData}
                    >
                        ▶ Run
                    </Button>
                </div>

                <div class="iterate-input-wrapper">
                    <label for="iterate-over">
                        Iterate Over <span class="hint"
                            >(optional JSON path, or leave empty for aggregate)</span
                        >
                    </label>
                    <Input
                        id="iterate-over"
                        bind:value={iterateOver}
                        placeholder="e.g., $.tickets or items"
                        class="iterate-input"
                    />
                </div>

                {#if hasRun && executionResult}
                    <div class="execution-results expand">
                        <h4>Execution Trace</h4>

                        {#if executionResult.success}
                            <div class="trace-container">
                                {#if executionResult.stackTrace && executionResult.stackTrace.length > 0}
                                    {#each executionResult.stackTrace as trace (trace.step)}
                                        <div class="trace-step">
                                            <div class="step-header">
                                                <span class="step-number"
                                                    >Step {trace.step}</span
                                                >
                                                <span class="step-operation"
                                                    >{trace.operation}</span
                                                >
                                            </div>
                                            <div class="step-stack">
                                                <span class="stack-label"
                                                    >Stack:</span
                                                >
                                                {#if trace.stack.length === 0}
                                                    <span class="stack-empty"
                                                        >[empty]</span
                                                    >
                                                {:else}
                                                    <span
                                                        class="stack-contents"
                                                    >
                                                        [{trace.stack
                                                            .map(
                                                                formatStackValue,
                                                            )
                                                            .join(", ")}]
                                                    </span>
                                                {/if}
                                            </div>
                                        </div>
                                    {/each}
                                {/if}

                                <div class="final-result">
                                    <strong>Result:</strong>
                                    {#if executionResult.message}
                                        <div class="result-message">
                                            {executionResult.message}
                                        </div>
                                    {/if}
                                    <code
                                        >{formatStackValue(
                                            executionResult.value,
                                        )}</code
                                    >
                                </div>
                            </div>
                        {:else}
                            <div class="error-message">
                                <strong>Error:</strong>
                                {executionResult.error}
                                {#if executionResult.stackTrace && executionResult.stackTrace.length > 0}
                                    <details class="error-trace">
                                        <summary>Show execution trace</summary>
                                        {#each executionResult.stackTrace as trace (trace.step)}
                                            <div class="trace-step">
                                                <div class="step-header">
                                                    <span class="step-number"
                                                        >Step {trace.step}</span
                                                    >
                                                    <span class="step-operation"
                                                        >{trace.operation}</span
                                                    >
                                                </div>
                                                <div class="step-stack">
                                                    Stack: [{trace.stack
                                                        .map(formatStackValue)
                                                        .join(", ")}]
                                                </div>
                                            </div>
                                        {/each}
                                    </details>
                                {/if}
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>

        <!-- Modal Footer -->
        <div class="modal-footer">
            <Button onclick={handleClose} variant="secondary">Cancel</Button>
            <Button onclick={handleUpdateRule} disabled={!rpnRule.trim()}>
                Update Rule
            </Button>
        </div>
            </div>
        </div>
    </div>
{/if}

<style lang="less">
    // Dedicated modal overlay - covers entire viewport
    .rpn-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
    }

    // Dedicated modal dialog - fixed size container
    .rpn-modal-dialog {
        background: white;
        border-radius: 0.5rem;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        width: 90vw;
        max-width: 1200px;
        height: 80vh;
        max-height: 800px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    // Fixed modal header
    .rpn-modal-header {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid var(--color-border);

        h2 {
            margin: 0;
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--color-text-primary);
        }
    }

    .rpn-close-button {
        background: none;
        border: none;
        font-size: 1.5rem;
        font-weight: bold;
        color: #6b7280;
        cursor: pointer;
        padding: 0.25rem;
        line-height: 1;
        transition: color 0.2s ease;
        min-width: 32px;
        min-height: 32px;
        display: inline-flex;
        align-items: center;
        justify-content: center;

        &:hover {
            color: #374151;
        }
    }

    // Modal body uses .band class for vertical layout
    .rpn-modal-body {
        padding: 1.5rem;
        gap: 1rem;
    }

    // Styling only - layout handled by .ring
    .modal-panels {
        gap: 1.5rem;
    }

    // Styling only - layout handled by .band
    .data-panel,
    .rule-panel {
        gap: 0.75rem;
    }

    .data-panel {
        flex: 0 0 40%;
    }

    .rule-panel {
        flex: 0 0 calc(60% - 1.5rem);
    }

    // Styling only - layout handled by .expand
    .data-input-wrapper {
        position: relative;
    }

    .execution-results {
        border: 1px solid var(--input-border);
        border-radius: var(--radius-lg);
        padding: 0.75rem;
        background-color: var(--surface-secondary);
    }

    .modal-footer {
        flex-shrink: 0;
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        padding-top: 1rem;
        border-top: 1px solid var(--input-border);
    }

    .panel-header {
        flex-shrink: 0;
        display: flex;
        justify-content: space-between;
        align-items: center;

        h3 {
            margin: 0;
            font-size: 1rem;
            font-weight: 600;
            color: var(--text-primary);
        }
    }

    .rule-input-wrapper,
    .iterate-input-wrapper,
    .success-message,
    .error-message {
        flex-shrink: 0;
    }

    .file-upload-btn {
        padding: 0.375rem 0.75rem;
        background-color: var(--surface-secondary);
        border: 1px solid var(--input-border);
        border-radius: var(--radius-lg);
        font-size: 0.875rem;
        cursor: pointer;
        transition: all var(--transition-fast);

        &:hover {
            background-color: var(--surface-tertiary);
            border-color: var(--input-border-focus);
        }
    }

    .data-input-wrapper {
        &.dragging {
            .drop-overlay {
                display: flex;
            }
        }

        :global(.data-textarea) {
            height: 100%;
            font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
            font-size: 0.8125rem;
            line-height: 1.5;
        }
    }

    .drop-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(59, 130, 246, 0.1);
        border: 2px dashed var(--primary-color);
        border-radius: var(--radius-lg);
        display: none;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        z-index: 10;
    }

    .drop-message {
        background-color: white;
        padding: 1.5rem 2rem;
        border-radius: var(--radius-lg);
        font-size: 1.125rem;
        font-weight: 500;
        color: var(--primary-color);
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .rule-input-wrapper {
        display: flex;
        gap: 0.5rem;
        align-items: center;

        :global(.rule-input) {
            flex: 1;
            font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
            font-size: 0.8125rem;
        }
    }

    .iterate-input-wrapper {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;

        label {
            font-size: 0.875rem;
            font-weight: 500;
            color: var(--text-primary);

            .hint {
                font-weight: 400;
                color: var(--text-secondary);
                font-size: 0.8125rem;
            }
        }

        :global(.iterate-input) {
            font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
            font-size: 0.8125rem;
        }
    }

    .execution-results {
        h4 {
            margin: 0 0 0.75rem 0;
            font-size: 0.9375rem;
            font-weight: 600;
            color: var(--text-primary);
        }
    }

    .trace-container {
        font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
        font-size: 0.8125rem;
    }

    .trace-step {
        padding: 0.5rem;
        margin-bottom: 0.5rem;
        background-color: white;
        border-radius: 4px;
        border-left: 3px solid var(--primary-color);

        &:last-of-type {
            margin-bottom: 0.75rem;
        }
    }

    .step-header {
        display: flex;
        gap: 0.75rem;
        margin-bottom: 0.25rem;
    }

    .step-number {
        font-weight: 600;
        color: var(--text-secondary);
    }

    .step-operation {
        color: var(--primary-color);
        font-weight: 500;
    }

    .step-stack {
        font-size: 0.75rem;
        color: var(--text-secondary);

        .stack-label {
            font-weight: 600;
            margin-right: 0.5rem;
        }

        .stack-empty {
            font-style: italic;
            color: var(--text-tertiary);
        }

        .stack-contents {
            color: var(--text-primary);
            word-break: break-all;
        }
    }

    .final-result {
        padding: 0.75rem;
        background-color: #10b981;
        color: white;
        border-radius: 4px;
        font-weight: 500;

        .result-message {
            margin-top: 0.25rem;
            font-size: 0.875rem;
            font-weight: 400;
            opacity: 0.9;
        }

        code {
            display: block;
            margin-top: 0.5rem;
            padding: 0.5rem;
            background-color: rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
            word-break: break-all;
        }
    }

    .success-message {
        padding: 0.5rem 0.75rem;
        background-color: #d1fae5;
        border: 1px solid #6ee7b7;
        border-radius: var(--radius-lg);
        color: #065f46;
        font-size: 0.875rem;
    }

    .error-message {
        padding: 0.75rem;
        background-color: #fee;
        border: 1px solid #fcc;
        border-radius: var(--radius-lg);
        color: #c33;
        font-size: 0.875rem;

        strong {
            font-weight: 600;
        }
    }

    .error-trace {
        margin-top: 0.75rem;
        padding: 0.5rem;
        background-color: white;
        border-radius: 4px;

        summary {
            cursor: pointer;
            font-weight: 600;
            color: #c33;
            margin-bottom: 0.5rem;

            &:hover {
                text-decoration: underline;
            }
        }

        .trace-step {
            border-left-color: #c33;
        }
    }
</style>
