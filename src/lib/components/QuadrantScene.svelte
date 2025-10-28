<script lang="ts">
import { contourDensity } from "d3-contour";
import type { QuadrantConfig, QuadrantPosition } from "$lib/types/quadrant";
import Card from "./Card.svelte";

let {
	scene,
	cards,
	boardId,
	board,
	userRole,
	currentUserId,
	isAdmin = false,
	isFacilitator = false,
}: {
	scene: any;
	cards: any[];
	boardId: string;
	board: any;
	userRole: string;
	currentUserId: string;
	isAdmin?: boolean;
	isFacilitator?: boolean;
} = $props();

let config = $derived<QuadrantConfig>(
	scene.quadrantConfig ? JSON.parse(scene.quadrantConfig) : null,
);
let phase = $derived<"input" | "results" | null>(scene.quadrantPhase);

let userPositions = $state<QuadrantPosition[]>([]);
let loading = $state(true);
let draggedCardId = $state<string | null>(null);
let draggedMarkerId = $state<string | null>(null);
let selectedCardId = $state<string | null>(null);
let selectedCardPositions = $state<QuadrantPosition[]>([]);

// Parse grid dimensions
let gridCols = $derived(config ? Number.parseInt(config.grid_size[0]) : 2);
let gridRows = $derived(config ? Number.parseInt(config.grid_size[2]) : 2);

// Filter cards based on selected columns (if configured)
let filteredCards = $derived.by(() => {
	if (
		!config ||
		!config.selected_column_ids ||
		config.selected_column_ids.length === 0
	) {
		return cards;
	}
	// Note: cards use camelCase 'columnId', not snake_case 'column_id'
	return cards.filter((card) =>
		config.selected_column_ids!.includes(card.columnId),
	);
});

// Load user positions if in input phase
$effect(() => {
	if (phase === "input") {
		loadPositions();
	}
});

async function loadPositions() {
	try {
		const response = await fetch(`/api/scenes/${scene.id}/quadrant/positions`);
		const data = await response.json();
		if (data.success) {
			userPositions = data.positions;
		}
	} catch (error) {
		console.error("Failed to load positions:", error);
	} finally {
		loading = false;
	}
}

async function startInput() {
	try {
		const response = await fetch(
			`/api/scenes/${scene.id}/quadrant/start-input`,
			{
				method: "POST",
			},
		);
		const data = await response.json();
		if (!data.success) {
			alert(`Failed to start input: ${data.error}`);
		}
	} catch (error) {
		console.error("Failed to start input:", error);
		alert("Failed to start input phase");
	}
}

async function calculateConsensus() {
	try {
		const response = await fetch(
			`/api/scenes/${scene.id}/quadrant/calculate-consensus`,
			{
				method: "POST",
			},
		);
		const data = await response.json();
		console.log("Consensus calculation response:", data);
		if (!data.success) {
			alert(`Failed to calculate consensus: ${data.error}`);
		} else {
			console.log(
				"Consensus calculated successfully. Card positions:",
				data.card_positions,
			);
		}
	} catch (error) {
		console.error("Failed to calculate consensus:", error);
		alert("Failed to calculate consensus");
	}
}

async function switchToInput() {
	try {
		const response = await fetch(`/api/boards/${boardId}/scenes/${scene.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ quadrantPhase: "input" }),
		});
		const data = await response.json();
		if (!data.success) {
			alert(`Failed to switch to input phase: ${data.error}`);
		}
	} catch (error) {
		console.error("Failed to switch to input phase:", error);
		alert("Failed to switch to input phase");
	}
}

async function handlePhaseChange(newPhase: "input" | "results") {
	if (newPhase === phase) return;

	if (newPhase === "results") {
		await calculateConsensus();

		// Reload selected card positions to update the topographic graph
		if (selectedCardId) {
			await loadCardPositions(selectedCardId);
		}
	} else {
		await switchToInput();
	}
}

function getCardPosition(cardId: string): QuadrantPosition | undefined {
	return userPositions.find((p) => p.card_id === cardId);
}

function getCardMetadata(card: any) {
	if (!card.quadrantMetadata) return null;
	const metadata = JSON.parse(card.quadrantMetadata);
	return metadata.find((m: any) => m.scene_id === scene.id);
}

async function placeCard(cardId: string, x: number, y: number) {
	try {
		const response = await fetch(`/api/quadrant-positions/${cardId}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				scene_id: scene.id,
				x_value: x,
				y_value: y,
			}),
		});
		const data = await response.json();
		if (data.success) {
			// Update local positions
			const existingIndex = userPositions.findIndex(
				(p) => p.card_id === cardId,
			);
			if (existingIndex >= 0) {
				userPositions[existingIndex] = data.position;
			} else {
				userPositions = [...userPositions, data.position];
			}
		}
	} catch (error) {
		console.error("Failed to place card:", error);
	}
}

