<script lang="ts">
    interface Props {
        preset?: 'admin' | 'member' | 'facilitator' | 'draft' | 'active' | 'complete' | 'archived';
        variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';
        size?: 'sm' | 'md' | 'lg';
        class?: string;
        children?: any;
    }
    
    let {
        preset,
        variant,
        size = 'sm',
        class: className = '',
        children
    }: Props = $props();
    
    // Map presets to variants
    const presetVariants = {
        admin: 'danger',
        member: 'info',
        facilitator: 'success',
        draft: 'muted',
        active: 'primary',
        complete: 'success',
        archived: 'warning'
    };
    
    let pillVariant = $derived(preset ? presetVariants[preset] : (variant || 'muted'));
    
    let pillClass = $derived.by(() => {
        let classes = ['pill', `pill-${pillVariant}`, `pill-${size}`];
        
        if (className) {
            classes.push(className);
        }
        
        return classes.join(' ');
    });
</script>

<span class={pillClass}>
    {@render children?.()}
</span>