<script lang="ts">
import { toastStore } from "$lib/stores/toast";
import Toast from "./Toast.svelte";

function handleToastClose(toastId: string) {
	toastStore.removeToast(toastId);
}

function handleAction(
	toastId: string,
	action: {
		label: string;
		onClick: () => void;
		variant?: "primary" | "secondary";
	},
) {
	action.onClick();
	// Remove the toast after action is taken
	toastStore.removeToast(toastId);
}
</script>

<div class="toast-container">
    {#each $toastStore as toast (toast.id)}
        <Toast
            type={toast.type}
            message={toast.message}
            actions={toast.actions?.map((action) => ({
                ...action,
                onClick: () => handleAction(toast.id, action),
            }))}
            autoHide={toast.autoHide}
            duration={toast.duration}
            onClose={() => handleToastClose(toast.id)}
        />
    {/each}
</div>

<style lang="less">
    .toast-container {
        position: fixed;
        top: var(--spacing-4);
        right: var(--spacing-4);
        z-index: 50;
        display: flex;
        flex-direction: column;
        gap: var(--spacing-3);
        pointer-events: none;

        :global(.toast) {
            pointer-events: all;
        }
    }
</style>
