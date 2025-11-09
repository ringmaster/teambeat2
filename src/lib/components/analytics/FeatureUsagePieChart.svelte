<script lang="ts">
import {
	Chart,
	ArcElement,
	Tooltip,
	Legend,
	PieController,
} from "chart.js";
import { onMount, onDestroy } from "svelte";

// Register Chart.js components
Chart.register(PieController, ArcElement, Tooltip, Legend);

interface Props {
	data: Array<{ feature: string; count: number }>;
	title?: string;
}

const { data, title = "Feature Usage" }: Props = $props();

let canvas: HTMLCanvasElement;
let chart: Chart | null = null;

// Generate distinct colors for pie slices
function generateColors(count: number) {
	const hueStep = 360 / count;
	return Array.from({ length: count }, (_, i) => {
		const hue = i * hueStep;
		return `hsl(${hue}, 70%, 60%)`;
	});
}

function createChart() {
	if (!canvas || data.length === 0) return;

	const labels = data.map((d) => d.feature);
	const counts = data.map((d) => d.count);
	const colors = generateColors(data.length);

	// If chart exists, just update the data instead of recreating
	if (chart) {
		chart.data.labels = labels;
		chart.data.datasets[0].data = counts;
		chart.data.datasets[0].backgroundColor = colors;
		chart.update('none'); // Update without animation
		return;
	}

	// Create new chart only if it doesn't exist
	chart = new Chart(canvas, {
		type: "pie",
		data: {
			labels,
			datasets: [
				{
					data: counts,
					backgroundColor: colors,
					borderColor: "rgba(255, 255, 255, 0.8)",
					borderWidth: 2,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: true,
			animation: {
				duration: 500, // Shorter initial animation
			},
			plugins: {
				legend: {
					position: "right",
					labels: {
						boxWidth: 12,
						padding: 8,
						font: {
							size: 11,
						},
					},
				},
				tooltip: {
					callbacks: {
						label: function (context) {
							const label = context.label || "";
							const value = context.parsed || 0;
							const total = context.dataset.data.reduce(
								(a: number, b: number) => a + b,
								0,
							);
							const percentage = ((value / total) * 100).toFixed(1);
							return `${label}: ${value} (${percentage}%)`;
						},
					},
				},
			},
		},
	});
}

onMount(() => {
	createChart();
});

onDestroy(() => {
	if (chart) {
		chart.destroy();
	}
});

// Recreate chart when data changes
$effect(() => {
	if (data) {
		createChart();
	}
});
</script>

<div class="chart-container">
	<canvas bind:this={canvas}></canvas>
</div>

<style lang="less">
.chart-container {
	width: 100%;
	max-width: 400px;
	margin: 0 auto;
	padding: 1rem;
}
</style>
