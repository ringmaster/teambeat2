<script lang="ts">
    import type { Board, Scene } from "$lib/types";
    import Icon from "./ui/Icon.svelte";
    import { toastStore } from "$lib/stores/toast";
    import { onMount } from "svelte";
    import { getUserDisplayName } from "$lib/utils/animalNames";

    interface Props {
        board: Board;
        scene: Scene;
        userRole: string;
    }

    const { board, scene, userRole }: Props = $props();

    interface UnifiedAgreement {
        id: string;
        source: "agreement" | "comment";
        userId: string | null;
        userName: string | null;
        displayName: string | null;
        content: string;
        completed: boolean;
        completedByUserId: string | null;
        completedByUserName: string | null;
        completedByDisplayName: string | null;
        completedAt: string | null;
        createdAt: string;
        updatedAt: string;
        // Agreement-specific fields
        boardId?: string;
        sourceAgreementId?: string | null;
        // Comment-specific fields
        cardId?: string;
        cardContent?: string;
        columnId?: string;
        columnTitle?: string;
    }

    let agreements = $state<UnifiedAgreement[]>([]);
    let loading = $state(true);
    let newAgreementContent = $state("");
    let editingAgreementId = $state<string | null>(null);
    let editingContent = $state("");
    let dropdownOpen = $state<string | null>(null);

    const isFacilitator = $derived(
        userRole === "admin" || userRole === "facilitator",
    );

    loadAgreements();

    $effect(() => {
        const listener = handleAgreementsUpdate as EventListener;
        window.addEventListener("agreements_updated", listener);

        const reloadListener = () => loadAgreements();
        window.addEventListener("reload_agreements", reloadListener);

        return () => {
            window.removeEventListener("agreements_updated", listener);
            window.removeEventListener("reload_agreements", reloadListener);
        };
    });

    async function loadAgreements() {
        try {
            const response = await fetch(`/api/boards/${board.id}/agreements`);
            if (response.ok) {
                const data = await response.json();
                agreements = data.agreements || [];
            }
        } catch (error) {
            console.error("Failed to load agreements:", error);
            toastStore.error("Failed to load agreements");
        } finally {
            loading = false;
        }
    }

    async function createAgreement() {
        if (!newAgreementContent.trim()) return;

        try {
            const response = await fetch(`/api/boards/${board.id}/agreements`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: newAgreementContent.trim() }),
            });

            if (response.ok) {
                newAgreementContent = "";
                toastStore.success("Agreement created");
            } else {
                const data = await response.json();
                toastStore.error(data.error || "Failed to create agreement");
            }
        } catch (error) {
            console.error("Failed to create agreement:", error);
            toastStore.error("Failed to create agreement");
        }
    }

    async function updateAgreement(agreementId: string, content: string) {
        try {
            const response = await fetch(`/api/agreements/${agreementId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            });

            if (response.ok) {
                editingAgreementId = null;
                editingContent = "";
                toastStore.success("Agreement updated");
            } else {
                const data = await response.json();
                toastStore.error(data.error || "Failed to update agreement");
            }
        } catch (error) {
            console.error("Failed to update agreement:", error);
            toastStore.error("Failed to update agreement");
        }
    }

    async function toggleAgreementCompletion(agreement: UnifiedAgreement) {
        try {
            let response;
            if (agreement.source === "agreement") {
                response = await fetch(
                    `/api/agreements/${agreement.id}/complete`,
                    {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            completed: !agreement.completed,
                        }),
                    },
                );
            } else {
                // Comment-based agreement
                response = await fetch(
                    `/api/comments/${agreement.id}/complete`,
                    {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            completed: !agreement.completed,
                        }),
                    },
                );
            }

            if (response.ok) {
                const data = await response.json();
                const updatedAgreement = data.agreement || data.comment;
                if (updatedAgreement) {
                    agreements = agreements.map((a) =>
                        a.id === updatedAgreement.id ? updatedAgreement : a,
                    );
                }
            } else {
                const data = await response.json();
                toastStore.error(data.error || "Failed to update agreement");
            }
        } catch (error) {
            console.error("Failed to update agreement:", error);
            toastStore.error("Failed to update agreement");
        }
    }

    async function deleteAgreement(agreementId: string) {
        if (!confirm("Are you sure you want to delete this agreement?")) return;

        try {
            const response = await fetch(`/api/agreements/${agreementId}`, {
                method: "DELETE",
            });

            if (response.ok) {
                toastStore.success("Agreement deleted");
            } else {
                const data = await response.json();
                toastStore.error(data.error || "Failed to delete agreement");
            }
        } catch (error) {
            console.error("Failed to delete agreement:", error);
            toastStore.error("Failed to delete agreement");
        }
    }

    async function copyToCard(agreement: UnifiedAgreement, columnId: string) {
        try {
            const endpoint =
                agreement.source === "comment"
                    ? `/api/comments/${agreement.id}/copy-to-card`
                    : `/api/agreements/${agreement.id}/copy-to-card`;

            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ column_id: columnId }),
            });

            if (response.ok) {
                toastStore.success("Agreement copied to card");
                dropdownOpen = null;
            } else {
                const data = await response.json();
                toastStore.error(data.error || "Failed to copy to card");
            }
        } catch (error) {
            console.error("Failed to copy to card:", error);
            toastStore.error("Failed to copy to card");
        }
    }

    function startEdit(agreement: EnrichedAgreement) {
        editingAgreementId = agreement.id;
        editingContent = agreement.content;
    }

    function cancelEdit() {
        editingAgreementId = null;
        editingContent = "";
    }

    function formatDate(dateString: string | null): string {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }

    function closeDropdown() {
        dropdownOpen = null;
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

    // Get visible columns for dropdown
    const visibleColumns = $derived(() => {
        if (!board.columns || !scene.id) return [];
        const hiddenColumnIds = board.hiddenColumnsByScene?.[scene.id] || [];
        return board.columns.filter((col) => !hiddenColumnIds.includes(col.id));
    });

    // Handle SSE updates
    function handleAgreementsUpdate(event: CustomEvent) {
        const updatedAgreements = event.detail;
        if (updatedAgreements) {
            agreements = updatedAgreements;
        }
    }
</script>

<div class="agreements-scene">
    <div class="agreements-header">
        <h2>{scene.title}</h2>
        <p class="scene-description">Review and manage commitments</p>
    </div>

    {#if loading}
        <div class="loading">Loading...</div>
    {:else}
        <!-- Unified Agreements Section -->
        <div class="agreements-section">
            {#if isFacilitator}
                <div class="add-agreement-form">
                    <textarea
                        bind:value={newAgreementContent}
                        placeholder="Add a new agreement..."
                        rows="2"
                        maxlength="1000"
                    ></textarea>
                    <button
                        class="primary-button"
                        onclick={createAgreement}
                        disabled={!newAgreementContent.trim()}
                    >
                        Add
                    </button>
                </div>
            {/if}

            {#if agreements.length > 0}
                <div class="agreements-list">
                    {#each agreements as agreement (agreement.id)}
                        <div
                            class="agreement-item"
                            class:completed={agreement.completed}
                        >
                            <div class="agreement-checkbox">
                                {#if isFacilitator}
                                    <input
                                        type="checkbox"
                                        checked={agreement.completed}
                                        onchange={() =>
                                            toggleAgreementCompletion(
                                                agreement,
                                            )}
                                    />
                                {:else}
                                    <span class="bullet">•</span>
                                {/if}
                            </div>
                            <div class="agreement-content">
                                {#if agreement.source === "agreement" && editingAgreementId === agreement.id}
                                    <div class="edit-form">
                                        <textarea
                                            bind:value={editingContent}
                                            rows="2"
                                            maxlength="1000"
                                        ></textarea>
                                        <div class="edit-actions">
                                            <button
                                                class="primary-button"
                                                onclick={() =>
                                                    updateAgreement(
                                                        agreement.id,
                                                        editingContent,
                                                    )}
                                                disabled={!editingContent.trim()}
                                            >
                                                Save
                                            </button>
                                            <button
                                                class="secondary-button"
                                                onclick={cancelEdit}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                {:else}
                                    <div class="agreement-text">
                                        {agreement.content}
                                    </div>
                                    <div class="agreement-meta">
                                        {#if agreement.source === "comment" && agreement.cardContent}
                                            <span class="card-reference">
                                                From: {agreement.columnTitle} - "{agreement.cardContent.substring(
                                                    0,
                                                    50,
                                                )}{agreement.cardContent
                                                    .length > 50
                                                    ? "..."
                                                    : ""}"
                                            </span>
                                            {#if agreement.displayName}
                                                <span class="separator">•</span>
                                            {/if}
                                        {/if}
                                        {#if agreement.displayName}
                                            <span
                                                >By {agreement.displayName} on {formatDate(
                                                    agreement.createdAt,
                                                )}</span
                                            >
                                        {/if}
                                        {#if agreement.completed && agreement.completedByDisplayName}
                                            {#if agreement.displayName || (agreement.source === "comment" && agreement.cardContent)}
                                                <span class="separator">•</span>
                                            {/if}
                                            <span class="completed-info">
                                                Completed by {agreement.completedByDisplayName}
                                                on {formatDate(
                                                    agreement.completedAt,
                                                )}
                                            </span>
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                            {#if isFacilitator && agreement.source === "agreement" && editingAgreementId !== agreement.id}
                                <div
                                    class="agreement-actions"
                                    use:clickOutside={closeDropdown}
                                >
                                    <button
                                        class="icon-button"
                                        onclick={() => startEdit(agreement)}
                                        title="Edit"
                                    >
                                        <Icon name="edit" />
                                    </button>
                                    {#if visibleColumns().length > 0}
                                        <button
                                            class="icon-button"
                                            onclick={() =>
                                                (dropdownOpen =
                                                    dropdownOpen ===
                                                    agreement.id
                                                        ? null
                                                        : agreement.id)}
                                            title="More options"
                                        >
                                            <Icon name="menu" />
                                        </button>
                                        {#if dropdownOpen === agreement.id}
                                            <div class="dropdown-menu">
                                                <div class="dropdown-header">
                                                    Copy to column:
                                                </div>
                                                {#each visibleColumns() as column}
                                                    <button
                                                        class="dropdown-item"
                                                        onclick={() =>
                                                            copyToCard(
                                                                agreement,
                                                                column.id,
                                                            )}
                                                    >
                                                        {column.title}
                                                    </button>
                                                {/each}
                                                <div
                                                    class="dropdown-divider"
                                                ></div>
                                                <button
                                                    class="dropdown-item danger"
                                                    onclick={() =>
                                                        deleteAgreement(
                                                            agreement.id,
                                                        )}
                                                >
                                                    Delete Agreement
                                                </button>
                                            </div>
                                        {/if}
                                    {:else}
                                        <button
                                            class="icon-button"
                                            onclick={() =>
                                                deleteAgreement(agreement.id)}
                                            title="Delete"
                                        >
                                            <Icon name="trash" />
                                        </button>
                                    {/if}
                                </div>
                            {/if}
                            {#if isFacilitator && agreement.source === "comment" && visibleColumns().length > 0}
                                <div
                                    class="agreement-actions"
                                    use:clickOutside={closeDropdown}
                                >
                                    <button
                                        class="icon-button"
                                        onclick={() =>
                                            (dropdownOpen =
                                                dropdownOpen === agreement.id
                                                    ? null
                                                    : agreement.id)}
                                        title="Copy to card"
                                    >
                                        <Icon name="menu" />
                                    </button>
                                    {#if dropdownOpen === agreement.id}
                                        <div class="dropdown-menu">
                                            <div class="dropdown-header">
                                                Copy to column:
                                            </div>
                                            {#each visibleColumns() as column}
                                                <button
                                                    class="dropdown-item"
                                                    onclick={() =>
                                                        copyToCard(
                                                            agreement,
                                                            column.id,
                                                        )}
                                                >
                                                    {column.title}
                                                </button>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            {:else if !isFacilitator}
                <p class="no-agreements">No agreements yet</p>
            {/if}
        </div>
    {/if}
</div>

<style lang="less">
    .agreements-scene {
        padding: 2rem;
        max-width: 1200px;
        margin: 0 auto;
        width: 800px;
    }

    .agreements-header {
        margin-bottom: 2rem;

        h2 {
            font-size: 1.75rem;
            margin: 0 0 0.5rem 0;
        }

        .scene-description {
            color: #666;
            margin: 0;
        }
    }

    .loading {
        text-align: center;
        padding: 2rem;
        color: #666;
    }

    .agreements-section {
        margin-bottom: 2rem;
    }

    .add-agreement-form {
        display: flex;
        gap: 0.75rem;
        margin-bottom: 1.5rem;
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        padding: var(--spacing-2);

        textarea {
            flex: 1;
            padding: 0.75rem;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-family: inherit;
            font-size: 0.9375rem;
            resize: vertical;
            min-height: 60px;

            &:focus {
                outline: none;
                border-color: #0066cc;
            }
        }

        .primary-button {
            align-self: center;
        }
    }

    .agreements-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .agreement-item {
        display: flex;
        gap: 0.75rem;
        padding: 1rem;
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        position: relative;

        &.completed {
            opacity: 0.7;

            .agreement-text {
                text-decoration: line-through;
            }
        }
    }

    .agreement-checkbox {
        flex-shrink: 0;
        padding-top: 0.125rem;

        input[type="checkbox"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
        }

        .bullet {
            display: inline-block;
            font-size: 1.5rem;
            line-height: 1;
        }
    }

    .agreement-content {
        flex: 1;
        min-width: 0;
    }

    .agreement-text {
        font-size: 0.9375rem;
        line-height: 1.5;
        margin-bottom: 0.5rem;
        word-wrap: break-word;
    }

    .agreement-meta {
        font-size: 0.8125rem;
        color: #666;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;

        .separator {
            color: #ccc;
        }

        .card-reference {
            font-style: italic;
        }

        .completed-info {
            color: #28a745;
        }
    }

    .edit-form {
        textarea {
            width: 100%;
            padding: 0.5rem;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-family: inherit;
            font-size: 0.9375rem;
            resize: vertical;
            margin-bottom: 0.5rem;

            &:focus {
                outline: none;
                border-color: #0066cc;
            }
        }

        .edit-actions {
            display: flex;
            gap: 0.5rem;
        }
    }

    .agreement-actions {
        flex-shrink: 0;
        display: flex;
        gap: 0.25rem;
        position: relative;
    }

    .icon-button {
        background: none;
        border: none;
        padding: 0.25rem;
        cursor: pointer;
        color: #666;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;

        &:hover {
            background: #f5f5f5;
            color: #333;
        }
    }

    .dropdown-menu {
        position: absolute;
        top: 100%;
        right: 0;
        background: white;
        border: 1px solid #ddd;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        min-width: 180px;
        z-index: 1000;
        margin-top: 0.25rem;
    }

    .dropdown-header {
        padding: 0.5rem 0.75rem;
        font-size: 0.75rem;
        font-weight: 600;
        color: #666;
        text-transform: uppercase;
        border-bottom: 1px solid #f0f0f0;
    }

    .dropdown-item {
        display: block;
        width: 100%;
        padding: 0.625rem 0.75rem;
        background: none;
        border: none;
        text-align: left;
        cursor: pointer;
        font-size: 0.875rem;
        color: #333;

        &:hover {
            background: #f5f5f5;
        }

        &.danger {
            color: #dc3545;

            &:hover {
                background: #fff5f5;
            }
        }
    }

    .dropdown-divider {
        height: 1px;
        background: #f0f0f0;
        margin: 0.25rem 0;
    }

    .no-agreements {
        color: #999;
        font-style: italic;
        padding: 1rem;
        text-align: center;
    }

    .primary-button {
        background: #0066cc;
        color: white;
        border: none;
        padding: 0.625rem 1.25rem;
        border-radius: 4px;
        font-size: 0.9375rem;
        cursor: pointer;
        font-weight: 500;

        &:hover:not(:disabled) {
            background: #0052a3;
        }

        &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
    }

    .secondary-button {
        background: #6c757d;
        color: white;
        border: none;
        padding: 0.625rem 1.25rem;
        border-radius: 4px;
        font-size: 0.9375rem;
        cursor: pointer;
        font-weight: 500;

        &:hover {
            background: #5a6268;
        }
    }
</style>
