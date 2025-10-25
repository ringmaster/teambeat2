<script lang="ts">
interface Props {
	visible?: boolean;
	onStartPoll: (config: PollConfig) => void;
	onClose: () => void;
}

export interface PollConfig {
	type: "timer" | "roman" | "fist-of-five" | "multiple-choice";
	question?: string;
	choices?: string[];
	durationSeconds: number;
}

let { visible = false, onStartPoll, onClose }: Props = $props();

let selectedType = $state<PollConfig["type"]>("timer");
let question = $state("");
let choices = $state<string[]>(["", ""]);
let questionError = $state(false);
let choicesError = $state(false);

// Add a new choice field when the last fields are filled
$effect(() => {
	if (selectedType === "multiple-choice") {
		const filledChoices = choices.filter((c) => c.trim() !== "");
		const hasEmptyChoices = choices.some((c) => c.trim() === "");

		if (filledChoices.length >= 2 && !hasEmptyChoices && choices.length < 5) {
			choices = [...choices, ""];
		}
	}
});

function selectPollType(type: PollConfig["type"]) {
	selectedType = type;
	// Reset errors when changing type
	questionError = false;
	choicesError = false;
}

function handleDurationClick(seconds: number) {
	// Validate based on poll type
	if (selectedType !== "timer") {
		if (!question.trim()) {
			questionError = true;
			return;
		}

		if (selectedType === "multiple-choice") {
			const validChoices = choices.filter((c) => c.trim() !== "");
			if (validChoices.length < 2) {
				choicesError = true;
				return;
			}
		}
	}

	// Build poll config
	const config: PollConfig = {
		type: selectedType,
		durationSeconds: seconds,
	};

	if (selectedType !== "timer") {
		config.question = question.trim();

		if (selectedType === "multiple-choice") {
			config.choices = choices.filter((c) => c.trim() !== "");
		}
	}

	onStartPoll(config);
	resetForm();
}

function handleQuestionInput() {
	if (questionError && question.trim()) {
		questionError = false;
	}
}

function handleChoiceInput(index: number) {
	if (choicesError) {
		const validChoices = choices.filter((c) => c.trim() !== "");
		if (validChoices.length >= 2) {
			choicesError = false;
		}
	}
}

function resetForm() {
	selectedType = "timer";
	question = "";
	choices = ["", ""];
	questionError = false;
	choicesError = false;
}

function handleBackdropClick(event: MouseEvent) {
	if (event.target === event.currentTarget) {
		onClose();
		resetForm();
	}
}

function handleBackdropKeydown(event: KeyboardEvent) {
	if (event.key === "Escape") {
		onClose();
		resetForm();
	}
}
</script>

{#if visible}
	<div class="poll-dropdown-backdrop" onclick={handleBackdropClick} onkeydown={handleBackdropKeydown} role="button" tabindex="-1">
		<div class="poll-dropdown" role="dialog" aria-label="Configure Poll">
			<!-- Poll Type Selector -->
			<div class="poll-types">
				<button
					class="poll-type-btn {selectedType === 'timer' ? 'active' : ''} cooltipz--top"
					onclick={() => selectPollType('timer')}
					type="button"
					aria-label="Simple discussion timer with extension voting"
				>
					<span class="poll-type-icon">⏱️</span>
				</button>
				<button
					class="poll-type-btn {selectedType === 'roman' ? 'active' : ''} cooltipz--top"
					onclick={() => selectPollType('roman')}
					type="button"
					aria-label="Roman voting: Support, Oppose, or Abstain"
				>
					<span class="poll-type-icon">👍👎👋</span>
				</button>
				<button
					class="poll-type-btn {selectedType === 'fist-of-five' ? 'active' : ''} cooltipz--top"
					onclick={() => selectPollType('fist-of-five')}
					type="button"
					aria-label="Fist of Five: Rate from 0 to 5"
				>
					<span class="poll-type-icon">👊🖐️</span>
				</button>
				<button
					class="poll-type-btn {selectedType === 'multiple-choice' ? 'active' : ''} cooltipz--top"
					onclick={() => selectPollType('multiple-choice')}
					type="button"
					aria-label="Custom multiple choice poll"
				>
					<span class="poll-type-icon">☑️</span>
				</button>
			</div>

			<!-- Question Input (shown for all types except timer) -->
			{#if selectedType !== 'timer'}
				<div class="poll-question">
					<input
						type="text"
						bind:value={question}
						oninput={handleQuestionInput}
						placeholder="What are we deciding?"
						class="question-input {questionError ? 'error' : ''}"
					/>
				</div>
			{/if}

			<!-- Multiple Choice Options -->
			{#if selectedType === 'multiple-choice'}
				<div class="poll-choices">
					{#each choices as choice, i}
						<input
							type="text"
							bind:value={choices[i]}
							oninput={() => handleChoiceInput(i)}
							placeholder="Choice {i + 1}"
							class="choice-input {choicesError && !choice.trim() ? 'error' : ''}"
						/>
					{/each}
				</div>
			{/if}

			<!-- Duration Buttons -->
			<div class="poll-durations">
				<button type="button" class="duration-btn" onclick={() => handleDurationClick(3)}>0:03</button>
				<button type="button" class="duration-btn" onclick={() => handleDurationClick(30)}>0:30</button>
				<button type="button" class="duration-btn" onclick={() => handleDurationClick(60)}>1:00</button>
				<button type="button" class="duration-btn" onclick={() => handleDurationClick(120)}>2:00</button>
				<button type="button" class="duration-btn" onclick={() => handleDurationClick(300)}>5:00</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.poll-dropdown-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.2);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.poll-dropdown {
		background: white;
		border-radius: 12px;
		padding: 20px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
		min-width: 320px;
		max-width: 400px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.poll-types {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
	}

	.poll-type-btn {
		padding: 12px 8px;
		border: 2px solid #e1e4e8;
		border-radius: 8px;
		background: white;
		cursor: pointer;
		transition: all 150ms ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.poll-type-btn:hover {
		background: #f6f8fa;
		border-color: #d0d7de;
	}

	.poll-type-btn.active {
		background: #ddf4ff;
		border-color: #54aeff;
	}

	.poll-type-icon {
		font-size: 24px;
		line-height: 1;
	}

	.poll-question {
		display: flex;
		flex-direction: column;
	}

	.question-input {
		padding: 10px 12px;
		border: 2px solid #e1e4e8;
		border-radius: 8px;
		font-size: 14px;
		transition: border-color 150ms ease;
	}

	.question-input:focus {
		outline: none;
		border-color: #54aeff;
	}

	.question-input.error {
		border-color: #d73a49;
		animation: shake 300ms ease;
	}

	.poll-choices {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.choice-input {
		padding: 8px 12px;
		border: 2px solid #e1e4e8;
		border-radius: 6px;
		font-size: 14px;
		transition: border-color 150ms ease;
	}

	.choice-input:focus {
		outline: none;
		border-color: #54aeff;
	}

	.choice-input.error {
		border-color: #d73a49;
		animation: shake 300ms ease;
	}

	.poll-durations {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 8px;
	}

	.duration-btn {
		padding: 10px;
		border: 1px solid #e1e4e8;
		border-radius: 6px;
		background: #f6f8fa;
		cursor: pointer;
		font-weight: 500;
		font-size: 14px;
		transition: all 150ms ease;
	}

	.duration-btn:hover {
		background: #e1e4e8;
	}

	.duration-btn:active {
		transform: scale(0.97);
	}

	@keyframes shake {
		0%, 100% { transform: translateX(0); }
		25% { transform: translateX(-4px); }
		75% { transform: translateX(4px); }
	}
</style>