// Drag and drop handlers for cards
function handleCardDragStart(e: DragEvent, cardId: string) {
	draggedCardId = cardId;
	if (e.dataTransfer) {
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", cardId);

		// Create a circular marker as the drag image
		const dragImage = document.createElement("div");
		const cardIndex = getCardIndex(cardId);
		dragImage.textContent = cardIndex.toString();

		// Get computed colors from CSS variables
		const accent =
			getComputedStyle(document.documentElement)
				.getPropertyValue("--color-accent")
				.trim() || "#4D7A75";
		const primary =
			getComputedStyle(document.documentElement)
				.getPropertyValue("--color-primary")
				.trim() || "#39495C";

		dragImage.style.cssText = `
				position: absolute;
				top: -1000px;
				left: -1000px;
				width: 40px;
				height: 40px;
				border-radius: 50%;
				background: ${accent};
				border: 3px solid ${primary};
				color: white;
				display: flex;
				align-items: center;
				justify-content: center;
				font-weight: 700;
				font-size: 1rem;
				line-height: 1;
			`;
		document.body.appendChild(dragImage);
		e.dataTransfer.setDragImage(dragImage, 20, 20);

		// Clean up after drag starts
		requestAnimationFrame(() => {
			if (document.body.contains(dragImage)) {
				document.body.removeChild(dragImage);
			}
		});
	}
}

function handleCardDragEnd() {
	draggedCardId = null;
}

// Drag handlers for markers
function handleMarkerDragStart(e: DragEvent, cardId: string) {
	e.stopPropagation();
	draggedMarkerId = cardId;
	if (e.dataTransfer) {
		e.dataTransfer.effectAllowed = "move";

		// Create a custom drag image that looks like the marker
		const dragImage = document.createElement("div");
		const cardIndex = getCardIndex(cardId);
		dragImage.textContent = cardIndex.toString();

		// Get computed colors from CSS variables
		const accent =
			getComputedStyle(document.documentElement)
				.getPropertyValue("--color-accent")
				.trim() || "#4D7A75";
		const primary =
			getComputedStyle(document.documentElement)
				.getPropertyValue("--color-primary")
				.trim() || "#39495C";

		dragImage.style.cssText = `
				position: absolute;
				top: -1000px;
				left: -1000px;
				width: 40px;
				height: 40px;
				border-radius: 50%;
				background: ${accent};
				border: 3px solid ${primary};
				color: white;
				display: flex;
				align-items: center;
				justify-content: center;
				font-weight: 700;
				font-size: 1rem;
				line-height: 1;
			`;
		document.body.appendChild(dragImage);
		e.dataTransfer.setDragImage(dragImage, 20, 20);

		// Clean up after drag starts
		requestAnimationFrame(() => {
			if (document.body.contains(dragImage)) {
				document.body.removeChild(dragImage);
			}
		});
	}
}

function handleMarkerDragEnd() {
	draggedMarkerId = null;
}

// Drop handler for grid
function handleGridDrop(e: DragEvent) {
	e.preventDefault();
	const cardId = draggedCardId || draggedMarkerId;
	if (!cardId) return;

	// Get grid dimensions and mouse position
	const gridEl = e.currentTarget as HTMLElement;
	const rect = gridEl.getBoundingClientRect();
	const x = e.clientX - rect.left;
	const y = e.clientY - rect.top;

	// Convert to percentage (0-96 range)
	const xPercent = Math.max(0, Math.min(96, Math.round((x / rect.width) * 96)));
	// Invert Y so 0 is at bottom
	const yPercent = Math.max(
		0,
		Math.min(96, Math.round(((rect.height - y) / rect.height) * 96)),
	);

	placeCard(cardId, xPercent, yPercent);
	draggedCardId = null;
	draggedMarkerId = null;
}

function handleGridDragOver(e: DragEvent) {
	e.preventDefault();
	if (e.dataTransfer) {
		e.dataTransfer.dropEffect = "move";
	}
}

// Get positioned card IDs
let positionedCardIds = $derived(new Set(userPositions.map((p) => p.card_id)));

// Convert card position to grid coordinates (percentage)
function getMarkerPosition(position: QuadrantPosition): {
	x: number;
	y: number;
} {
	// X is normal (0-96 left to right)
	const x = (position.x_value / 96) * 100;
	// Y is inverted (0 at bottom, 96 at top)
	const y = 100 - (position.y_value / 96) * 100;
	return { x, y };
}

// Get card index for numbering
function getCardIndex(cardId: string): number {
	return filteredCards.findIndex((c) => c.id === cardId) + 1;
}

