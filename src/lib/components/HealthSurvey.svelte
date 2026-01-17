<script lang="ts">
import { onMount } from "svelte";
import { browser } from "$app/environment";
import { toastStore } from "$lib/stores/toast";
import AgreeDisagreeInput from "./health/AgreeDisagreeInput.svelte";
import BooleanInput from "./health/BooleanInput.svelte";
import FacilitatorToolbar from "./health/FacilitatorToolbar.svelte";
import Range1to5Input from "./health/Range1to5Input.svelte";
import RedYellowGreenInput from "./health/RedYellowGreenInput.svelte";
import SurveyResults from "./health/SurveyResults.svelte";

interface Props {
	scene: any;
	boardId: string;
	boardStatus: string;
	userRole: string;
	allScenes?: any[];
	onContinue?: (scene: any) => void;
}

const { scene, boardId, boardStatus, userRole, allScenes = [], onContinue }: Props = $props();

const isFacilitator = $derived(["admin", "facilitator"].includes(userRole));

let questions = $state<any[]>([]);
let responses = $state<Map<string, number>>(new Map());
let loading = $state(true);
let error = $state<string | null>(null);

const isDisabled = $derived(!["draft", "active"].includes(boardStatus));

// Survey completion tracking
const surveyCompleted = $derived(
	questions.length > 0 && questions.every((q) => responses.has(q.id))
);

// Get continuation scene if available
const continuationScene = $derived.by(() => {
	if (!scene.continuationEnabled || !scene.continuationSceneId) return null;
	return allScenes.find((s: any) => s.id === scene.continuationSceneId) || null;
});

// Show continuation option when: completed and continuation is configured
const canContinue = $derived(
	surveyCompleted &&
	continuationScene !== null &&
	scene.displayMode !== "results"
);

function handleContinue() {
	if (continuationScene && onContinue) {
		onContinue(continuationScene);
	}
}

async function loadQuestions() {
	try {
		loading = true;
		error = null;

		// Load questions
		const questionsRes = await fetch(
			`/api/scenes/${scene.id}/health-questions`,
		);
		const questionsData = await questionsRes.json();

		if (!questionsData.success) {
			throw new Error(questionsData.error || "Failed to load questions");
		}

		questions = questionsData.questions;

		// Load user's existing responses
		const responsesRes = await fetch(
			`/api/scenes/${scene.id}/health-responses`,
		);
		const responsesData = await responsesRes.json();

		if (!responsesData.success) {
			throw new Error(responsesData.error || "Failed to load responses");
		}

		// Build responses map
		const newResponses = new Map();
		responsesData.responses.forEach((r: any) => {
			newResponses.set(r.questionId, r.rating);
		});
		responses = newResponses;
	} catch (err) {
		console.error("Failed to load health survey:", err);
		error = err instanceof Error ? err.message : "Failed to load health survey";
	} finally {
		loading = false;
	}
}

async function handleResponse(questionId: string, rating: number) {
	try {
		const res = await fetch("/api/health-responses", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ questionId, rating }),
		});

		const data = await res.json();

		if (!data.success) {
			throw new Error(data.error || "Failed to save response");
		}

		// Update local state
		responses = new Map(responses).set(questionId, rating);
	} catch (err) {
		console.error("Failed to save response:", err);
		toastStore.error(
			err instanceof Error ? err.message : "Failed to save response",
		);
	}
}

async function handleModeChange(mode: "collecting" | "results") {
	try {
		const res = await fetch(`/api/boards/${boardId}/scenes/${scene.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ displayMode: mode }),
		});

		const data = await res.json();

		if (!data.success) {
			throw new Error(data.error || "Failed to change mode");
		}

		// Scene will be updated via SSE event
	} catch (err) {
		console.error("Failed to change mode:", err);
		toastStore.error(
			err instanceof Error ? err.message : "Failed to change mode",
		);
	}
}

async function handleFocusChange(questionId: string | null) {
	try {
		const res = await fetch(`/api/boards/${boardId}/scenes/${scene.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ focusedQuestionId: questionId }),
		});

		const data = await res.json();

		if (!data.success) {
			throw new Error(data.error || "Failed to change focus");
		}

		// Scene will be updated via SSE event
	} catch (err) {
		console.error("Failed to change focus:", err);
		toastStore.error(
			err instanceof Error ? err.message : "Failed to change focus",
		);
	}
}

onMount(() => {
	loadQuestions();

	// Listen for scene updates (only in browser)
	if (browser) {
		const handleSceneUpdate = (event: CustomEvent) => {
			if (event.detail.sceneId === scene.id) {
				loadQuestions();
			}
		};

		window.addEventListener(
			"scene_updated",
			handleSceneUpdate as EventListener,
		);

		return () => {
			window.removeEventListener(
				"scene_updated",
				handleSceneUpdate as EventListener,
			);
		};
	}
});

// Reload when scene changes
$effect(() => {
	if (scene.id) {
		loadQuestions();
	}
});
</script>

