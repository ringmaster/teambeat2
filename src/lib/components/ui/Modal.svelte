<script lang="ts">
    import { fade, fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";

    interface Props {
        show: boolean;
        title?: string;
        onClose: () => void;
        size?: "sm" | "md" | "lg" | "xl";
        children?: any;
    }

    let {
        show = false,
        title,
        onClose,
        size = "md",
        children,
    }: Props = $props();

    let dialogElement: HTMLDivElement = $state() as HTMLDivElement;

    // Handle escape key
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Escape" && show) {
            onClose();
        }
    }

    // Handle overlay click
    function handleOverlayClick(event: MouseEvent) {
        if (event.target === event.currentTarget) {
            onClose();
        }
    }

    // Focus management
    $effect(() => {
        if (show && dialogElement) {
            // Focus the dialog when it opens
            const focusableElements = dialogElement.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            );
            if (focusableElements.length > 0) {
                (focusableElements[0] as HTMLElement).focus();
            }
        }
    });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show}
    <div
        class="modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        tabindex="-1"
        transition:fade={{ duration: 200 }}
        onclick={handleOverlayClick}
        onkeydown={handleKeydown}
    >
        <div
            bind:this={dialogElement}
            class="modal-dialog modal-{size}"
            role="document"
            tabindex="0"
            transition:fly={{ y: -20, duration: 300, easing: cubicOut }}
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
        >
            <div class="modal-content">
                {#if title}
                    <div class="modal-header">
                        <h2 id="modal-title" class="modal-title">{title}</h2>
                        <button
                            onclick={onClose}
                            class="close-button"
                            aria-label="Close modal"
                        >
                            ×
                        </button>
                    </div>
                {/if}

                <div class="modal-body">
                    {@render children()}
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
    }

    .modal-dialog {
        background: white;
        border-radius: 0.5rem;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        width: 100%;
        max-height: 90vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .modal-sm {
        max-width: 28rem;
    }

    .modal-md {
        max-width: 32rem;
    }

    .modal-lg {
        max-width: 48rem;
    }

    .modal-xl {
        max-width: 64rem;
    }

    .modal-content {
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--border-light);
        margin-bottom: 0;
    }

    .modal-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: #111827;
        margin: 0;
    }

    .close-button {
        background: none;
        border: none;
        font-size: 1.5rem;
        font-weight: bold;
        color: #6b7280;
        cursor: pointer;
        padding: 0.25rem;
        line-height: 1;
        transition: color 0.2s ease;
    }

    .close-button:hover {
        color: #374151;
    }

    .modal-body {
        padding: 0 1rem 1rem 1rem;
        overflow-y: auto;
        flex: 1;
    }
</style>
