<script lang="ts">
	import { goto } from '$app/navigation';
	import Input from '$lib/components/ui/Input.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	
	let email: string = $state('');
	let password: string = $state('');
	let error: string = $state('');
	let loading: boolean = $state(false);
	
	async function handleLogin() {
		if (!email || !password) {
			error = 'Please fill in all fields';
			return;
		}
		
		loading = true;
		error = '';
		
		try {
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});
			
			const data = await response.json();
			
			if (response.ok) {
				// Force a full page reload to update the authentication state
				window.location.href = '/';
			} else {
				error = data.error || 'Login failed';
			}
		} catch (err) {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="min-h-screen gradient-bg flex items-center justify-center px-4 sm:px-6 lg:px-8">
	<div class="max-w-md w-full space-y-8">
		<!-- Header -->
		<div class="text-center">
			<div class="mx-auto h-16 w-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl mb-4">
				<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
				</svg>
			</div>
			<h2 class="text-3xl font-bold gradient-text">Welcome back</h2>
			<p class="mt-2 text-gray-600">Sign in to your TeamBeat account</p>
		</div>

		<!-- Form Card -->
		<div class="glass-effect rounded-2xl p-8 shadow-xl animate-slide-up">
			{#if error}
				<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center space-x-2">
					<svg class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
					</svg>
					<span>{error}</span>
				</div>
			{/if}

			<form class="space-y-6" onsubmit={(e) => { e.preventDefault(); handleLogin(); }}>
				<div>
					<label for="email" class="block text-sm font-semibold text-gray-700 mb-2">
						Email
					</label>
					<Input
						id="email"
						type="email"
						bind:value={email}
						required
						placeholder="Enter your email"
						class="auth-input"
					/>
				</div>

				<div>
					<label for="password" class="block text-sm font-semibold text-gray-700 mb-2">
						Password
					</label>
					<Input
						id="password"
						type="password"
						bind:value={password}
						required
						placeholder="Enter your password"
						class="auth-input"
					/>
				</div>

				<Button
					type="submit"
					disabled={loading}
					class="w-full"
					variant="primary"
				>
					{#if loading}
						<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						<span>Signing in...</span>
					{:else}
						<span>Sign In</span>
					{/if}
				</Button>
			</form>
		</div>

		<!-- Footer -->
		<div class="text-center">
			<p class="text-gray-600">
				Don't have an account?
				<a href="/register" class="font-semibold gradient-text hover:from-indigo-600 hover:to-purple-700 transition-colors ml-1">Sign up</a>
			</p>
		</div>
	</div>
</div>