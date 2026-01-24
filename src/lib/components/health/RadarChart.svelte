<script lang="ts">
import {
	Chart,
	Filler,
	Legend,
	LineElement,
	PointElement,
	RadarController,
	RadialLinearScale,
	Tooltip,
} from "chart.js";
import { onMount } from "svelte";

// Register Chart.js components
Chart.register(
	RadarController,
	RadialLinearScale,
	PointElement,
	LineElement,
	Filler,
	Tooltip,
	Legend,
);

interface HistoricalBoard {
	boardId: string;
	boardName: string;
	boardCreatedAt: string;
	meetingDate: string | null;
}

interface Props {
	results: any[];
	historicalBoards?: HistoricalBoard[];
	onQuestionClick: (questionId: string) => void;
}

const { results, historicalBoards = [], onQuestionClick }: Props = $props();

// Format date for legend display
function formatBoardDate(board: HistoricalBoard): string {
	if (board.meetingDate) {
		return new Date(board.meetingDate).toLocaleDateString();
	}
	return new Date(board.boardCreatedAt).toLocaleDateString();
}

let canvas: HTMLCanvasElement;
let chart: Chart | null = null;

function createChart() {
	if (!canvas || results.length === 0) return;

	// Destroy existing chart
	if (chart) {
		chart.destroy();
	}

	const labels = results.map((r) =>
		r.question.question.length > 30
			? r.question.question.substring(0, 30) + "..."
			: r.question.question,
	);
	const currentData = results.map((r) => r.average);

	// Get CSS variables for colors
	const currentColor = getComputedStyle(document.documentElement)
		.getPropertyValue("--color-accent")
		.trim();
	const textColor = getComputedStyle(document.documentElement)
		.getPropertyValue("--color-text-primary")
		.trim();
	const borderColor = getComputedStyle(document.documentElement)
		.getPropertyValue("--color-border")
		.trim();
	const mutedColor = getComputedStyle(document.documentElement)
		.getPropertyValue("--color-text-muted")
		.trim();

	// Build datasets array - current survey first, then historical (most recent to oldest)
	const datasets: any[] = [];

	// Add historical datasets first (so they render behind current)
	// Reverse order so oldest is added first (renders at back)
	const reversedBoards = [...historicalBoards].reverse();
	reversedBoards.forEach((board, reverseIndex) => {
		const index = historicalBoards.length - 1 - reverseIndex;
		// Extract historical averages for this board
		const historicalData = results.map((r) => {
			const historyItem = r.history?.find(
				(h: any) => h.boardId === board.boardId,
			);
			return historyItem?.average ?? null;
		});

		// Only add dataset if we have data
		if (historicalData.some((d: number | null) => d !== null)) {
			// Opacity decreases for older surveys: 0.6 for most recent, 0.35 for older
			const opacity = Math.max(0.35, 0.6 - index * 0.25);

			datasets.push({
				label: formatBoardDate(board),
				data: historicalData,
				backgroundColor: `color-mix(in srgb, ${mutedColor} ${Math.round(opacity * 10)}%, transparent)`,
				borderColor: `color-mix(in srgb, ${mutedColor} ${Math.round(opacity * 100)}%, transparent)`,
				borderWidth: 1.5,
				borderDash: [4, 2],
				pointBackgroundColor: `color-mix(in srgb, ${mutedColor} ${Math.round(opacity * 100)}%, transparent)`,
				pointBorderColor: "#fff",
				pointBorderWidth: 1,
				pointRadius: 3,
				pointHoverRadius: 4,
				spanGaps: true, // Skip null values
			});
		}
	});

	// Add current survey dataset (renders on top)
	datasets.push({
		label: "Current Survey",
		data: currentData,
		backgroundColor: `color-mix(in srgb, ${currentColor} 15%, transparent)`,
		borderColor: currentColor,
		borderWidth: 3,
		pointBackgroundColor: currentColor,
		pointBorderColor: "#fff",
		pointBorderWidth: 2,
		pointRadius: 5,
		pointHoverBackgroundColor: "#fff",
		pointHoverBorderColor: currentColor,
		pointHoverRadius: 7,
		pointHoverBorderWidth: 3,
	});

	const showLegend = historicalBoards.length > 0;

	chart = new Chart(canvas, {
		type: "radar",
		data: {
			labels,
			datasets,
		},
		options: {
			responsive: true,
			maintainAspectRatio: true,
			aspectRatio: 1.5,
			scales: {
				r: {
					beginAtZero: true,
					min: 0,
					max: 5,
					ticks: {
						stepSize: 1,
						color: textColor,
						font: {
							size: 12,
							weight: "500",
						},
						backdropColor: "transparent",
					},
					grid: {
						color: borderColor,
						lineWidth: 1,
					},
					angleLines: {
						color: borderColor,
						lineWidth: 1,
					},
					pointLabels: {
						color: textColor,
						font: {
							size: 13,
							weight: "600",
						},
						padding: 8,
					},
				},
			},
			plugins: {
				legend: {
					display: showLegend,
					position: "bottom",
					labels: {
						color: textColor,
						font: {
							size: 12,
						},
						padding: 16,
						usePointStyle: true,
						pointStyle: "circle",
					},
				},
				tooltip: {
					backgroundColor: "rgba(255, 255, 255, 0.95)",
					titleColor: textColor,
					bodyColor: textColor,
					borderColor: borderColor,
					borderWidth: 1,
					padding: 12,
					cornerRadius: 8,
					displayColors: true,
					titleFont: {
						size: 14,
						weight: "600",
					},
					bodyFont: {
						size: 13,
					},
					callbacks: {
						label: function (context) {
							const datasetLabel = context.dataset.label || "";
							const value = context.parsed.r;
							if (value === null || value === undefined) {
								return `${datasetLabel}: No data`;
							}
							if (datasetLabel === "Current Survey") {
								const result = results[context.dataIndex];
								return `${datasetLabel}: ${value.toFixed(2)} (${result.totalResponses} responses)`;
							}
							return `${datasetLabel}: ${value.toFixed(2)}`;
						},
					},
				},
			},
			onClick: (event, elements) => {
				if (elements.length > 0) {
					const index = elements[0].index;
					onQuestionClick(results[index].question.id);
				}
			},
		},
	});
}

onMount(() => {
	createChart();
	return () => {
		if (chart) {
			chart.destroy();
		}
	};
});

// Recreate chart when results or historical data changes
$effect(() => {
	if (results || historicalBoards) {
		createChart();
	}
});
</script>

<div class="radar-chart">
    <canvas bind:this={canvas}></canvas>
</div>

<style lang="less">
    .radar-chart {
        width: 100%;
        max-width: 700px;
        margin: 0 auto;
        padding: 1rem;

        @media (min-width: 768px) {
            padding: 1.5rem;
        }

        canvas {
            max-width: 100%;
            height: auto;
            cursor: pointer;
        }
    }
</style>
