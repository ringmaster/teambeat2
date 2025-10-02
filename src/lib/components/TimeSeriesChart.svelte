<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import uPlot from "uplot";
    import "uplot/dist/uPlot.min.css";

    interface Props {
        metric: string;
        range?: string;
        title: string;
        yAxisLabel: string;
        color?: string;
    }

    let {
        metric,
        range = "1h",
        title,
        yAxisLabel,
        color = "#2196F3",
    }: Props = $props();

    let chartContainer: HTMLDivElement;
    let chart: uPlot | null = null;
    let refreshInterval: ReturnType<typeof setInterval> | null = null;

    async function fetchData() {
        try {
            const response = await fetch(
                `/api/admin/performance/timeseries?metric=${metric}&range=${range}`,
            );
            if (!response.ok) throw new Error("Failed to fetch data");

            const data: Array<{ timestamp: number; value: number }> =
                await response.json();

            // Convert to uPlot format: [timestamps[], values[]]
            const timestamps = data.map((d) => d.timestamp / 1000); // uPlot uses seconds
            const values = data.map((d) => d.value);

            if (chart) {
                chart.setData([timestamps, values]);
            } else if (chartContainer && timestamps.length > 0) {
                createChart(timestamps, values);
            }
        } catch (err) {
            console.error("Error fetching chart data:", err);
        }
    }

    function createChart(timestamps: number[], values: number[]) {
        const opts: uPlot.Options = {
            width: chartContainer.offsetWidth,
            height: 200,
            series: [
                {
                    label: "Time",
                },
                {
                    label: yAxisLabel,
                    stroke: color,
                    width: 2,
                    points: { show: false },
                },
            ],
            axes: [
                {
                    space: 60,
                    values: (self, ticks) =>
                        ticks.map((t) =>
                            new Date(t * 1000).toLocaleTimeString(),
                        ),
                },
                {
                    label: yAxisLabel,
                    space: 40,
                },
            ],
            scales: {
                x: {
                    time: false,
                },
            },
        };

        chart = new uPlot(opts, [timestamps, values], chartContainer);
    }

    function handleResize() {
        if (chart && chartContainer) {
            chart.setSize({ width: chartContainer.offsetWidth, height: 200 });
        }
    }

    onMount(() => {
        fetchData();
        refreshInterval = setInterval(fetchData, 5000); // Refresh every 5 seconds
        window.addEventListener("resize", handleResize);
    });

    onDestroy(() => {
        if (refreshInterval) clearInterval(refreshInterval);
        if (chart) chart.destroy();
        window.removeEventListener("resize", handleResize);
    });

    // Watch for range changes
    $effect(() => {
        // Trigger refetch when range changes
        if (range) {
            fetchData();
        }
    });
</script>

<div class="chart-wrapper">
    <h3>{title}</h3>
    <div bind:this={chartContainer} class="chart-container"></div>
</div>

<style>
    .chart-wrapper {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
    }

    h3 {
        margin: 0 0 1rem 0;
        font-size: 1.1rem;
        color: #374151;
        font-weight: 600;
    }

    .chart-container {
        width: 100%;
        height: 200px;
    }
</style>
