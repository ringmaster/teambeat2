import { writable } from 'svelte/store';

export interface ToastMessage {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    actions?: Array<{ label: string; onClick: () => void; variant?: 'primary' | 'secondary' }>;
    autoHide?: boolean;
    duration?: number;
}

function createToastStore() {
    const { subscribe, update } = writable<ToastMessage[]>([]);

    function addToast(toast: Omit<ToastMessage, 'id'>) {
        const id = crypto.randomUUID();
        const newToast: ToastMessage = {
            id,
            autoHide: true,
            duration: 4000,
            ...toast
        };

        update(toasts => [...toasts, newToast]);

        // Auto-remove toast if autoHide is true and no actions
        if (newToast.autoHide && (!newToast.actions || newToast.actions.length === 0)) {
            setTimeout(() => {
                removeToast(id);
            }, newToast.duration);
        }

        return id;
    }

    function removeToast(id: string) {
        update(toasts => toasts.filter(toast => toast.id !== id));
    }

    function clearAll() {
        update(() => []);
    }

    // Convenience methods for different toast types
    function success(message: string, options?: Partial<Omit<ToastMessage, 'id' | 'type' | 'message'>>) {
        return addToast({ type: 'success', message, ...options });
    }

    function error(message: string, options?: Partial<Omit<ToastMessage, 'id' | 'type' | 'message'>>) {
        return addToast({ type: 'error', message, ...options });
    }

    function warning(message: string, options?: Partial<Omit<ToastMessage, 'id' | 'type' | 'message'>>) {
        return addToast({ type: 'warning', message, ...options });
    }

    function info(message: string, options?: Partial<Omit<ToastMessage, 'id' | 'type' | 'message'>>) {
        return addToast({ type: 'info', message, ...options });
    }

    // Special method for handling draft board sharing
    function draftBoardWarning(onMakeActive: () => void) {
        return warning(
            'Boards that are in draft cannot be shared. Make board active?',
            {
                autoHide: false,
                actions: [
                    {
                        label: 'Yes',
                        onClick: onMakeActive,
                        variant: 'primary'
                    },
                    {
                        label: 'Cancel',
                        onClick: () => {}, // Will auto-close on action
                        variant: 'secondary'
                    }
                ]
            }
        );
    }

    return {
        subscribe,
        addToast,
        removeToast,
        clearAll,
        success,
        error,
        warning,
        info,
        draftBoardWarning
    };
}

export const toastStore = createToastStore();