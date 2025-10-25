<script lang="ts">
import { onDestroy } from "svelte";
import { fly } from "svelte/transition";

interface Props {
	visible?: boolean;
	enableMenu?: boolean;
	pollType?: "timer" | "roman" | "fist-of-five" | "multiple-choice";
	question?: string;
	choices?: string[];
	votes?: Record<string, number>;
	totalVotes?: number;
	onvote?: (choice: string) => void;
	onaddtime?: (seconds: number) => void;
	onstopTimer?: () => void;
	onrecordagreement?: (pollData: {
		pollType: string;
		question: string;
		choices: string[];
		votes: Record<string, number>;
		votingOptions: Array<{ key: string; label: string; icon: string }>;
	}) => void;
}

let {
	visible = false,
	enableMenu = false,
	pollType = "timer",
	question = "",
	choices = [],
	votes = {},
	totalVotes = 0,
	onvote,
	onaddtime,
	onstopTimer,
	onrecordagreement,
}: Props = $props();

let remaining = $state(0);
let passed = $state(0);
let total = $state(1);
let running = $state(false);
let showVotes = $state(false);
let hoverMenuOpen = $state(false);
let animKey = $state(0);
let menuCloseTimeout: number | ReturnType<typeof setTimeout> | null = null;

let _tickId: number | null = null;
let _lastAt = performance.now();

function handleDialMouseEnter() {
	if (!enableMenu) return;
	if (menuCloseTimeout) {
		clearTimeout(menuCloseTimeout);
		menuCloseTimeout = null;
	}
	hoverMenuOpen = true;
}

function handleDialMouseLeave() {
	if (!enableMenu) return;
	menuCloseTimeout = setTimeout(() => {
		hoverMenuOpen = false;
		menuCloseTimeout = null;
	}, 300);
}

function handleMenuMouseEnter() {
	if (menuCloseTimeout) {
		clearTimeout(menuCloseTimeout);
		menuCloseTimeout = null;
	}
}

function handleMenuMouseLeave() {
	menuCloseTimeout = setTimeout(() => {
		hoverMenuOpen = false;
		menuCloseTimeout = null;
	}, 300);
}

export function setTimer(rem: number, pas: number = 0) {
	if (rem < 0) rem = 0;
	if (pas < 0) pas = 0;
	if (rem == 0 && pas == 0) {
		showVotes = false;
		running = false;
		_stopTick();
		return;
	}
	remaining = rem;
	passed = pas;
	total = Math.max(1, remaining + passed);
	running = remaining > 0;
	_ensureTicking();
	_updateVotingState(true);
}

export function stop() {
	_stopTick();
	remaining = 0;
	passed = 0;
	total = 1;
	running = false;
	showVotes = false;
}

function _ensureTicking() {
	if (!running) {
		_stopTick();
		return;
	}
	if (_tickId !== null) return;
	_lastAt = performance.now();
	_tickId = window.setInterval(_onTick, 100);
}

function _stopTick() {
	if (_tickId !== null) {
		clearInterval(_tickId);
		_tickId = null;
	}
}

function _onTick() {
	const now = performance.now();
	const dt = (now - _lastAt) / 1000;
	_lastAt = now;

	if (!running) {
		_stopTick();
		return;
	}

	remaining = Math.max(0, remaining - dt);
	if (remaining === 0) {
		running = false;
		_stopTick();
		new Audio("/alarmding3.mp3").play();
	}
	// Only update voting state during tick for timer mode
	// For other poll types, votes are always shown
	if (pollType === "timer") {
		_updateVotingState(false);
	}
}

function _updateVotingState(_fromSetTimer: boolean) {
	const was = showVotes;
	// For timer mode, show votes at 10 seconds
	// For voting polls, always show votes immediately
	if (pollType === "timer") {
		showVotes = remaining <= 10 ? true : remaining >= 11 ? false : showVotes;
		if (!was && showVotes && remaining <= 10) {
			animKey++;
		}
	} else {
		showVotes = true;
		if (!was && showVotes && _fromSetTimer) {
			animKey++;
		}
	}
}

