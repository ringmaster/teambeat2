<script lang="ts">
import { SCENE_FLAGS } from "$lib/scene-flags";
import { toastStore } from "$lib/stores/toast";
import type { BoardStatus } from "$lib/types";
import { getSceneCapability } from "$lib/utils/scene-capability";

interface Props {
	result: any;
	sceneId: string;
	boardId: string;
	boardStatus: string;
	isFacilitator: boolean;
	sceneFlags: string[];
	onBack: () => void;
}

const {
	result,
	sceneId,
	boardId,
	boardStatus,
	isFacilitator,
	sceneFlags,
	onBack,
}: Props = $props();

// Create a minimal scene object for capability checking
const scene = $derived({ id: sceneId, flags: sceneFlags });

const canAddCards = $derived(
	getSceneCapability(
		scene,
		boardStatus as BoardStatus,
		SCENE_FLAGS.ALLOW_ADD_CARDS,
	),
);

let columns = $state<any[]>([]);
let loadingColumns = $state(false);
let dropdownOpen = $state(false);
let copyingToCard = $state(false);

async function loadColumns() {
	try {
		loadingColumns = true;
		const res = await fetch(`/api/boards/${boardId}`);
		const data = await res.json();

		if (data.success && data.board.columns) {
			columns = data.board.columns;
		}
	} catch (err) {
		console.error("Failed to load columns:", err);
	} finally {
		loadingColumns = false;
	}
}

async function handleCopyToCard(columnId: string) {
	try {
		copyingToCard = true;
		const res = await fetch(
			`/api/health-questions/${result.question.id}/copy-to-card`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ column_id: columnId }),
			},
		);

		const data = await res.json();

		if (!data.success) {
			throw new Error(data.error || "Failed to copy to card");
		}

		toastStore.success("Question results copied to column");
		dropdownOpen = false;
	} catch (err) {
		console.error("Failed to copy to card:", err);
		toastStore.error(
			err instanceof Error ? err.message : "Failed to copy to card",
		);
	} finally {
		copyingToCard = false;
	}
}

function closeDropdown() {
	dropdownOpen = false;
}

function clickOutside(node: HTMLElement, handler: () => void) {
	const handleClick = (event: MouseEvent) => {
		if (node && !node.contains(event.target as Node)) {
			handler();
		}
	};

	document.addEventListener("click", handleClick, true);

	return {
		destroy() {
			document.removeEventListener("click", handleClick, true);
		},
	};
}

function getDistributionLabel(questionType: string, rating: number): string {
	if (questionType === "redyellowgreen") {
		if (rating === 1) return "🔴 Red";
		if (rating === 3) return "🟡 Yellow";
		if (rating === 5) return "🟢 Green";
	} else if (questionType === "boolean") {
		return rating === 0 ? "No" : "Yes";
	} else if (questionType === "agreetodisagree") {
		const labels = [
			"",
			"Strongly Disagree",
			"Disagree",
			"Neutral",
			"Agree",
			"Strongly Agree",
		];
		return labels[rating] || String(rating);
	}
	return String(rating);
}

// Load columns when component mounts if user is facilitator and can edit cards
$effect(() => {
	if (isFacilitator && canAddCards && columns.length === 0) {
		loadColumns();
	}
});
</script>

