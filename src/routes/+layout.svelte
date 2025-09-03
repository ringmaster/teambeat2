<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
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

<div class="min-h-screen gradient-bg flex flex-col">
	<!-- Navigation -->
	<nav class="glass-effect sticky top-0 z-50 border-b border-white/10">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between h-16">
				<div class="flex items-center">
					<a href="/" class="flex items-center space-x-2 group">
						<div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
							<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
							</svg>
						</div>
						<span class="text-xl font-bold gradient-text">TeamBeat</span>
					</a>
				</div>
				
				<!-- Desktop Navigation -->
				<div class="hidden md:flex items-center space-x-4">
					{#if loading}
						<div class="flex items-center space-x-2">
							<div class="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
							<div class="w-2 h-2 bg-purple-500 rounded-full animate-bounce animation-delay-200"></div>
							<div class="w-2 h-2 bg-pink-500 rounded-full animate-bounce animation-delay-400"></div>
						</div>
					{:else if user}
						<div class="flex items-center space-x-4">
							<a href="/" class="text-gray-600 hover:text-gray-900 font-medium transition-colors">Dashboard</a>
							<div class="flex items-center space-x-3">
								<div class="flex items-center space-x-2 bg-white/50 px-3 py-2 rounded-lg">
									<Avatar name={user.name} email={user.email} />
									<span class="text-gray-700 font-medium">{user.name || user.email}</span>
								</div>
								<button 
									class="bg-white/50 hover:bg-white text-gray-700 px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:shadow-md"
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
						<a href="/login" class="bg-white/50 hover:bg-white text-gray-700 px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:shadow-md">Sign In</a>
						<a href="/register" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:shadow-md">Register</a>
					{/if}
				</div>
				
				<!-- Mobile menu button -->
				<div class="md:hidden flex items-center">
					<button 
						onclick={() => mobileMenuOpen = !mobileMenuOpen}
						class="text-gray-600 hover:text-gray-900 p-2"
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
			<div class="md:hidden border-t border-gray-100 bg-white/95 backdrop-blur-sm animate-slide-up">
				<div class="px-4 py-4 space-y-3">
					{#if loading}
						<div class="text-center py-2">Loading...</div>
					{:else if user}
						<div class="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-lg">
							<Avatar name={user.name} email={user.email} />
							<span class="text-gray-700 font-medium">{user.name || user.email}</span>
						</div>
						<a href="/" class="block text-gray-600 hover:text-gray-900 font-medium py-2">Dashboard</a>
						<button 
							class="w-full text-left text-red-600 hover:text-red-700 font-medium py-2"
							onclick={async () => {
								await fetch('/api/auth/logout', { method: 'POST' });
								window.location.reload();
							}}
						>
							Sign Out
						</button>
					{:else}
						<a href="/login" class="block w-full text-center bg-white/50 hover:bg-white text-gray-700 px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:shadow-md mb-2">Sign In</a>
						<a href="/register" class="block w-full text-center bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:shadow-md">Register</a>
					{/if}
				</div>
			</div>
		{/if}
	</nav>
	
	<main class="flex-grow flex flex-col h-full">
		{@render children?.()}
	</main>
	
	<!-- Footer -->
	<footer class="mt-auto border-t border-gray-200/50 bg-white/30 backdrop-blur-sm">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<div class="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
				<div class="flex items-center space-x-2">
					<div class="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
						<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
						</svg>
					</div>
					<span class="text-gray-600 text-sm">© 2024 TeamBeat. Built for better retrospectives.</span>
				</div>
				<div class="flex space-x-6 text-sm text-gray-500">
					<button class="hover:text-gray-700 transition-colors">Privacy</button>
					<button class="hover:text-gray-700 transition-colors">Terms</button>
					<button class="hover:text-gray-700 transition-colors">Support</button>
				</div>
			</div>
		</div>
	</footer>
</div>