const secondsInt = $derived(Math.ceil(remaining));
const timeLabel = $derived(
	`${Math.floor(secondsInt / 60)}:${String(secondsInt % 60).padStart(2, "0")}`,
);

const fraction = $derived(Math.max(0, Math.min(1, remaining / total)));
const dashLen = $derived(
	Math.round(283 * (fraction - (1 / total) * (1 - fraction))),
);
const dashArray = $derived(`${Math.max(0, Math.min(283, dashLen))} 283`);

function lerpColor(c1: number[], c2: number[], t: number): string {
	const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
	const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
	const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
	return `rgb(${r}, ${g}, ${b})`;
}

const currentColor = $derived.by(() => {
	const green = [79, 160, 82];
	const yellow = [242, 168, 0];
	const red = [192, 90, 90];

	if (remaining > 20) return `rgb(${green.join(",")})`;
	if (remaining > 10) {
		const t = (20 - remaining) / 10;
		return lerpColor(green, yellow, t);
	}
	if (remaining > 3) {
		const t = (10 - remaining) / 7;
		return lerpColor(yellow, red, t);
	}
	return `rgb(${red.join(",")})`;
});

function percent(count: number, total: number): string {
	const p = total > 0 ? (count / total) * 100 : 0;
	return `${p.toFixed(0)}%`;
}

function handleVote(choice: string) {
	if (onvote) {
		onvote(choice);
	}
}

// Calculate the maximum vote count to highlight top votes
const maxVoteCount = $derived.by(() => {
	const voteCounts = Object.values(votes);
	return voteCounts.length > 0 ? Math.max(...voteCounts) : 0;
});

// Check if an option has the top vote count
function isTopVote(optionKey: string): boolean {
	const voteCount = votes[optionKey] || 0;
	return voteCount > 0 && voteCount === maxVoteCount;
}

// Build voting options based on poll type
const votingOptions = $derived.by(() => {
	if (pollType === "timer") {
		return [
			{ key: "A", label: "More Time", icon: "" },
			{ key: "B", label: "Move On", icon: "" },
		];
	} else if (pollType === "roman") {
		return [
			{ key: "support", label: "Support", icon: "👍" },
			{ key: "oppose", label: "Oppose", icon: "👎" },
			{ key: "abstain", label: "Abstain", icon: "👋" },
		];
	} else if (pollType === "fist-of-five") {
		return [
			{ key: "0", label: "0", icon: "" },
			{ key: "1", label: "1", icon: "" },
			{ key: "2", label: "2", icon: "" },
			{ key: "3", label: "3", icon: "" },
			{ key: "4", label: "4", icon: "" },
			{ key: "5", label: "5", icon: "" },
		];
	} else if (pollType === "multiple-choice") {
		return choices.map((choice, i) => ({
			key: `choice_${i}`,
			label: choice,
			icon: "",
		}));
	}
	return [];
});

function handleAdd(seconds: number) {
	if (onaddtime) {
		onaddtime(seconds);
	}
}

function handleStopClick() {
	hoverMenuOpen = false;
	if (onstopTimer) {
		onstopTimer();
	}
}

function handleRecordAgreement() {
	hoverMenuOpen = false;
	if (onrecordagreement) {
		onrecordagreement({
			pollType,
			question,
			choices,
			votes,
			votingOptions,
		});
	}
}

$effect(() => {
	if (!visible) {
		_stopTick();
	}
});

// Update voting state when poll type changes or when visible changes
$effect(() => {
	// For non-timer poll types, always show votes immediately when running
	if (pollType !== "timer" && running) {
		if (!showVotes) {
			showVotes = true;
			animKey++;
		}
	}
});

onDestroy(() => {
	_stopTick();
	if (menuCloseTimeout) {
		clearTimeout(menuCloseTimeout);
		menuCloseTimeout = null;
	}
});
</script>

