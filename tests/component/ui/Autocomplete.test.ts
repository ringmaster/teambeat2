import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it, vi } from "vitest";
import Autocomplete from "$lib/components/ui/Autocomplete.svelte";

const OPTIONS = [
	{ value: "apple" },
	{ value: "banana" },
	{ value: "cherry" },
	{ value: "apricot" },
];

function setup(overrides: Record<string, unknown> = {}) {
	const onSelect = vi.fn();
	const result = render(Autocomplete, {
		value: "",
		options: OPTIONS,
		onSelect,
		...overrides,
	});
	const input = screen.getByRole("combobox");
	return { ...result, input, onSelect };
}

// Open the dropdown by focusing + typing, flush Svelte reactivity.
async function openDropdown(input: HTMLElement, text = "a") {
	await fireEvent.focus(input);
	await tick();
	await fireEvent.input(input, { target: { value: text } });
	await tick();
}

describe("Autocomplete", () => {
	it("renders an input element", () => {
		const { input } = setup();
		expect(input).toBeInTheDocument();
	});

	it("is closed by default — no listbox visible", () => {
		setup();
		expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
	});

	it("opens dropdown on focus and shows all options when value is empty", async () => {
		const { input } = setup();
		await fireEvent.focus(input);
		await tick();
		expect(screen.getByRole("listbox")).toBeInTheDocument();
		expect(screen.getAllByRole("option")).toHaveLength(OPTIONS.length);
	});

	it("filters options when typing", async () => {
		const { input } = setup();
		await openDropdown(input, "ap");
		// 'apple' and 'apricot' match 'ap'
		expect(screen.getByText("apple")).toBeInTheDocument();
		expect(screen.getByText("apricot")).toBeInTheDocument();
		expect(screen.queryByText("banana")).not.toBeInTheDocument();
	});

	it("dropdown element is bound after opening (dropdownElement $state fix)", async () => {
		const { input, container } = setup();
		await openDropdown(input, "a");
		// The listbox div should be in the DOM — confirms bind:this worked
		const listbox = container.querySelector('[role="listbox"]');
		expect(listbox).not.toBeNull();
		expect(listbox).toBeInstanceOf(HTMLElement);
	});

	it("calls onSelect with the chosen value when an option is clicked", async () => {
		const { input, onSelect } = setup();
		await openDropdown(input, "ban");
		await fireEvent.click(screen.getByText("banana"));
		expect(onSelect).toHaveBeenCalledWith("banana");
	});

	it("closes dropdown after selecting an option", async () => {
		const { input } = setup();
		await openDropdown(input, "ban");
		await fireEvent.click(screen.getByText("banana"));
		await tick();
		expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
	});

	it("keyboard: ArrowDown highlights the first option", async () => {
		const { input } = setup();
		await openDropdown(input, "a");
		await fireEvent.keyDown(input, { key: "ArrowDown" });
		await tick();
		expect(document.querySelector(".highlighted")).not.toBeNull();
	});

	it("keyboard: Enter selects the highlighted option", async () => {
		const { input, onSelect } = setup();
		await openDropdown(input, "apple");
		await fireEvent.keyDown(input, { key: "ArrowDown" });
		await tick();
		await fireEvent.keyDown(input, { key: "Enter" });
		expect(onSelect).toHaveBeenCalledWith("apple");
	});

	it("keyboard: Escape closes the dropdown", async () => {
		const { input } = setup();
		await openDropdown(input, "a");
		await fireEvent.keyDown(input, { key: "Escape" });
		await tick();
		expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
	});

	it("is disabled when disabled prop is set", () => {
		const { input } = setup({ disabled: true });
		expect(input).toBeDisabled();
	});

	it("shows no dropdown when no options match the input", async () => {
		const { input } = setup();
		await openDropdown(input, "zzz");
		expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
	});
});
