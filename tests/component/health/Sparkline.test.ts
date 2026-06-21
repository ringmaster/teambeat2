import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import Sparkline from "$lib/components/health/Sparkline.svelte";

// Chart.js requires a real canvas 2D context which happy-dom doesn't provide.
// Mock the entire chart.js module so component logic runs without canvas errors.
vi.mock("chart.js", () => {
	const Chart = vi.fn().mockImplementation(() => ({
		destroy: vi.fn(),
		update: vi.fn(),
	}));
	Chart.register = vi.fn();
	return {
		Chart,
		LineController: {},
		CategoryScale: {},
		LinearScale: {},
		PointElement: {},
		LineElement: {},
		Filler: {},
		Tooltip: {},
		Legend: {},
	};
});

const DATA = [
	{ value: 3.5, label: "Board 1" },
	{ value: 4.0, label: "Board 2" },
	{ value: 3.8, label: "Board 3" },
];

describe("Sparkline", () => {
	it("renders nothing when data is empty", () => {
		const { container } = render(Sparkline, { data: [] });
		expect(container.querySelector("canvas")).toBeNull();
		expect(container.querySelector(".sparkline")).toBeNull();
	});

	it("renders a canvas element when data is present", () => {
		const { container } = render(Sparkline, { data: DATA });
		expect(container.querySelector("canvas")).not.toBeNull();
	});

	it("canvas bind target is set after mount ($state fix)", () => {
		// The canvas element must exist in the DOM — if $state(null) is missing,
		// bind:this doesn't track the assignment and createChart() gets a null canvas.
		const { container } = render(Sparkline, { data: DATA });
		const canvas = container.querySelector("canvas");
		expect(canvas).toBeInstanceOf(HTMLCanvasElement);
	});

	it("applies the specified width and height to the canvas", () => {
		const { container } = render(Sparkline, {
			data: DATA,
			width: 200,
			height: 48,
		});
		const canvas = container.querySelector("canvas") as HTMLCanvasElement;
		expect(canvas.getAttribute("width")).toBe("200");
		expect(canvas.getAttribute("height")).toBe("48");
	});

	it("wraps canvas in a .sparkline div sized to width/height", () => {
		const { container } = render(Sparkline, {
			data: DATA,
			width: 150,
			height: 32,
		});
		const wrapper = container.querySelector(".sparkline") as HTMLElement;
		expect(wrapper.style.width).toBe("150px");
		expect(wrapper.style.height).toBe("32px");
	});
});
