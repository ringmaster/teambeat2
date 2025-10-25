<script lang="ts">
import { cubicOut } from "svelte/easing";
import { fade, fly } from "svelte/transition";

interface Props {
	show: boolean;
	title?: string;
	onClose: () => void;
	size?: "sm" | "md" | "lg" | "xl";
	children?: any;
}

let { show = false, title, onClose, size = "md", children }: Props = $props();

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
            <div class="modal-content band">
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

                <div class="modal-body expand">
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
        padding: 0.5rem;

        @media (min-width: 640px) {
            padding: 1rem;
        }
    }

    .modal-dialog {
        background: white;
        border-radius: 0.5rem;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        width: 100%;
        max-height: 95vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;

        @media (min-width: 640px) {
            max-height: 90vh;
        }
    }

    .modal-sm {
        max-width: 100%;

        @media (min-width: 640px) {
            max-width: 28rem;
        }
    }

    .modal-md {
        max-width: 100%;

        @media (min-width: 640px) {
            max-width: 32rem;
        }
    }

    .modal-lg {
        max-width: 100%;

        @media (min-width: 768px) {
            max-width: 48rem;
        }
    }

    .modal-xl {
        max-width: 100%;

        @media (min-width: 1024px) {
            max-width: 64rem;
        }
    }

    .modal-content {
        /* Layout handled by .band class */
    }

    .modal-header {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 0.75rem;
        border-bottom: 1px solid var(--border-light);
        margin-bottom: 0;

        @media (min-width: 640px) {
            padding: 0.75rem 1rem;
        }
    }

    .modal-title {
        font-size: 1.125rem;
        font-weight: 600;
        color: #111827;
        margin: 0;

        @media (min-width: 640px) {
            font-size: 1.25rem;
        }
    }

    .close-button {
        background: none;
        border: none;
        font-size: 1.5rem;
        font-weight: bold;
        color: #6b7280;
        cursor: pointer;
        padding: 0.5rem;
        line-height: 1;
        transition: color 0.2s ease;
        min-width: 44px;
        min-height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;

        @media (min-width: 640px) {
            padding: 0.25rem;
            min-width: auto;
            min-height: auto;
        }
    }

    .close-button:hover {
        color: #374151;
    }

    .modal-body {
        /* Layout handled by .expand class */
        padding: 0 0.75rem 0.75rem 0.75rem;

        @media (min-width: 640px) {
            padding: 0 1rem 1rem 1rem;
        }
    }
</style>