<div class="health-survey">
    <FacilitatorToolbar
        sceneId={scene.id}
        {boardId}
        displayMode={scene.displayMode || 'collecting'}
        {isFacilitator}
        onModeChange={handleModeChange}
    />

    {#if scene.displayMode === 'results'}
        <SurveyResults
            sceneId={scene.id}
            {boardId}
            {boardStatus}
            focusedQuestionId={scene.focusedQuestionId}
            {isFacilitator}
            sceneFlags={scene.flags || []}
            onFocusChange={handleFocusChange}
        />
    {:else}
        <div class="survey-content">
            {#if loading}
                <div class="loading-state">
                    <p>Loading survey...</p>
                </div>
            {:else if error}
                <div class="error-state">
                    <p>Error: {error}</p>
                    <button onclick={loadQuestions} type="button">Retry</button>
                </div>
            {:else if questions.length === 0}
                <div class="empty-state">
                    <p>No questions configured for this survey</p>
                </div>
            {:else}
                <div class="questions-list">
                    {#each questions as question (question.id)}
                        <div class="question-item">
                            <div class="question-header">
                                <h3 class="question-text">{question.question}</h3>
                                {#if question.description}
                                    <p class="question-description">{question.description}</p>
                                {/if}
                            </div>

                            <div class="question-input">
                                {#if question.questionType === 'boolean'}
                                    <BooleanInput
                                        {question}
                                        value={responses.get(question.id)}
                                        disabled={isDisabled}
                                        onchange={(rating) => handleResponse(question.id, rating)}
                                    />
                                {:else if question.questionType === 'range1to5'}
                                    <Range1to5Input
                                        {question}
                                        value={responses.get(question.id)}
                                        disabled={isDisabled}
                                        onchange={(rating) => handleResponse(question.id, rating)}
                                    />
                                {:else if question.questionType === 'agreetodisagree'}
                                    <AgreeDisagreeInput
                                        {question}
                                        value={responses.get(question.id)}
                                        disabled={isDisabled}
                                        onchange={(rating) => handleResponse(question.id, rating)}
                                    />
                                {:else if question.questionType === 'redyellowgreen'}
                                    <RedYellowGreenInput
                                        {question}
                                        value={responses.get(question.id)}
                                        disabled={isDisabled}
                                        onchange={(rating) => handleResponse(question.id, rating)}
                                    />
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>

                {#if canContinue && continuationScene}
                    <div class="survey-completed-banner">
                        <div class="completion-message">
                            <span class="completion-icon">&#10003;</span>
                            <span class="completion-text">Survey complete! Continue working while others finish.</span>
                        </div>
                        <button
                            type="button"
                            class="continue-button"
                            onclick={handleContinue}
                            aria-label="Continue to {continuationScene.title}"
                        >
                            Continue to {continuationScene.title}
                        </button>
                    </div>
                {:else if surveyCompleted && scene.displayMode !== "results"}
                    <div class="survey-completed-banner completed-only">
                        <div class="completion-message">
                            <span class="completion-icon">&#10003;</span>
                            <span class="completion-text">Survey complete!</span>
                        </div>
                    </div>
                {/if}
            {/if}
        </div>
    {/if}
</div>

<style lang="less">
    .health-survey {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
    }

    .survey-content {
        flex: 1;
        overflow-y: auto;
        padding: 2rem;
        max-width: 800px;
        margin: 0 auto;
        width: 100%;
    }

    .loading-state,
    .error-state,
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--text-muted);
        gap: 1rem;

        p {
            margin: 0;
            font-size: 1.125rem;
        }

        button {
            padding: 0.5rem 1rem;
            border: 1px solid var(--border-primary);
            border-radius: 0.375rem;
            background-color: var(--surface-secondary);
            color: var(--text-primary);
            font-size: 0.875rem;
            cursor: pointer;

            &:hover {
                background-color: var(--surface-tertiary);
            }
        }
    }

    .questions-list {
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }

    .question-item {
        padding: 1.5rem;
        border: 1px solid var(--border-secondary);
        border-radius: 0.5rem;
        background-color: var(--surface-primary);
    }

    .question-header {
        margin-bottom: 1rem;
    }

    .question-text {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--text-primary);
    }

    .question-description {
        margin: 0.5rem 0 0;
        font-size: 0.875rem;
        color: var(--text-muted);
        font-style: italic;
    }

    .question-input {
        margin-top: 0.75rem;
    }

    .survey-completed-banner {
        margin-top: 2rem;
        padding: 1.5rem;
        background: linear-gradient(135deg,
            color-mix(in srgb, var(--color-success, #22c55e) 10%, transparent),
            color-mix(in srgb, var(--color-primary) 5%, transparent)
        );
        border: 1px solid var(--color-success, #22c55e);
        border-radius: 0.75rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        text-align: center;

        &.completed-only {
            background: linear-gradient(135deg,
                color-mix(in srgb, var(--color-success, #22c55e) 8%, transparent),
                color-mix(in srgb, var(--color-secondary) 5%, transparent)
            );
        }
    }

    .completion-message {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-size: 1.125rem;
        font-weight: 500;
        color: var(--text-primary);
    }

    .completion-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        background-color: var(--color-success, #22c55e);
        color: white;
        border-radius: 50%;
        font-size: 1rem;
        font-weight: bold;
    }

    .continue-button {
        padding: 0.75rem 1.5rem;
        background: var(--btn-primary-bg);
        color: var(--btn-primary-text);
        border: none;
        border-radius: 0.5rem;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: var(--shadow-sm);

        &:hover {
            background: var(--btn-primary-bg-hover);
            transform: translateY(-1px);
            box-shadow: var(--shadow-md);
        }

        &:active {
            transform: translateY(0);
        }
    }
</style>
