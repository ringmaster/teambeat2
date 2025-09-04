<script lang="ts">
	import { goto } from '$app/navigation';
	import Input from '$lib/components/ui/Input.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	
	let email: string = $state('');
	let name: string = $state('');
	let password: string = $state('');
	let confirmPassword: string = $state('');
	let error: string = $state('');
	let loading: boolean = $state(false);
	
	async function handleRegister() {
		if (!email || !password) {
			error = 'Email and password are required';
			return;
		}
		
		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}
		
		if (password.length < 6) {
			error = 'Password must be at least 6 characters';
			return;
		}
		
		loading = true;
		error = '';
		
		try {
			const response = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					email, 
					name: name || undefined, 
					password 
				})
			});
			
			const data = await response.json();
			
			if (response.ok) {
				// Force a full page reload to update the authentication state
				window.location.href = '/';
			} else {
				error = data.error || 'Registration failed';
			}
		} catch (err) {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="register-page">
	<div class="register-container">
		<!-- Header -->
		<div class="register-header">
			<div class="register-brand-icon">
				<svg class="icon-md text-inverted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
				</svg>
			</div>
			<h2 class="register-title gradient-text">Get started</h2>
			<p class="register-subtitle">Create your TeamBeat account</p>
		</div>

		<!-- Form Card -->
		<div class="form-card">
			{#if error}
				<div class="form-error">
					<svg class="icon-sm status-text-danger" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
					</svg>
					<span>{error}</span>
				</div>
			{/if}

			<form class="form-group" onsubmit={(e) => { e.preventDefault(); handleRegister(); }}>
				<div>
					<label for="email" class="form-label">
						Email <span class="text-red-500">*</span>
					</label>
					<Input
						id="email"
						type="email"
						bind:value={email}
						required
						placeholder="your@email.com"
						class="auth-input"
					/>
				</div>

				<div>
					<label for="name" class="form-label">
						Full Name
					</label>
					<Input
						id="name"
						type="text"
						bind:value={name}
						placeholder="Your full name"
						class="auth-input"
					/>
				</div>

				<div>
					<label for="password" class="form-label">
						Password <span class="text-red-500">*</span>
					</label>
					<Input
						id="password"
						type="password"
						bind:value={password}
						required
						placeholder="Create a password (6+ characters)"
						class="auth-input"
					/>
				</div>

				<div>
					<label for="confirmPassword" class="form-label">
						Confirm Password <span class="text-red-500">*</span>
					</label>
					<Input
						id="confirmPassword"
						type="password"
						bind:value={confirmPassword}
						required
						placeholder="Confirm your password"
						class="auth-input"
					/>
				</div>

				<Button
					type="submit"
					disabled={loading}
					class="register-submit-button"
					variant="primary"
				>
					{#if loading}
						<svg class="loading-spinner icon-sm text-inverted" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="pulse-indicator" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						<span>Creating account...</span>
					{:else}
						<span>Create Account</span>
					{/if}
				</Button>
			</form>
		</div>

		<!-- Footer -->
		<div class="register-footer">
			<p class="text-muted">
				Already have an account?
				<a href="/login" class="register-signin-link">Sign in</a>
			</p>
		</div>
	</div>
</div>

<style>
	.register-page {
		min-height: 100vh;
		background: rgb(var(--color-bg-primary));
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 var(--spacing-4);
	}

	@media (min-width: 640px) {
		.register-page {
			padding: 0 var(--spacing-6);
		}
	}

	@media (min-width: 1024px) {
		.register-page {
			padding: 0 var(--spacing-8);
		}
	}

	.register-container {
		width: 100%;
		max-width: 28rem;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-8);
	}

	.register-header {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-4);
	}

	.register-brand-icon {
		width: 4rem;
		height: 4rem;
		background: linear-gradient(
			to bottom right,
			rgb(var(--color-indigo-500)),
			rgb(var(--color-purple-600))
		);
		color: white;
		border-radius: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: var(--shadow-xl);
	}

	.register-title {
		font-size: 1.875rem;
		line-height: 2.25rem;
		font-weight: 700;
		margin: 0;
	}

	.register-subtitle {
		color: rgb(var(--color-gray-600));
		font-size: 1rem;
		margin: 0;
	}


	.register-submit-button {
		width: 100%;
		margin-top: var(--spacing-6);
	}

	.register-footer {
		text-align: center;
	}

	.register-signin-link {
		font-weight: 600;
		background: linear-gradient(to right, rgb(var(--color-primary)), rgb(var(--color-secondary)));
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		text-decoration: none;
		margin-left: var(--spacing-1);
		transition: all var(--transition-fast);
	}

	.register-signin-link:hover {
		background: linear-gradient(to right, rgb(var(--color-indigo-600)), rgb(var(--color-purple-700)));
		-webkit-background-clip: text;
		background-clip: text;
	}
</style>