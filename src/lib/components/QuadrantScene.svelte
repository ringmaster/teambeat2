<script lang="ts">
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
		scene.quadrantConfig ? JSON.parse(scene.quadrantConfig) : null
	);
	let phase = $derived<"input" | "results" | null>(scene.quadrantPhase);

	let userPositions = $state<QuadrantPosition[]>([]);
	let loading = $state(true);
	let draggedCardId = $state<string | null>(null);
	let draggedMarkerId = $state<string | null>(null);

	// Parse grid dimensions
	let gridCols = $derived(config ? Number.parseInt(config.grid_size[0]) : 2);
	let gridRows = $derived(config ? Number.parseInt(config.grid_size[2]) : 2);

	// Load user positions if in input phase
	$effect(() => {
		if (phase === "input") {
			loadPositions();
		}
	});

	async function loadPositions() {
		try {
			const response = await fetch(
				`/api/scenes/${scene.id}/quadrant/positions`
			);
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
				}
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
				}
			);
			const data = await response.json();
			if (!data.success) {
				alert(`Failed to calculate consensus: ${data.error}`);
			}
		} catch (error) {
			console.error("Failed to calculate consensus:", error);
			alert("Failed to calculate consensus");
		}
	}

	async function switchToInput() {
		try {
			const response = await fetch(
				`/api/boards/${boardId}/scenes/${scene.id}`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ quadrantPhase: "input" }),
				}
			);
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
					(p) => p.card_id === cardId
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
		const yPercent = Math.max(0, Math.min(96, Math.round(((rect.height - y) / rect.height) * 96)));

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
	let positionedCardIds = $derived(new Set(userPositions.map(p => p.card_id)));

	// Convert card position to grid coordinates (percentage)
	function getMarkerPosition(position: QuadrantPosition): { x: number; y: number } {
		// X is normal (0-96 left to right)
		const x = (position.x_value / 96) * 100;
		// Y is inverted (0 at bottom, 96 at top)
		const y = 100 - ((position.y_value / 96) * 100);
		return { x, y };
	}

	// Get card index for numbering
	function getCardIndex(cardId: string): number {
		return cards.findIndex(c => c.id === cardId) + 1;
	}

	// Simplified card handlers (quadrant scene doesn't need full card functionality)
	function handleCardDrop() { }
	function handleCardDragOver() { }
	function handleCardDragLeave() { }
	function handleToggleSelection() { }
	function handleVote() { }
	function handleComment() { }
	function handleDelete() { }
	function handleEdit() { }

	// Reset all card positions
	async function resetAllPositions() {
		try {
			// Delete all positions for this user in this scene
			const deletePromises = userPositions.map(position =>
				fetch(`/api/quadrant-positions/${position.card_id}?scene_id=${scene.id}`, {
					method: "DELETE",
				})
			);
			await Promise.all(deletePromises);
			userPositions = [];
		} catch (error) {
			console.error("Failed to reset positions:", error);
		}
	}
</script>

<div class="quadrant-scene">
	{#if !config}
		<div class="error">No quadrant configuration found for this scene.</div>
	{:else if !phase && (isAdmin || isFacilitator)}
		<div class="setup">
			<h3>Quadrant Scene: {config.x_axis_label} vs {config.y_axis_label}</h3>
			<p>Grid size: {config.grid_size}</p>
			<button onclick={startInput} class="start-button">Start Input Phase</button>
		</div>
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

								<!-- Main axis lines -->
								<div class="axis-lines">
									<div class="x-axis-line"></div>
									<div class="y-axis-line"></div>
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

								<!-- Reset button positioned below bottom-right corner -->
								<button onclick={resetAllPositions} class="reset-button" type="button">
									Reset All
								</button>
							</div>
							<div class="x-axis-label">{config.x_axis_label}</div>
						</div>
					</div>

					<!-- Right: Cards sidebar -->
					<div class="cards-sidebar">
						<div class="cards-list">
							{#each cards as card (card.id)}
								{@const isPositioned = positionedCardIds.has(card.id)}
								<div
									class="card-wrapper"
									class:positioned={isPositioned}
									draggable="true"
									ondragstart={(e) => handleCardDragStart(e, card.id)}
									ondragend={handleCardDragEnd}
								>
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
			<h3>Results: {config.x_axis_label} vs {config.y_axis_label}</h3>
			<p class="instructions">
				Cards are positioned at consensus coordinates based on all participant placements.
			</p>

			<div class="results-grid">
				{#each cards as card (card.id)}
					{@const metadata = getCardMetadata(card)}
					{#if metadata}
						<div class="result-card">
							<div class="card-content">{card.content}</div>
							<div class="metadata">
								<div>Quadrant: {metadata.quadrant_label}</div>
								<div>Participants: {metadata.participant_count}</div>
								<div>
									Position: ({Math.round(metadata.facilitator_x || metadata.consensus_x)},
									{Math.round(metadata.facilitator_y || metadata.consensus_y)})
								</div>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}
</div>

<style lang="less">
	.quadrant-scene {
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
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.quadrant-layout {
		flex: 1;
		display: flex;
		gap: var(--spacing-6);
		padding: var(--spacing-4);
		overflow: hidden;
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
	}

	.horizontal-line {
		position: absolute;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--color-border-hover);
		z-index: 0;
	}

	.vertical-line {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--color-border-hover);
		z-index: 0;
	}

	// Main axis lines
	.axis-lines {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 1;
	}

	.x-axis-line {
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		height: 3px;
		background: var(--color-text-muted);
		transform: translateY(-50%);
	}

	.y-axis-line {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: 3px;
		background: var(--color-text-muted);
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
		right: 0;
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
		background: var(--surface-elevated);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-4);
	}

	.cards-list {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.card-wrapper {
		position: relative;
		cursor: move;
		user-select: none;

		&.positioned {
			opacity: 0.6;
		}

		&:active {
			opacity: 0.3;
		}
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

	// Results phase
	.results-phase {
		padding: var(--spacing-4);

		h3 {
			margin-bottom: var(--spacing-2);
			color: var(--color-gray-800);
		}

		.instructions {
			margin-bottom: var(--spacing-6);
			color: var(--color-gray-600);
		}
	}

	.results-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: var(--spacing-4);
	}

	.result-card {
		padding: var(--spacing-4);
		background: white;
		border: 1px solid var(--color-gray-200);
		border-radius: 8px;

		.card-content {
			margin-bottom: var(--spacing-3);
			font-weight: 500;
		}

		.metadata {
			font-size: 0.875rem;
			color: var(--color-gray-600);

			div {
				margin-bottom: var(--spacing-1);
			}
		}
	}
</style>