// Simplified card handlers (quadrant scene doesn't need full card functionality)
function handleCardDrop() {}
function handleCardDragOver() {}
function handleCardDragLeave() {}
function handleToggleSelection() {}
function handleVote() {}
function handleComment() {}
function handleDelete() {}
function handleEdit() {}

// Clear current user's card positions
async function clearMyInput() {
	try {
		// Delete all positions for this user in this scene
		const deletePromises = userPositions.map((position) =>
			fetch(
				`/api/quadrant-positions/${position.card_id}?scene_id=${scene.id}`,
				{
					method: "DELETE",
				},
			),
		);
		await Promise.all(deletePromises);
		userPositions = [];

		// If we're in results phase, recalculate consensus to update the display
		if (phase === "results") {
			await calculateConsensus();

			// Reload selected card positions to update the topographic graph
			if (selectedCardId) {
				await loadCardPositions(selectedCardId);
			}
		}
	} catch (error) {
		console.error("Failed to clear positions:", error);
	}
}

// Reset all users' positions (facilitator/admin only)
async function resetAllPositions() {
	if (!isFacilitator && !isAdmin) return;

	try {
		const response = await fetch(
			`/api/scenes/${scene.id}/quadrant/reset-all-positions`,
			{
				method: "POST",
			},
		);
		const data = await response.json();
		if (data.success) {
			userPositions = [];

			// If we're in results phase, recalculate consensus to update the display
			if (phase === "results") {
				await calculateConsensus();

				// Reload selected card positions to update the topographic graph
				if (selectedCardId) {
					await loadCardPositions(selectedCardId);
				}
			}
		} else {
			console.error("Failed to reset all positions:", data.error);
		}
	} catch (error) {
		console.error("Failed to reset all positions:", error);
	}
}

// Card selection for Results phase
async function handleCardSelection(cardId: string) {
	if (selectedCardId === cardId) {
		selectedCardId = null; // Deselect if clicking the same card
		selectedCardPositions = [];
	} else {
		selectedCardId = cardId;
		// Load all user positions for this card
		await loadCardPositions(cardId);
	}
}

// Load individual user positions for selected card
async function loadCardPositions(cardId: string) {
	try {
		const response = await fetch(
			`/api/scenes/${scene.id}/quadrant/positions?card_id=${cardId}`,
		);
		const data = await response.json();
		if (data.success) {
			selectedCardPositions = data.positions;
		}
	} catch (error) {
		console.error("Failed to load card positions:", error);
	}
}

// Generate contour data from selected card positions
let contourData = $derived.by(() => {
	if (selectedCardPositions.length === 0) return [];

	// Convert positions to d3-contour format
	// Map from 0-96 range to 0-100 percentage for consistency
	const points = selectedCardPositions.map((p) => ({
		x: (p.x_value / 96) * 100,
		// Invert Y (0 at bottom in data, but 0 at top in display)
		y: 100 - (p.y_value / 96) * 100,
	}));

	// Create density contours with higher thresholds for smoother appearance
	const density = contourDensity()
		.x((d) => d.x)
		.y((d) => d.y)
		.size([100, 100]) // Use 100x100 coordinate space
		.bandwidth(20) // Increased smoothing bandwidth
		.thresholds(20); // More contour levels for smoother gradients

	return density(points);
});

// Get color for contour level (white → #3c495b)
function getContourColor(index: number, total: number): string {
	// Ratio from 0 (outermost, white) to 1 (apex, #3c495b)
	const ratio = index / Math.max(total - 1, 1);

	// Target color #3c495b = rgb(60, 73, 91)
	const targetR = 60;
	const targetG = 73;
	const targetB = 91;

	// Interpolate from white (255, 255, 255) to target
	const r = Math.round(255 - (255 - targetR) * ratio);
	const g = Math.round(255 - (255 - targetG) * ratio);
	const b = Math.round(255 - (255 - targetB) * ratio);

	return `rgb(${r}, ${g}, ${b})`;
}

// Drag handlers for consensus markers (facilitator only)
let draggedConsensusCardId = $state<string | null>(null);

