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

interface Props {
	results: any[];
	onQuestionClick: (questionId: string) => void;
}

const { results, onQuestionClick }: Props = $props();

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
	const data = results.map((r) => r.average);

	// Get CSS variables for colors
	const primaryColor = getComputedStyle(document.documentElement)
		.getPropertyValue("--color-accent")
		.trim();
	const secondaryColor = getComputedStyle(document.documentElement)
		.getPropertyValue("--color-secondary")
		.trim();
	const textColor = getComputedStyle(document.documentElement)
		.getPropertyValue("--color-text-primary")
		.trim();
	const borderColor = getComputedStyle(document.documentElement)
		.getPropertyValue("--color-border")
		.trim();

	chart = new Chart(canvas, {
		type: "radar",
		data: {
			labels,
			datasets: [
				{
					label: "Average Rating",
					data,
					backgroundColor: `color-mix(in srgb, ${primaryColor} 15%, transparent)`,
					borderColor: primaryColor,
					borderWidth: 3,
					pointBackgroundColor: primaryColor,
					pointBorderColor: "#fff",
					pointBorderWidth: 2,
					pointRadius: 5,
					pointHoverBackgroundColor: "#fff",
					pointHoverBorderColor: primaryColor,
					pointHoverRadius: 7,
					pointHoverBorderWidth: 3,
				},
			],
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
					display: false,
				},
				tooltip: {
					backgroundColor: "rgba(255, 255, 255, 0.95)",
					titleColor: textColor,
					bodyColor: textColor,
					borderColor: borderColor,
					borderWidth: 1,
					padding: 12,
					cornerRadius: 8,
					displayColors: false,
					titleFont: {
						size: 14,
						weight: "600",
					},
					bodyFont: {
						size: 13,
					},
					callbacks: {
						label: function (context) {
							const result = results[context.dataIndex];
							return `Average: ${result.average.toFixed(2)} (${result.totalResponses} responses)`;
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

// Recreate chart when results change
$effect(() => {
	if (results) {
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
