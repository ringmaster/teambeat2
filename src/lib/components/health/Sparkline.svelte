<script lang="ts">
import {
	CategoryScale,
	Chart,
	Filler,
	Legend,
	LinearScale,
	LineController,
	LineElement,
	PointElement,
	Tooltip,
} from "chart.js";
import { onMount } from "svelte";

Chart.register(
	LineController,
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	Filler,
	Tooltip,
	Legend,
);

interface SparklineDataPoint {
	value: number;
	label?: string;
}

interface Props {
	data: SparklineDataPoint[];
	userdata?: SparklineDataPoint[];
	width?: number;
	height?: number;
	minValue?: number;
	maxValue?: number;
}

const {
	data,
	userdata = [],
	width = 100,
	height = 24,
	minValue = 0,
	maxValue = 5,
}: Props = $props();

let canvas: HTMLCanvasElement;
let chart: Chart | null = null;

function createChart() {
	if (!canvas || data.length === 0) return;

	if (chart) {
		chart.destroy();
	}

	const labels = data.map((d) => d.label || "");
	const teamData = data.map((d) => d.value);
	const userData = userdata.map((d) => d.value);

	const teamColor = getComputedStyle(document.documentElement)
		.getPropertyValue("--color-accent")
		.trim();
	const userColor = getComputedStyle(document.documentElement)
		.getPropertyValue("--color-tertiary")
		.trim();

	const datasets: any[] = [
		{
			label: "Team Average",
			data: teamData,
			borderColor: teamColor,
			backgroundColor: teamColor,
			borderWidth: 2,
			pointRadius: 2.5,
			pointHoverRadius: 5,
			tension: 0.3,
			fill: false,
		},
	];

	if (userData.length > 0) {
		datasets.push({
			label: "Your Rating",
			data: userData,
			borderColor: userColor,
			backgroundColor: userColor,
			borderWidth: 2,
			pointRadius: 3,
			pointStyle: "triangle",
			pointHoverRadius: 5,
			tension: 0.3,
			fill: false,
		});
	}

	chart = new Chart(canvas, {
		type: "line",
		data: {
			labels,
			datasets,
		},
		options: {
			responsive: false,
			maintainAspectRatio: false,
			scales: {
				x: {
					display: false,
				},
				y: {
					display: false,
					min: minValue - 0.3,
					max: maxValue + 0.3,
				},
			},
			plugins: {
				legend: {
					display: false,
				},
				tooltip: {
					enabled: true,
					mode: "index",
					intersect: false,
					padding: 6,
					displayColors: true,
					callbacks: {
						title: (items) => items[0]?.label || "",
						label: (context) => {
							const label = context.dataset.label || "";
							const value = context.parsed.y;
							return `${label}: ${value.toFixed(2)}`;
						},
					},
				},
			},
			interaction: {
				mode: "nearest",
				axis: "x",
				intersect: false,
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

$effect(() => {
	if (data || userdata) {
		createChart();
	}
});

const hasData = $derived(data.length > 0);
</script>

{#if hasData}
	<div class="sparkline" style="width: {width}px; height: {height}px;">
		<canvas bind:this={canvas} {width} {height}></canvas>
	</div>
{/if}

<style lang="less">
	.sparkline {
		display: inline-block;
		vertical-align: middle;
	}

	canvas {
		display: block;
	}
</style>