function handleConsensusMarkerDragStart(e: DragEvent, cardId: string) {
	if (!isFacilitator && !isAdmin) return;

	e.stopPropagation();
	draggedConsensusCardId = cardId;
	if (e.dataTransfer) {
		e.dataTransfer.effectAllowed = "move";

		// Create a custom drag image
		const dragImage = document.createElement("div");
		const cardIndex = getCardIndex(cardId);
		dragImage.textContent = cardIndex.toString();

		const accent =
			getComputedStyle(document.documentElement)
				.getPropertyValue("--color-accent")
				.trim() || "#4D7A75";
		const primary =
			getComputedStyle(document.documentElement)
				.getPropertyValue("--color-primary")
				.trim() || "#39495C";

		dragImage.style.cssText = `
				position: absolute;
				top: -1000px;
				left: -1000px;
				width: 40px;
				height: 40px;
				border-radius: 50%;
				background: ${accent};
				border: 3px solid ${primary};
				color: white;
				display: flex;
				align-items: center;
				justify-content: center;
				font-weight: 700;
				font-size: 1rem;
				line-height: 1;
			`;
		document.body.appendChild(dragImage);
		e.dataTransfer.setDragImage(dragImage, 20, 20);

		requestAnimationFrame(() => {
			if (document.body.contains(dragImage)) {
				document.body.removeChild(dragImage);
			}
		});
	}
}

function handleConsensusMarkerDragEnd() {
	draggedConsensusCardId = null;
}

function handleResultsGridDrop(e: DragEvent) {
	e.preventDefault();
	if (!draggedConsensusCardId || (!isFacilitator && !isAdmin)) return;

	// Get grid dimensions and mouse position
	const gridEl = e.currentTarget as HTMLElement;
	const rect = gridEl.getBoundingClientRect();
	const x = e.clientX - rect.left;
	const y = e.clientY - rect.top;

	// Convert to percentage (0-96 range)
	const xPercent = Math.max(0, Math.min(96, Math.round((x / rect.width) * 96)));
	// Invert Y so 0 is at bottom
	const yPercent = Math.max(
		0,
		Math.min(96, Math.round(((rect.height - y) / rect.height) * 96)),
	);

	updateFacilitatorPosition(draggedConsensusCardId, xPercent, yPercent);
	draggedConsensusCardId = null;
}

function handleResultsGridDragOver(e: DragEvent) {
	if (!draggedConsensusCardId || (!isFacilitator && !isAdmin)) return;
	e.preventDefault();
	if (e.dataTransfer) {
		e.dataTransfer.dropEffect = "move";
	}
}

async function updateFacilitatorPosition(cardId: string, x: number, y: number) {
	try {
		const response = await fetch(
			`/api/scenes/${scene.id}/quadrant/facilitator-position`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					card_id: cardId,
					facilitator_x: x,
					facilitator_y: y,
				}),
			},
		);
		const data = await response.json();
		if (!data.success) {
			console.error("Failed to update facilitator position:", data.error);
		}
	} catch (error) {
		console.error("Failed to update facilitator position:", error);
	}
}
</script>