<div class="question-detail">
    <div class="detail-header">
        <button type="button" class="back-button" onclick={onBack}>
            ← Back to Overview
        </button>
    </div>

    <div class="detail-content">
        <div class="question-info">
            <h2>{result.question.question}</h2>
            {#if result.question.description}
                <p class="description">{result.question.description}</p>
            {/if}
            <div class="stats">
                <div class="stat-item">
                    <span class="stat-label">Average:</span>
                    <span class="stat-value">{result.average.toFixed(2)}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Responses:</span>
                    <span class="stat-value">{result.totalResponses}</span>
                </div>
            </div>
        </div>

        {#if isFacilitator && canAddCards && columns.length > 0}
            <div class="facilitator-actions">
                <div
                    class="copy-to-column-menu"
                    use:clickOutside={closeDropdown}
                >
                    <button
                        type="button"
                        class="menu-button"
                        onclick={() => (dropdownOpen = !dropdownOpen)}
                        disabled={copyingToCard}
                    >
                        {copyingToCard ? "Copying..." : "Copy to Column..."}
                    </button>
                    {#if dropdownOpen}
                        <div class="dropdown-menu">
                            <div class="dropdown-header">Select column:</div>
                            {#each columns as column (column.id)}
                                <button
                                    type="button"
                                    class="dropdown-item"
                                    onclick={() => handleCopyToCard(column.id)}
                                    disabled={copyingToCard}
                                >
                                    {column.title}
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>
        {/if}

        <div class="distribution-section">
            <h3>Distribution</h3>
            <div class="distribution-chart">
                {#each Object.entries(result.distribution).sort((a, b) => Number(a[0]) - Number(b[0])) as [rating, count] (rating)}
                    <div class="distribution-bar">
                        <span class="bar-label">
                            {getDistributionLabel(
                                result.question.questionType,
                                Number(rating),
                            )}
                        </span>
                        <div class="bar-container">
                            <div
                                class="bar-fill"
                                style="width: {result.totalResponses > 0
                                    ? (Number(count) / result.totalResponses) *
                                      100
                                    : 0}%"
                            ></div>
                        </div>
                        <span class="bar-count">{count}</span>
                    </div>
                {/each}
            </div>
        </div>
    </div>
</div>

<style lang="less">
    .question-detail {
        flex: 1;
        overflow-y: auto;
        padding: 1.5rem;
        max-width: 900px;
        margin: 0 auto;
        width: 100%;
        background-color: var(--color-bg-primary);

        @media (min-width: 768px) {
            padding: 2rem;
        }
    }

    .detail-header {
        margin-bottom: 2rem;
    }

    .back-button {
        padding: 0.625rem 1.25rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        background-color: white;
        color: var(--color-text-primary);
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: var(--shadow-sm);
        min-height: 44px;

        &:hover {
            background-color: var(--surface-elevated);
            border-color: var(--color-primary);
            transform: translateY(-1px);
            box-shadow: var(--shadow-md);
        }

        &:active {
            transform: translateY(0);
        }
    }

    .detail-content {
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }

    .question-info {
        padding: 2rem;
        background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--color-primary) 3%, transparent),
            color-mix(in srgb, var(--color-tertiary) 3%, transparent)
        );
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);

        h2 {
            margin: 0 0 0.75rem;
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--color-text-primary);
            line-height: 1.3;

            @media (min-width: 768px) {
                font-size: 1.75rem;
            }
        }

        .description {
            margin: 0 0 1.25rem;
            color: var(--color-text-secondary);
            font-style: italic;
            line-height: 1.5;
        }
    }

    .stats {
        display: flex;
        gap: 3rem;
        margin-top: 1.5rem;
        flex-wrap: wrap;
    }

    .stat-item {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;

        .stat-label {
            font-size: 0.75rem;
            color: var(--color-text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            font-weight: 600;
        }

        .stat-value {
            font-size: 2rem;
            font-weight: 700;
            background: linear-gradient(
                135deg,
                var(--color-accent),
                var(--color-secondary)
            );
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
        }
    }

    .facilitator-actions {
        padding: 1.5rem;
        background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--color-accent) 5%, transparent),
            color-mix(in srgb, var(--color-secondary) 5%, transparent)
        );
        border: 1px solid
            color-mix(in srgb, var(--color-accent) 30%, transparent);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
    }

    .copy-to-column-menu {
        position: relative;

        .menu-button {
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: var(--radius-lg);
            background-color: var(--btn-accent-bg);
            color: var(--btn-accent-text);
            font-size: 0.875rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: var(--shadow-sm);
            min-height: 44px;

            &:hover:not(:disabled) {
                background-color: var(--btn-accent-bg-hover);
                transform: translateY(-1px);
                box-shadow: var(--shadow-md);
            }

            &:active:not(:disabled) {
                transform: translateY(0);
            }

            &:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
        }

        .dropdown-menu {
            position: absolute;
            top: 100%;
            left: 0;
            background: white;
            border: 1px solid var(--color-border);
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-lg);
            min-width: 220px;
            z-index: 1000;
            margin-top: 0.5rem;
            overflow: hidden;
        }

        .dropdown-header {
            padding: 0.75rem 1rem;
            font-size: 0.75rem;
            font-weight: 700;
            color: var(--color-text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            background-color: var(--surface-elevated);
            border-bottom: 1px solid var(--color-border);
        }

        .dropdown-item {
            display: block;
            width: 100%;
            padding: 0.75rem 1rem;
            background: white;
            border: none;
            text-align: left;
            cursor: pointer;
            font-size: 0.875rem;
            font-weight: 500;
            color: var(--color-text-primary);
            transition: all 0.15s ease;
            border-bottom: 1px solid
                color-mix(in srgb, var(--color-border) 30%, transparent);

            &:last-child {
                border-bottom: none;
            }

            &:hover:not(:disabled) {
                background: var(--surface-elevated);
                color: var(--color-primary);
                padding-left: 1.25rem;
            }

            &:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
        }
    }

    .distribution-section {
        padding: 2rem;
        background-color: white;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);

        h3 {
            margin: 0 0 1.5rem;
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--color-text-primary);
        }
    }

    .distribution-chart {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .distribution-bar {
        display: flex;
        align-items: center;
        gap: 1rem;

        @media (max-width: 640px) {
            flex-wrap: wrap;
            gap: 0.5rem;
        }

        .bar-label {
            min-width: 150px;
            font-size: 0.875rem;
            font-weight: 500;
            color: var(--color-text-primary);

            @media (max-width: 640px) {
                min-width: 100%;
            }
        }

        .bar-container {
            flex: 1;
            height: 32px;
            background-color: color-mix(
                in srgb,
                var(--color-border) 30%,
                transparent
            );
            border-radius: var(--radius-md);
            overflow: hidden;
            border: 1px solid var(--color-border);

            @media (max-width: 640px) {
                min-width: 100%;
            }
        }

        .bar-fill {
            height: 100%;
            background: linear-gradient(
                90deg,
                var(--color-accent),
                var(--color-secondary)
            );
            transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.3);
        }

        .bar-count {
            min-width: 50px;
            text-align: right;
            font-size: 0.9375rem;
            font-weight: 700;
            color: var(--color-accent);

            @media (max-width: 640px) {
                min-width: auto;
                margin-left: auto;
            }
        }
    }
</style>
