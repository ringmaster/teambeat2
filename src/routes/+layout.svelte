<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.less';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	
	let user: any = $state(null);
	let loading = $state(true);
	let mobileMenuOpen = $state(false);
	let { children } = $props();
	
	onMount(async () => {
		try {
			const response = await fetch('/api/auth/me');
			if (response.ok) {
				const data = await response.json();
				user = data.user;
			}
		} catch (error) {
			console.error('Failed to check authentication:', error);
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>TeamBeat - Collaborative Retrospectives</title>
</svelte:head>

<div class="full-screen gradient-bg">
	<!-- Navigation -->
	<nav class="glass-effect sticky-header">
		<div class="page-container">
			<div class="header-layout">
				<div class="button-group">
					<a href="/" class="interactive">
						<div class="brand-gradient" style="width: 2.5rem; height: 2.5rem; border-radius: var(--radius-xl); display: flex; align-items: center; justify-content: center;">
							<svg class="icon-md text-inverted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
							</svg>
						</div>
						<span class="heading-sm gradient-text">TeamBeat</span>
					</a>
				</div>
				
				<!-- Desktop Navigation -->
				<div class="desktop-nav toolbar">
					{#if loading}
						<div class="button-group">
							<div class="icon-sm brand-surface-indigo loading-spinner"></div>
							<div class="icon-sm brand-surface-purple pulse-indicator staggered-animation-1"></div>
							<div class="icon-sm brand-surface-pink bounce-indicator staggered-animation-2"></div>
						</div>
					{:else if user}
						<div class="toolbar">
							<a href="/" class="text-interactive text-muted text-medium">Dashboard</a>
							<div class="toolbar">
								<div class="button-group overlay-medium">
									<Avatar name={user.name} email={user.email} />
									<span class="text-secondary text-medium">{user.name || user.email}</span>
								</div>
								<button 
									class="btn-secondary"
									onclick={async () => {
										await fetch('/api/auth/logout', { method: 'POST' });
										window.location.reload();
									}}
								>
									Sign Out
								</button>
							</div>
						</div>
					{:else}
						<a href="/login" class="btn-secondary">Sign In</a>
						<a href="/register" class="btn-primary">Register</a>
					{/if}
				</div>
				
				<!-- Mobile menu button -->
				<div class="mobile-nav">
					<button 
						onclick={() => mobileMenuOpen = !mobileMenuOpen}
						class="text-interactive text-muted"
						style="padding: var(--spacing-2); background: none; border: none; cursor: pointer;"
					>
						<svg class="icon-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							{#if mobileMenuOpen}
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
							{:else}
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
							{/if}
						</svg>
					</button>
				</div>
			</div>
		</div>
		
		<!-- Mobile menu -->
		{#if mobileMenuOpen}
			<div class="mobile-nav slide-in-animation">
				<div class="form-group responsive-container">
					{#if loading}
						<div class="text-centered">Loading...</div>
					{:else if user}
						<div class="button-group surface-muted">
							<Avatar name={user.name} email={user.email} />
							<span class="text-secondary text-medium">{user.name || user.email}</span>
						</div>
						<a href="/" class="text-interactive text-muted text-medium">Dashboard</a>
						<button 
							class="full-width status-text-danger text-medium"
							onclick={async () => {
								await fetch('/api/auth/logout', { method: 'POST' });
								window.location.reload();
							}}
						>
							Sign Out
						</button>
					{:else}
						<a href="/login" class="btn-secondary full-width">Sign In</a>
						<a href="/register" class="btn-primary full-width">Register</a>
					{/if}
				</div>
			</div>
		{/if}
	</nav>
	
	<main class="content-layout">
		{@render children?.()}
	</main>
	
	<!-- Footer -->
	<footer class="overlay-light glass-blur section-divider">
		<div class="page-container">
			<div class="mobile-stack">
				<div class="button-group">
					<div class="brand-gradient" style="width: 2rem; height: 2rem; border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center;">
						<svg class="icon-sm text-inverted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
						</svg>
					</div>
					<span class="text-muted body-sm">© 2024 TeamBeat. Built for better retrospectives.</span>
				</div>
				<div class="toolbar body-sm">
					<button class="text-interactive text-subtle">Privacy</button>
					<button class="text-interactive text-subtle">Terms</button>
					<button class="text-interactive text-subtle">Support</button>
				</div>
			</div>
		</div>
	</footer>
</div>