{#if visible}
    <div class="timer-root" transition:fly={{ y: 200, duration: 500 }}>
        <div
            class="timerbox {showVotes ? 'expanded' : ''} poll-type-{pollType}"
            data-anim-key={animKey}
        >
            {#if showVotes}
                {#key animKey}
                    <div class="timerdetail poll-type-{pollType}">
                        {#if pollType !== "timer" && question}
                            <div class="poll-question-display">
                                {question}
                            </div>
                        {/if}
                        {#each votingOptions as option}
                            <button
                                class="vote-btn"
                                onclick={() => handleVote(option.key)}
                                tabindex="0"
                            >
                                <span class="vote-label">
                                    {#if option.icon}{option.icon}{/if}
                                    {option.label}
                                </span>
                                <div class="bar">
                                    <div
                                        class="fill {isTopVote(option.key)
                                            ? 'top-vote'
                                            : ''}"
                                        style="width: {percent(
                                            votes[option.key] || 0,
                                            totalVotes,
                                        )};"
                                    ></div>
                                </div>
                            </button>
                        {/each}
                    </div>
                {/key}
            {/if}

            <div
                class="dial-container"
                role={enableMenu ? "button" : undefined}
                aria-haspopup={enableMenu ? "true" : "false"}
                aria-expanded={hoverMenuOpen ? "true" : "false"}
                tabindex="-1"
                onmouseenter={handleDialMouseEnter}
                onmouseleave={handleDialMouseLeave}
            >
                <div
                    class="dial"
                    role="timer"
                    aria-live="polite"
                    aria-label={`Time remaining: ${Math.floor(secondsInt / 60)} minutes ${secondsInt % 60} seconds`}
                >
                    <svg
                        class="svg"
                        viewBox="0 0 100 100"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <g class="circle">
                            <circle class="elapsed" cx="50" cy="50" r="45"
                            ></circle>
                            <path
                                class="remaining"
                                style="stroke: {currentColor}"
                                stroke-dasharray={dashArray}
                                d="M 50,50 m -45,0 a 45,45 0 1,0 90,0 a 45,45 0 1,0 -90,0"
                            />
                        </g>
                    </svg>
                    <span class="label">{timeLabel}</span>
                </div>

                {#if enableMenu && hoverMenuOpen}
                    <div
                        class="menu"
                        role="menu"
                        tabindex="-1"
                        onmouseenter={handleMenuMouseEnter}
                        onmouseleave={handleMenuMouseLeave}
                    >
                        <button onclick={() => handleAdd(3)}>+ 0:03</button>
                        <button onclick={() => handleAdd(30)}>+ 0:30</button>
                        <button onclick={() => handleAdd(60)}>+ 1:00</button>
                        <button onclick={() => handleAdd(300)}>+ 5:00</button>
                        <hr />
                        {#if pollType !== "timer" && question}
                            <button onclick={handleRecordAgreement}
                                >Record as Agreement</button
                            >
                        {/if}
                        <button onclick={handleStopClick}>Cancel Timer</button>
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}

<style>
    :root {
        --timer-bg: rgba(255, 255, 255, 0.95);
        --timer-border: #ddd;
        --timer-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        --timer-track: #e5e5e5;
        --timer-green: #4fa052;
        --timer-yellow: #f2a800;
        --timer-red: #c05a5a;
        --timer-text: #333;
        --timer-button-bg: #f8f9fa;
        --timer-button-text: #333;
        --timer-bar-bg: #e9ecef;
        --timer-bar-fill: #3c495b;
    }

    .timer-root {
        position: fixed;
        bottom: 4rem;
        right: 1rem;
        z-index: 100;
    }

    .timerbox {
        width: 60px;
        height: 60px;
        border-radius: 30px;
        border: 1px solid var(--timer-border);
        display: flex;
        justify-content: flex-end;
        align-items: flex-end;
        background: var(--timer-bg);
        box-shadow: var(--timer-shadow);
        transition:
            width 300ms cubic-bezier(0.4, 0, 0.2, 1) 100ms,
            height 300ms cubic-bezier(0.4, 0, 0.2, 1),
            border-radius 300ms cubic-bezier(0.4, 0, 0.2, 1) 200ms;
    }

    .timerbox.expanded {
        width: 280px;
        height: auto;
        min-height: 60px;
        border-radius: 8px 8px 30px 8px;
        padding: 0px;
        gap: 8px;
        align-items: end;
        max-width: 90vw;
    }

    .timerdetail {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 6px;
        animation: slideIn 400ms cubic-bezier(0.4, 0, 0.2, 1) 300ms both;
        margin: 8px;
    }

    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateX(20px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }

    .vote-btn {
        width: 100%;
        padding: 8px 12px;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 4px;
        background: var(--timer-button-bg);
        color: var(--timer-button-text);
        border: 1px solid #e1e4e8;
        border-radius: 6px;
        cursor: pointer;
        transition: background-color 150ms ease;
        font-size: 13px;
    }

    .vote-btn:hover {
        background: #f0f1f3;
    }

    .vote-label {
        font-weight: 500;
        text-align: left;
    }

    .bar {
        width: 100%;
        height: 6px;
        background: var(--timer-bar-bg);
        border-radius: 3px;
        overflow: hidden;
    }

    .fill {
        height: 100%;
        transition: width 300ms ease;
        background-color: var(--timer-bar-fill);
    }

    .dial-container {
        position: relative;
        width: 58px;
        height: 58px;
        flex-shrink: 0;
    }

    .dial {
        position: relative;
        width: 58px;
        height: 58px;
        cursor: default;
    }

    .svg {
        width: 100%;
        height: 100%;
        transform: scaleX(-1) rotate(-90deg);
    }

    .circle {
        fill: white;
        stroke: none;
    }

    .elapsed {
        stroke-width: 7;
        stroke: var(--timer-track);
        fill: none;
    }

    .remaining {
        stroke-width: 7;
        stroke-linecap: round;
        fill: none;
        transform-origin: center;
        transition:
            stroke-dasharray 1s linear,
            stroke 200ms linear;
    }

    .label {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font:
            bold 15px "SF Mono",
            "Monaco",
            "Inconsolata",
            "Fira Code",
            monospace;
        color: var(--timer-text);
        user-select: none;
    }

    .menu {
        position: absolute;
        bottom: 100%;
        right: 0;
        background: white;
        border: 1px solid #e1e4e8;
        border-radius: 8px;
        padding: 4px;
        padding-top: 12px; /* Add padding to create visual space but keep hover area continuous */
        z-index: 1000;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        min-width: 120px;
    }

    .menu > button {
        display: block;
        width: 100%;
        text-align: left;
        padding: 6px 12px;
        background: none;
        border: none;
        cursor: pointer;
        font-size: 13px;
        color: #333;
        border-radius: 4px;
        transition: background-color 150ms ease;
    }

    .menu > button:hover {
        background: #f6f8fa;
    }

    .menu hr {
        border: 0;
        border-top: 1px solid #e1e4e8;
        margin: 4px 0;
    }

    .poll-question-display {
        font-weight: 600;
        font-size: 14px;
        color: #24292e;
        padding: 0 12px 8px 12px;
        text-align: left;
        line-height: 1.3;
        word-break: break-word;
    }

    /* Fist of Five horizontal layout */
    .timerbox.poll-type-fist-of-five.expanded {
        width: auto;
        min-width: 400px;
        max-width: 600px;
    }

    .timerdetail.poll-type-fist-of-five {
        flex-direction: row !important;
        flex-wrap: wrap;
        justify-content: center;
        gap: 4px;
        padding: 8px;
    }

    .timerdetail.poll-type-fist-of-five .vote-btn {
        flex: 0 0 auto;
        width: auto !important;
        min-width: 60px;
        max-width: 80px;
        margin: 0;
    }

    .timerdetail.poll-type-fist-of-five .poll-question-display {
        flex: 1 1 100%;
        width: 100%;
        text-align: center;
        margin-bottom: 4px;
    }

    /* Top vote highlighting */
    .fill.top-vote {
        background: #28a745 !important;
    }
</style>
