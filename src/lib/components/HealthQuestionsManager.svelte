<script lang="ts">
import { onMount } from "svelte";
import { toastStore } from "$lib/stores/toast";
import Icon from "./ui/Icon.svelte";

interface Props {
	sceneId: string;
}

const { sceneId }: Props = $props();

let questions = $state<any[]>([]);
let presets = $state<any[]>([]);
let loading = $state(true);
let error = $state<string | null>(null);
let draggedQuestionId = $state<string | null>(null);
let dragOverQuestionId = $state<string | null>(null);
let showPresetDropdown = $state(false);
let applyingPreset = $state(false);

const UNWRITTEN_QUESTION = "UNWRITTEN QUESTION";

async function loadQuestions() {
	try {
		loading = true;
		error = null;

		const res = await fetch(`/api/scenes/${sceneId}/health-questions`);
		const data = await res.json();

		if (!data.success) {
			throw new Error(data.error || "Failed to load questions");
		}

		questions = data.questions;
	} catch (err) {
		console.error("Failed to load health questions:", err);
		error = err instanceof Error ? err.message : "Failed to load questions";
		toastStore.error("Failed to load questions");
	} finally {
		loading = false;
	}
}

async function loadPresets() {
	try {
		const res = await fetch("/api/health-question-presets");
		const data = await res.json();

		if (!data.success) {
			throw new Error(data.error || "Failed to load presets");
		}

		presets = data.presets;
	} catch (err) {
		console.error("Failed to load presets:", err);
	}
}

async function addQuestion() {
	try {
		const res = await fetch(`/api/scenes/${sceneId}/health-questions`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				question: UNWRITTEN_QUESTION,
				questionType: "range1to5",
			}),
		});

		const data = await res.json();

		if (!data.success) {
			throw new Error(data.error || "Failed to create question");
		}

		await loadQuestions();
		toastStore.success("Question added");
	} catch (err) {
		console.error("Failed to create question:", err);
		toastStore.error(
			err instanceof Error ? err.message : "Failed to create question",
		);
	}
}

