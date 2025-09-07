<script lang="ts">
    import { toastStore, type ToastMessage } from '$lib/stores/toast';
    import Toast from './Toast.svelte';

    let toasts: ToastMessage[] = $state([]);

    $effect(() => {
        const unsubscribe = toastStore.subscribe(value => {
            toasts = value;
        });
        return unsubscribe;
    });

    function handleToastClose(toastId: string) {
        toastStore.removeToast(toastId);
    }

    function handleAction(toastId: string, action: { label: string; onClick: () => void; variant?: 'primary' | 'secondary' }) {
        action.onClick();
        // Remove the toast after action is taken
        toastStore.removeToast(toastId);
    }
</script>

<div class="toast-container">
    {#each toasts as toast (toast.id)}
        <Toast
            type={toast.type}
            message={toast.message}
            actions={toast.actions?.map(action => ({
                ...action,
                onClick: () => handleAction(toast.id, action)
            }))}
            autoHide={toast.autoHide}
            duration={toast.duration}
            onclose={() => handleToastClose(toast.id)}
        />
    {/each}
</div>

<style type="less">
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