<div class="quadrant-scene">

    OK.
	{#if !config}
		<div class="error">No quadrant configuration found for this scene.</div>
	{:else if phase === "input"}
		{#if isFacilitator || isAdmin}
			<div class="facilitator-toolbar">
				<div class="toolbar-controls">
					<div class="mode-toggle">
						<button
							type="button"
							class="mode-button"
							class:active={phase === "input"}
							onclick={() => handlePhaseChange("input")}
						>
							Input
						</button>
						<button
							type="button"
							class="mode-button"
							class:active={phase === "results"}
							onclick={() => handlePhaseChange("results")}
						>
							Results
						</button>
					</div>
				</div>
			</div>
		{/if}

		<div class="input-phase">
			{#if loading}
				<div class="loading">Loading your positions...</div>
			{:else}
				<div class="quadrant-layout">
					<!-- Left: Grid area -->
					<div class="grid-area">
						<div class="y-axis-label">{config.y_axis_label}</div>
						<div class="grid-wrapper">
							<div
								class="quadrant-grid"
								style="--grid-cols: {gridCols}; --grid-rows: {gridRows};"
								ondrop={handleGridDrop}
								ondragover={handleGridDragOver}
							>
								<!-- Grid lines -->
								<div class="grid-lines">
									{#each Array(gridRows - 1) as _, i}
										<div class="horizontal-line" style="top: {((i + 1) / gridRows) * 100}%"></div>
									{/each}
									{#each Array(gridCols - 1) as _, i}
										<div class="vertical-line" style="left: {((i + 1) / gridCols) * 100}%"></div>
									{/each}
								</div>

								<!-- Main axis lines (only show when they align with grid divisions) -->
								<div class="axis-lines">
									{#if gridRows % 2 === 0}
										<div class="x-axis-line"></div>
									{/if}
									{#if gridCols % 2 === 0}
										<div class="y-axis-line"></div>
									{/if}
								</div>

								<!-- Axis range labels -->
								<div class="axis-range-labels">
									<!-- X-axis labels (horizontal) -->
									<div class="x-range-label x-min">{config.x_axis_values[0]}</div>
									<div class="x-range-label x-max">{config.x_axis_values[config.x_axis_values.length - 1]}</div>
									<!-- Y-axis labels (vertical) -->
									<div class="y-range-label y-min">{config.y_axis_values[0]}</div>
									<div class="y-range-label y-max">{config.y_axis_values[config.y_axis_values.length - 1]}</div>
								</div>

								<!-- Positioned card markers -->
								{#each userPositions as position (position.card_id)}
									{@const markerPos = getMarkerPosition(position)}
									{@const cardIndex = getCardIndex(position.card_id)}
									<div
										class="card-marker"
										style="left: {markerPos.x}%; top: {markerPos.y}%;"
										draggable="true"
										ondragstart={(e) => handleMarkerDragStart(e, position.card_id)}
										ondragend={handleMarkerDragEnd}
										title="Card {cardIndex}"
									>
										{cardIndex}
									</div>
								{/each}

								<!-- Reset buttons positioned below bottom-right corner -->
								{#if isFacilitator || isAdmin}
									<button onclick={resetAllPositions} class="reset-button admin" type="button" aria-label="Reset all users' positions">
										Reset All
									</button>
								{/if}
								<button onclick={clearMyInput} class="reset-button" type="button" aria-label="Clear my card positions">
									Clear My Input
								</button>
							</div>
							<div class="x-axis-label">{config.x_axis_label}</div>
						</div>
					</div>

					<!-- Right: Cards sidebar -->
					<div class="cards-sidebar">
						<div class="cards-list">
							{#each filteredCards as card (card.id)}
								{@const isPositioned = positionedCardIds.has(card.id)}
								{@const cardIndex = getCardIndex(card.id)}
								<div
									class="card-wrapper"
									class:positioned={isPositioned}
									draggable="true"
									ondragstart={(e) => handleCardDragStart(e, card.id)}
									ondragend={handleCardDragEnd}
								>
									<div class="selection-indicator-static" class:highlighted={isPositioned}>
										<span class="selection-number">{cardIndex}</span>
									</div>
									<div class="card-container">
										<Card
											{card}
											isGrouped={false}
											groupingMode={false}
											isSelected={false}
											currentScene={scene}
											{board}
											{userRole}
											{currentUserId}
											onDragStart={() => {}}
											onToggleSelection={handleToggleSelection}
											onVote={handleVote}
											onComment={handleComment}
											onDelete={handleDelete}
											onEdit={handleEdit}
											onCardDrop={handleCardDrop}
											onCardDragOver={handleCardDragOver}
											onCardDragLeave={handleCardDragLeave}
										/>
										{#if isPositioned}
											<div class="positioned-badge">
												Placed
											</div>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/if}
		</div>
	{:else if phase === "results"}
		{#if isFacilitator || isAdmin}
			<div class="facilitator-toolbar">
				<div class="toolbar-controls">
					<div class="mode-toggle">
						<button
							type="button"
							class="mode-button"
							class:active={phase === "input"}
							onclick={() => handlePhaseChange("input")}
						>
							Input
						</button>
						<button
							type="button"
							class="mode-button"
							class:active={phase === "results"}
							onclick={() => handlePhaseChange("results")}
						>
							Results
						</button>
					</div>
				</div>
			</div>
		{/if}

		<div class="results-phase">
			<div class="quadrant-layout">
				<!-- Left: Grid area -->
				<div class="grid-area">
					<div class="y-axis-label">{config.y_axis_label}</div>
					<div class="grid-wrapper">
						<div
							class="quadrant-grid"
							style="--grid-cols: {gridCols}; --grid-rows: {gridRows};"
							ondrop={handleResultsGridDrop}
							ondragover={handleResultsGridDragOver}
						>
							<!-- Grid lines -->
							<div class="grid-lines">
								{#each Array(gridRows - 1) as _, i}
									<div class="horizontal-line" style="top: {((i + 1) / gridRows) * 100}%"></div>
								{/each}
								{#each Array(gridCols - 1) as _, i}
									<div class="vertical-line" style="left: {((i + 1) / gridCols) * 100}%"></div>
								{/each}
							</div>

							<!-- Main axis lines (only show when they align with grid divisions) -->
							<div class="axis-lines">
								{#if gridRows % 2 === 0}
									<div class="x-axis-line"></div>
								{/if}
								{#if gridCols % 2 === 0}
									<div class="y-axis-line"></div>
								{/if}
							</div>

							<!-- Axis range labels -->
							<div class="axis-range-labels">
								<!-- X-axis labels (horizontal) -->
								<div class="x-range-label x-min">{config.x_axis_values[0]}</div>
								<div class="x-range-label x-max">{config.x_axis_values[config.x_axis_values.length - 1]}</div>
								<!-- Y-axis labels (vertical) -->
								<div class="y-range-label y-min">{config.y_axis_values[0]}</div>
								<div class="y-range-label y-max">{config.y_axis_values[config.y_axis_values.length - 1]}</div>
							</div>

							<!-- Heatmap overlay (when card is selected) -->
							{#if selectedCardId && contourData.length > 0}
								<svg class="heatmap-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
									{#each contourData as contour, i (i)}
										{@const pathData = contour.coordinates[0].map((ring, ringIndex) => {
											const points = ring.map(([x, y]) => `${x},${y}`).join(' L ');
											return ringIndex === 0 ? `M ${points} Z` : '';
										}).join(' ')}
										<path
											d={pathData}
											fill={getContourColor(i, contourData.length)}
											fill-opacity="0.5"
											stroke="none"
										/>
									{/each}

									<!-- Individual user position dots -->
									{#each selectedCardPositions as position (position.id)}
										{@const x = (position.x_value / 96) * 100}
										{@const y = 100 - ((position.y_value / 96) * 100)}
										<circle
											cx={x}
											cy={y}
											r="1.5"
											fill="rgba(255, 255, 255, 0.8)"
											stroke="rgba(0, 0, 0, 0.5)"
											stroke-width="0.3"
										/>
									{/each}
								</svg>
							{/if}

							<!-- Consensus card positions -->
							{#each filteredCards as card (card.id)}
								{@const metadata = getCardMetadata(card)}
								{#if metadata}
									{@const consensusX = metadata.facilitator_x || metadata.consensus_x}
									{@const consensusY = metadata.facilitator_y || metadata.consensus_y}
									{@const markerPos = getMarkerPosition({ x_value: consensusX, y_value: consensusY } as any)}
									{@const cardIndex = getCardIndex(card.id)}
									<div
										class="card-marker consensus-marker"
										class:selected={selectedCardId === card.id}
										class:draggable={isFacilitator || isAdmin}
										style="left: {markerPos.x}%; top: {markerPos.y}%;"
										title="{card.content} - {metadata.quadrant_label}"
										draggable={isFacilitator || isAdmin}
										onclick={() => handleCardSelection(card.id)}
										ondragstart={(e) => handleConsensusMarkerDragStart(e, card.id)}
										ondragend={handleConsensusMarkerDragEnd}
									>
										{cardIndex}
									</div>
								{/if}
							{/each}
						</div>
						<div class="x-axis-label">{config.x_axis_label}</div>
					</div>
				</div>

				<!-- Right: Cards sidebar -->
				<div class="cards-sidebar">
					<div class="cards-list">
						{#each filteredCards as card (card.id)}
							{@const metadata = getCardMetadata(card)}
							{@const cardIndex = getCardIndex(card.id)}
							<div
								class="card-wrapper results-card"
								class:selected={selectedCardId === card.id}
							>
								<button
									aria-label="Select Card {cardIndex}"
									class="selection-button"
									class:active={selectedCardId === card.id}
									onclick={() => handleCardSelection(card.id)}
								>
									<span class="selection-number">{cardIndex}</span>
								</button>
								<div class="card-container">
									<Card
										{card}
										isGrouped={false}
										groupingMode={false}
										isSelected={false}
										currentScene={scene}
										{board}
										{userRole}
										{currentUserId}
										onDragStart={() => {}}
										onToggleSelection={handleToggleSelection}
										onVote={handleVote}
										onComment={handleComment}
										onDelete={handleDelete}
										onEdit={handleEdit}
										onCardDrop={handleCardDrop}
										onCardDragOver={handleCardDragOver}
										onCardDragLeave={handleCardDragLeave}
									/>
									{#if metadata}
										<div class="consensus-info">
											<div class="quadrant-badge">{metadata.quadrant_label}</div>
											<div class="participant-count">
												{metadata.participant_count} participants, {metadata.consensus_score}% agreement
											</div>
											{#if metadata.spread}
												<div class="spread-indicator spread-{metadata.spread}">
													{metadata.spread}
												</div>
											{/if}
										</div>
									{:else}
										<div class="consensus-info">
											<div class="no-placement">No placements yet</div>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style lang="less">
	@import "$lib/styles/_mixins.less";

	.quadrant-scene {
	    .page-container();
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.error,
	.loading {
		padding: var(--spacing-8);
		text-align: center;
		color: var(--color-gray-600);
	}

	.facilitator-toolbar {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		background-color: var(--surface-elevated);
		border-bottom: 1px solid var(--color-border);
		animation: slideDown 0.3s ease-out;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.toolbar-controls {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.mode-toggle {
		display: flex;
		gap: 0;
		background-color: color-mix(in srgb, var(--color-primary) 8%, transparent);
		border-radius: var(--radius-lg);
		padding: 0.25rem;
		border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
	}

	.mode-button {
		padding: 0.5rem 1.25rem;
		border: none;
		border-radius: calc(var(--radius-lg) - 0.125rem);
		background-color: transparent;
		color: var(--color-primary);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		min-height: 36px;
		white-space: nowrap;

		&:hover:not(.active) {
			background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
			color: var(--color-primary-hover);
		}

		&.active {
			background-color: var(--btn-primary-bg);
			color: var(--btn-primary-text);
			box-shadow:
				inset 0 1px 2px rgba(0, 0, 0, 0.1),
				0 1px 2px rgba(0, 0, 0, 0.05);
		}
	}

	.setup {
		text-align: center;
		padding: var(--spacing-8);

		h3 {
			margin-bottom: var(--spacing-4);
			color: var(--color-gray-800);
		}

		p {
			margin-bottom: var(--spacing-6);
			color: var(--color-gray-600);
		}

		.waiting-message {
			font-style: italic;
			color: var(--color-text-muted);
			margin-bottom: 0;
		}
	}

	.start-button {
		padding: var(--spacing-3) var(--spacing-6);
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		min-height: 44px;

		&:hover {
			background: var(--color-primary-hover);
		}

		&:focus {
			outline: none;
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent);
		}
	}

	.input-phase {
		.page-container();
		flex-direction: column;
	}

	.quadrant-layout {
		flex: 1;
		display: flex;
		gap: var(--spacing-6);
		padding: var(--spacing-4);
		min-height: 0;
	}

	// Left side: Grid area
	.grid-area {
		flex: 1;
		display: flex;
		gap: var(--spacing-3);
		min-width: 0;
	}

	.y-axis-label {
		writing-mode: vertical-rl;
		text-orientation: mixed;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		color: var(--color-gray-700);
		font-size: 1rem;
		padding: var(--spacing-2);
	}

	.grid-wrapper {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		min-width: 0;
		min-height: 0;
	}

	.quadrant-grid {
		flex: 1;
		position: relative;
		background: white;
		border: 2px solid var(--color-gray-400);
		border-radius: 8px;
		min-height: 400px;
	}

	.grid-lines {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 6;
	}

	.horizontal-line {
		position: absolute;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--color-border-hover);
	}

	.vertical-line {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--color-border-hover);
	}

	// Main axis lines
	.axis-lines {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 7;
	}

	.x-axis-line {
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		height: 2px;
		background: var(--color-border-hover);
		transform: translateY(-50%);
	}

	.y-axis-line {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: 2px;
		background: var(--color-border-hover);
		transform: translateX(-50%);
	}

	// Axis range labels
	.axis-range-labels {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 2;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	.x-range-label {
		position: absolute;
		bottom: 8px;

		&.x-min {
			left: 8px;
		}

		&.x-max {
			right: 8px;
		}
	}

	.y-range-label {
		position: absolute;
		left: 8px;
		transform: rotate(-90deg);
		transform-origin: center;

		&.y-min {
			bottom: 32px; // Offset more to avoid overlap with x-min
		}

		&.y-max {
			top: 8px;
		}
	}

	.card-marker {
		position: absolute;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--color-accent);
		border: 3px solid var(--color-primary);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 1rem;
		line-height: 1;
		cursor: move;
		transform: translate(-50%, -50%);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
		transition: all 0.2s;
		user-select: none;
		z-index: 10;

		&:hover {
			background: var(--color-accent-hover);
			border-color: var(--color-primary-hover);
			transform: translate(-50%, -50%) scale(1.1);
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
		}

		&:active {
			cursor: grabbing;
		}
	}

	.x-axis-label {
		text-align: center;
		font-weight: 600;
		color: var(--color-gray-700);
		font-size: 1rem;
		padding: var(--spacing-2);
	}

	.reset-button {
		position: absolute;
		bottom: -44px; // Position below the grid (accounting for border + some spacing)
		padding: var(--spacing-2) var(--spacing-4);
		background: var(--color-danger);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		z-index: 5;
		min-height: 44px;

		// Default position for "Clear My Input" (always shown)
		right: 0;

		// When admin button exists, position "Clear My Input" to its left
		&:not(.admin) {
			right: 0;
		}

		&.admin {
			right: 140px; // Position "Reset All" to the left of "Clear My Input"
			background: var(--color-warning);

			&:hover {
				background: var(--color-warning-hover);
			}

			&:focus {
				box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-warning) 20%, transparent);
			}
		}

		&:hover {
			background: var(--color-danger-hover);
		}

		&:active {
			background: var(--color-danger-hover);
			transform: translateY(1px);
		}

		&:focus {
			outline: none;
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-danger) 20%, transparent);
		}
	}

	// Right side: Cards sidebar
	.cards-sidebar {
		width: 320px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		padding: var(--spacing-4);
		overflow-y: auto;
	}

	.cards-list {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.card-wrapper {
		display: flex;
		align-items: flex-start;
		position: relative;
		padding-left: 36px; // Space for selection indicator
		user-select: none;

		&.positioned {
			opacity: 0.6;
		}

		&:active {
			opacity: 0.3;
		}

		&.selected .card-container {
			position: relative;

			&::after {
				content: "";
				position: absolute;
				inset: -4px;
				background: var(--color-accent);
				border: 2px solid var(--color-accent);
				border-radius: var(--radius-md);
				opacity: 0.3;
				pointer-events: none;
				z-index: -1;
			}
		}
	}

	.selection-indicator-static {
		position: absolute;
		left: 0;
		top: var(--spacing-3);
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 2px solid var(--color-border);
		background: transparent;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;

		&.highlighted {
			border-color: var(--color-accent);
			background: var(--color-accent);
		}
	}

	.selection-number {
		font-size: 0.875rem;
		line-height: 1;
		color: var(--color-text-muted);
		font-weight: 700;

		.highlighted & {
			color: white;
		}
	}

	.card-container {
		flex: 1;
		width: 100%;
	}

	.positioned-badge {
		position: absolute;
		top: var(--spacing-2);
		right: var(--spacing-2);
		background: var(--color-accent);
		color: white;
		padding: var(--spacing-1) var(--spacing-2);
		border-radius: var(--radius-md);
		font-size: 0.75rem;
		font-weight: 600;
		pointer-events: none;
	}

	// Results phase (reuses input-phase grid layout)
	.results-phase {
		.page-container();
		flex-direction: column;
	}

	.heatmap-overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 5;
	}

	.consensus-marker {
		cursor: pointer;

		&:hover {
			background: var(--color-accent-hover);
			border-color: var(--color-primary-hover);
			transform: translate(-50%, -50%) scale(1.15);
			box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
		}

		&.selected {
			background: var(--color-primary);
			border-color: var(--color-accent);
			transform: translate(-50%, -50%) scale(1.2);
			box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary) 30%, transparent),
				0 4px 20px rgba(0, 0, 0, 0.6);
			z-index: 20;
		}
	}

	.results-card {
		position: relative;
		transition: all 0.2s;

		&.selected {
			&::after {
				content: "";
				position: absolute;
				inset: -4px;
				background: var(--color-accent);
				border: 2px solid var(--color-accent);
				border-radius: var(--radius-md);
				opacity: 0.3;
				pointer-events: none;
				z-index: -1;
			}
		}
	}

	.selection-button {
		position: absolute;
		left: 0;
		top: var(--spacing-3);
		flex-shrink: 0;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 2px solid var(--color-border);
		background: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
		z-index: 10;

		&:hover:not(.active) {
			border-color: var(--color-accent);
			background: color-mix(in srgb, var(--color-accent) 10%, transparent);
		}

		&.active {
			border-color: var(--color-accent);
			background: var(--color-accent);

			.selection-number {
				color: white;
			}
		}
	}

	.selection-number {
		font-size: 0.875rem;
		line-height: 1;
		color: var(--color-text-muted);
		font-weight: 700;
	}

	.card-container {
		flex: 1;
		width: 100%;
	}

	.consensus-info {
		margin-top: var(--spacing-2);
		padding-top: var(--spacing-2);
		border-top: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);

		.quadrant-badge {
			font-size: 0.75rem;
			font-weight: 600;
			color: var(--color-accent);
		}

		.participant-count {
			font-size: 0.7rem;
			color: var(--color-text-secondary);
		}

		.no-placement {
			font-size: 0.75rem;
			color: var(--color-text-muted);
			font-style: italic;
		}

		.spread-indicator {
			font-size: 0.65rem;
			font-weight: 600;
			padding: var(--spacing-1) var(--spacing-2);
			border-radius: var(--radius-sm);
			text-transform: uppercase;
			letter-spacing: 0.5px;
			display: inline-block;
			margin-top: var(--spacing-1);

			&.spread-tight {
				background: color-mix(in srgb, var(--color-success) 15%, transparent);
				color: var(--color-success);
			}

			&.spread-moderate {
				background: color-mix(in srgb, var(--color-warning) 15%, transparent);
				color: var(--color-warning);
			}

			&.spread-dispersed {
				background: color-mix(in srgb, var(--color-danger) 15%, transparent);
				color: var(--color-danger);
			}
		}
	}
</style>