async function updateQuestion(questionId: string, updates: any) {
	try {
		const res = await fetch(`/api/health-questions/${questionId}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(updates),
		});

		const data = await res.json();

		if (!data.success) {
			throw new Error(data.error || "Failed to update question");
		}

		await loadQuestions();
	} catch (err) {
		console.error("Failed to update question:", err);
		toastStore.error(
			err instanceof Error ? err.message : "Failed to update question",
		);
	}
}

async function deleteQuestion(questionId: string) {
	try {
		const res = await fetch(`/api/health-questions/${questionId}`, {
			method: "DELETE",
		});

		const data = await res.json();

		if (!data.success) {
			throw new Error(data.error || "Failed to delete question");
		}

		await loadQuestions();
		toastStore.success("Question deleted");
	} catch (err) {
		console.error("Failed to delete question:", err);
		toastStore.error(
			err instanceof Error ? err.message : "Failed to delete question",
		);
	}
}

async function reorderQuestions() {
	if (
		!draggedQuestionId ||
		!dragOverQuestionId ||
		draggedQuestionId === dragOverQuestionId
	)
		return;

	const draggedIndex = questions.findIndex((q) => q.id === draggedQuestionId);
	const dragOverIndex = questions.findIndex((q) => q.id === dragOverQuestionId);

	if (draggedIndex === -1 || dragOverIndex === -1) return;

	// Reorder locally
	const newQuestions = [...questions];
	const [draggedQuestion] = newQuestions.splice(draggedIndex, 1);
	newQuestions.splice(dragOverIndex, 0, draggedQuestion);
	questions = newQuestions;

	// Send update to server
	try {
		const questionIds = newQuestions.map((q) => q.id);
		const res = await fetch(`/api/scenes/${sceneId}/health-questions/reorder`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ questionIds }),
		});

		const data = await res.json();

		if (!data.success) {
			throw new Error(data.error || "Failed to reorder questions");
		}

		await loadQuestions();
	} catch (err) {
		console.error("Failed to reorder questions:", err);
		toastStore.error(
			err instanceof Error ? err.message : "Failed to reorder questions",
		);
		await loadQuestions();
	}
}

function handleDragStart(e: DragEvent, questionId: string) {
	draggedQuestionId = questionId;
	if (e.dataTransfer) {
		e.dataTransfer.effectAllowed = "move";
	}
}

function handleDragOver(e: DragEvent, questionId: string) {
	e.preventDefault();
	dragOverQuestionId = questionId;
	if (e.dataTransfer) {
		e.dataTransfer.dropEffect = "move";
	}
}

function handleDragLeave() {
	dragOverQuestionId = null;
}

function handleDrop(e: DragEvent, questionId: string) {
	e.preventDefault();
	reorderQuestions();
	draggedQuestionId = null;
	dragOverQuestionId = null;
}

function handleDragEnd() {
	draggedQuestionId = null;
	dragOverQuestionId = null;
}

function handleQuestionBlur(questionId: string, value: string) {
	const trimmedValue = value.trim();
	if (!trimmedValue) {
		updateQuestion(questionId, { question: UNWRITTEN_QUESTION });
	} else if (trimmedValue !== UNWRITTEN_QUESTION) {
		updateQuestion(questionId, { question: trimmedValue });
	}
}

function getDisplayValue(question: string): string {
	return question === UNWRITTEN_QUESTION ? "" : question;
}

async function applyPreset(presetId: string) {
	try {
		applyingPreset = true;
		showPresetDropdown = false;

		const res = await fetch(`/api/scenes/${sceneId}/apply-health-preset`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ presetId }),
		});

		const data = await res.json();

		if (!data.success) {
			throw new Error(data.error || "Failed to apply preset");
		}

		await loadQuestions();
		toastStore.success("Preset questions added");
	} catch (err) {
		console.error("Failed to apply preset:", err);
		toastStore.error(
			err instanceof Error ? err.message : "Failed to apply preset",
		);
	} finally {
		applyingPreset = false;
	}
}

onMount(() => {
	loadQuestions();
	loadPresets();
});

// Reload when scene changes
$effect(() => {
	if (sceneId) {
		loadQuestions();
	}
});
</script>

<div class="health-questions-manager">
    <div class="manager-header">
        <h3>Survey Questions</h3>
        <div class="header-actions">
            <div class="preset-dropdown-container">
                <button
                    onclick={() => showPresetDropdown = !showPresetDropdown}
                    class="btn-secondary"
                    type="button"
                    disabled={applyingPreset}
                >
                    <Icon name="book-open" size="sm" />
                    Add Preset
                </button>
                {#if showPresetDropdown}
                    <div class="preset-dropdown">
                        {#each presets as preset}
                            <button
                                class="preset-option"
                                onclick={() => applyPreset(preset.id)}
                                type="button"
                            >
                                <div class="preset-name">{preset.name}</div>
                                {#if preset.description}
                                    <div class="preset-description">{preset.description}</div>
                                {/if}
                                <div class="preset-count">{preset.questionCount} questions</div>
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>
            <button onclick={addQuestion} class="btn-primary" type="button">
                <Icon name="plus" size="sm" />
                Add Question
            </button>
        </div>
    </div>

    {#if loading}
        <p class="status-message">Loading questions...</p>
    {:else if error}
        <p class="status-message error">{error}</p>
    {:else if questions.length === 0}
        <p class="status-message">No questions configured. Click "Add Question" to get started.</p>
    {:else}
        <div class="questions-list">
            {#each questions as question (question.id)}
                <div
                    class="question-item"
                    class:dragging={draggedQuestionId === question.id}
                    class:drag-over={dragOverQuestionId === question.id}
                    draggable="true"
                    ondragstart={(e) => handleDragStart(e, question.id)}
                    ondragover={(e) => handleDragOver(e, question.id)}
                    ondragleave={handleDragLeave}
                    ondrop={(e) => handleDrop(e, question.id)}
                    ondragend={handleDragEnd}
                >
                    <div class="drag-handle">
                        <Icon name="grip-vertical" size="sm" />
                    </div>
                    <div
                        class="question-content"
                        onmousedown={(e) => e.stopPropagation()}
                    >
                        <input
                            type="text"
                            value={getDisplayValue(question.question)}
                            onblur={(e) => handleQuestionBlur(question.id, e.currentTarget.value)}
                            class="question-input"
                            placeholder="Question text"
                            draggable="false"
                        />
                    </div>
                    <select
                        value={question.questionType}
                        onchange={(e) => updateQuestion(question.id, { questionType: e.currentTarget.value })}
                        class="type-select"
                        onmousedown={(e) => e.stopPropagation()}
                        draggable="false"
                    >
                        <option value="boolean">Yes/No</option>
                        <option value="range1to5">1-5 Scale</option>
                        <option value="agreetodisagree">Agree/Disagree</option>
                        <option value="redyellowgreen">Red/Yellow/Green</option>
                    </select>
                    <button
                        onclick={() => deleteQuestion(question.id)}
                        class="delete-button"
                        type="button"
                        title="Delete question"
                        onmousedown={(e) => e.stopPropagation()}
                        draggable="false"
                    >
                        <Icon name="trash" size="sm" />
                    </button>
                </div>
            {/each}
        </div>
        <p class="warning-message">
            <Icon name="alert-triangle" size="sm" />
            Modifying questions will delete all user responses for this survey.
        </p>
    {/if}
</div>

<style lang="less">
    .health-questions-manager {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .manager-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;

        h3 {
            margin: 0;
            font-size: 1.125rem;
            font-weight: 600;
            color: var(--text-primary);
        }
    }

    .header-actions {
        display: flex;
        gap: 0.5rem;
        align-items: center;
    }

    .preset-dropdown-container {
        position: relative;
    }

    .btn-primary {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 0.375rem;
        background-color: var(--btn-accent-bg);
        color: var(--btn-accent-text);
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s ease;

        &:hover {
            background-color: var(--btn-accent-bg-hover);
        }
    }

    .btn-secondary {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        border: 1px solid var(--border-primary);
        border-radius: 0.375rem;
        background-color: var(--surface-secondary);
        color: var(--text-primary);
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover:not(:disabled) {
            background-color: var(--surface-tertiary);
            border-color: var(--border-hover, var(--accent-secondary));
        }

        &:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
    }

    .preset-dropdown {
        position: absolute;
        top: calc(100% + 0.25rem);
        right: 0;
        min-width: 300px;
        max-width: 400px;
        background-color: var(--surface-primary);
        border: 1px solid var(--border-primary);
        border-radius: 0.5rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 100;
        overflow: hidden;
    }

    .preset-option {
        width: 100%;
        padding: 1rem;
        border: none;
        border-bottom: 1px solid var(--border-secondary);
        background-color: var(--surface-primary);
        text-align: left;
        cursor: pointer;
        transition: background-color 0.2s ease;

        &:last-child {
            border-bottom: none;
        }

        &:hover {
            background-color: var(--surface-secondary);
        }
    }

    .preset-name {
        font-size: 0.9375rem;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 0.25rem;
    }

    .preset-description {
        font-size: 0.8125rem;
        color: var(--text-muted);
        margin-bottom: 0.5rem;
    }

    .preset-count {
        font-size: 0.75rem;
        color: var(--text-secondary);
    }

    .status-message {
        padding: 1rem;
        text-align: center;
        color: var(--text-muted);
        font-size: 0.875rem;

        &.error {
            color: var(--error-primary);
        }
    }

    .questions-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .question-item {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        padding: 0.75rem;
        border: 1px solid var(--border-secondary);
        border-radius: 0.5rem;
        background-color: var(--surface-primary);
        transition: all 0.2s ease;

        &.dragging {
            opacity: 0.5;
        }

        &.drag-over {
            border-color: var(--accent-primary);
            background-color: var(--surface-secondary);
        }
    }

    .drag-handle {
        display: flex;
        align-items: center;
        color: var(--text-muted);
        cursor: grab;

        &:active {
            cursor: grabbing;
        }
    }

    .question-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .question-input {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--border-primary);
        border-radius: 0.375rem;
        background-color: var(--input-bg, var(--surface-secondary));
        color: var(--text-primary);
        font-size: 0.875rem;
        font-weight: 500;
        transition: all 0.2s ease;

        &:hover {
            border-color: var(--border-hover, var(--accent-secondary));
        }

        &:focus {
            outline: none;
            border-color: var(--accent-primary);
            background-color: var(--input-bg-focus, var(--surface-primary));
            box-shadow: 0 0 0 3px var(--accent-bg, rgba(99, 102, 241, 0.1));
        }

        &::placeholder {
            color: var(--text-muted);
            font-weight: normal;
        }
    }

    .type-select {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--border-primary);
        border-radius: 0.375rem;
        background-color: var(--input-bg, var(--surface-secondary));
        color: var(--text-primary);
        font-size: 0.875rem;
        cursor: pointer;
        transition: all 0.2s ease;
        min-width: 150px;

        &:hover {
            border-color: var(--border-hover, var(--accent-secondary));
        }

        &:focus {
            outline: none;
            border-color: var(--accent-primary);
            background-color: var(--input-bg-focus, var(--surface-primary));
            box-shadow: 0 0 0 3px var(--accent-bg, rgba(99, 102, 241, 0.1));
        }
    }

    .delete-button {
        padding: 0.5rem;
        border: none;
        border-radius: 0.375rem;
        background-color: transparent;
        color: var(--error-primary);
        cursor: pointer;
        transition: background-color 0.2s ease;

        &:hover {
            background-color: var(--error-bg);
        }
    }

    .warning-message {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        border: 1px solid var(--warning-border);
        border-radius: 0.375rem;
        background-color: var(--warning-bg);
        color: var(--warning-text);
        font-size: 0.875rem;
        margin: 0;
    }
</style>
