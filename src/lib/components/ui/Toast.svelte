<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import Icon from './Icon.svelte';

    interface Props {
        type: 'success' | 'error' | 'warning' | 'info';
        message: string;
        actions?: Array<{ label: string; onClick: () => void; variant?: 'primary' | 'secondary' }>;
        autoHide?: boolean;
        duration?: number;
        visible?: boolean;
    }

    let {
        type,
        message,
        actions = [],
        autoHide = true,
        duration = 4000,
        visible = true
    }: Props = $props();

    const dispatch = createEventDispatcher();

    let timeoutId: number | null = null;

    $effect(() => {
        if (visible && autoHide && actions.length === 0) {
            timeoutId = setTimeout(() => {
                handleClose();
            }, duration);
        }

        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    });

    function handleClose() {
        visible = false;
        dispatch('close');
    }

    function handleAction(action: { label: string; onClick: () => void; variant?: 'primary' | 'secondary' }) {
        action.onClick();
        // Don't auto-close when action is taken - let the container handle it
    }

    const iconMap = {
        success: 'check-circle',
        error: 'x-circle',
        warning: 'alert-triangle',
        info: 'info'
    };
</script>

{#if visible}
    <div class="toast toast--{type}" role="alert" aria-live="polite">
        <div class="toast__content">
            <div class="toast__icon">
                <Icon name={iconMap[type]} class="icon-sm" />
            </div>
            
            <div class="toast__message">
                {message}
            </div>

            {#if actions.length > 0}
                <div class="toast__actions">
                    {#each actions as action}
                        <button 
                            class="toast__action toast__action--{action.variant || 'primary'}"
                            onclick={() => handleAction(action)}
                        >
                            {action.label}
                        </button>
                    {/each}
                </div>
            {/if}
        </div>

        <button 
            class="toast__close" 
            onclick={handleClose} 
            aria-label="Close notification"
        >
            <Icon name="x" class="icon-sm" />
        </button>
    </div>
{/if}

<style type="less">
    .toast {
        position: fixed;
        top: var(--spacing-4);
        right: var(--spacing-4);
        z-index: 50;
        min-width: 20rem;
        max-width: 24rem;
        padding: var(--spacing-4);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-xl);
        border: 1px solid;
        background: white;
        display: flex;
        align-items: flex-start;
        gap: var(--spacing-3);
        animation: slide-in 0.3s ease-out;
        transition: all var(--transition-fast);

        &--success {
            border-color: var(--color-success);
            
            .toast__icon {
                color: var(--color-success);
            }
        }

        &--error {
            border-color: var(--color-danger);
            
            .toast__icon {
                color: var(--color-danger);
            }
        }

        &--warning {
            border-color: var(--color-warning);
            
            .toast__icon {
                color: var(--color-warning);
            }
        }

        &--info {
            border-color: var(--color-info);
            
            .toast__icon {
                color: var(--color-info);
            }
        }
    }

    .toast__content {
        flex: 1;
        display: flex;
        align-items: flex-start;
        gap: var(--spacing-3);
    }

    .toast__icon {
        flex-shrink: 0;
        margin-top: 0.125rem;
    }

    .toast__message {
        flex: 1;
        font-size: 0.875rem;
        line-height: 1.5;
        color: var(--color-text-primary);
    }

    .toast__actions {
        display: flex;
        gap: var(--spacing-2);
        margin-top: var(--spacing-2);
        flex-wrap: wrap;
    }

    .toast__action {
        padding: var(--spacing-1) var(--spacing-3);
        font-size: 0.75rem;
        font-weight: 500;
        border: 1px solid;
        border-radius: var(--radius-md);
        cursor: pointer;
        transition: all var(--transition-fast);
        white-space: nowrap;

        &--primary {
            background: var(--color-primary);
            border-color: var(--color-primary);
            color: white;

            &:hover {
                background: var(--color-primary-hover);
                border-color: var(--color-primary-hover);
            }
        }

        &--secondary {
            background: white;
            border-color: var(--color-border);
            color: var(--color-text-primary);

            &:hover {
                background: var(--surface-elevated);
                border-color: var(--color-border-hover);
            }
        }
    }

    .toast__close {
        flex-shrink: 0;
        padding: var(--spacing-1);
        background: none;
        border: none;
        color: var(--color-text-muted);
        cursor: pointer;
        border-radius: var(--radius-md);
        transition: all var(--transition-fast);

        &:hover {
            color: var(--color-text-secondary);
            background: var(--surface-primary);
        }
    }

    @keyframes slide-in {
        from {
            opacity: 0;
            transform: translateX(100%);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
</style>