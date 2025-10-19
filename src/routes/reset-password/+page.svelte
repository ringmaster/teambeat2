<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { toastStore } from '$lib/stores/toast';

	let token = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let isResetting = $state(false);
	let isSuccess = $state(false);

	// Get token from URL on mount
	$effect(() => {
		token = $page.url.searchParams.get('token') || '';
	});

	async function handleSubmit(event: Event) {
		event.preventDefault();

		// Validation
		if (!token) {
			toastStore.error('Invalid or missing reset token');
			return;
		}

		if (newPassword.length < 8) {
			toastStore.error('Password must be at least 8 characters');
			return;
		}

		if (newPassword !== confirmPassword) {
			toastStore.error('Passwords do not match');
			return;
		}

		isResetting = true;

		try {
			const response = await fetch('/api/auth/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token, newPassword })
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to reset password');
			}

			isSuccess = true;
			toastStore.success('Password reset successfully');

			// Redirect to login after 2 seconds
			setTimeout(() => {
				goto('/login');
			}, 2000);
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to reset password');
			console.error(err);
		} finally {
			isResetting = false;
		}
	}
</script>

<div class="reset-password-page">
	<div class="reset-password-container">
		<div class="reset-password-card">
			<h1>Reset Password</h1>

			{#if !token}
				<div class="error-state">
					<p>Invalid or missing reset token.</p>
					<a href="/login" class="back-link">Return to login</a>
				</div>
			{:else if isSuccess}
				<div class="success-state">
					<p>Your password has been reset successfully!</p>
					<p class="redirect-message">Redirecting to login...</p>
				</div>
			{:else}
				<form class="reset-form" onsubmit={handleSubmit}>
					<p class="form-description">
						Enter your new password below. It must be at least 8 characters long.
					</p>

					<div class="form-group">
						<label for="newPassword">New Password</label>
						<input
							id="newPassword"
							type="password"
							bind:value={newPassword}
							placeholder="Enter new password"
							required
							minlength="8"
							class="form-input"
							disabled={isResetting}
						/>
					</div>

					<div class="form-group">
						<label for="confirmPassword">Confirm Password</label>
						<input
							id="confirmPassword"
							type="password"
							bind:value={confirmPassword}
							placeholder="Confirm new password"
							required
							minlength="8"
							class="form-input"
							disabled={isResetting}
						/>
					</div>

					<button type="submit" class="submit-button" disabled={isResetting}>
						{isResetting ? 'Resetting...' : 'Reset Password'}
					</button>

					<a href="/login" class="back-link">Return to login</a>
				</form>
			{/if}
		</div>
	</div>
</div>

<style lang="less">
	.reset-password-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-bg-muted);
		padding: 1rem;
	}

	.reset-password-container {
		width: 100%;
		max-width: 450px;
	}

	.reset-password-card {
		background: var(--color-bg-primary);
		border: 1px solid var(--input-border);
		border-radius: 12px;
		padding: 2.5rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);

		h1 {
			margin: 0 0 1.5rem 0;
			font-size: 1.75rem;
			color: var(--color-text-primary);
			text-align: center;
		}
	}

	.error-state,
	.success-state {
		text-align: center;

		p {
			margin: 0 0 1rem 0;
			color: var(--color-text-primary);
			font-size: 1rem;
			line-height: 1.5;
		}

		.redirect-message {
			color: var(--color-text-secondary);
			font-size: 0.9rem;
		}

		.back-link {
			display: inline-block;
			margin-top: 1rem;
			color: var(--color-primary);
			text-decoration: none;
			font-weight: 500;

			&:hover {
				text-decoration: underline;
			}
		}
	}

	.success-state {
		p:first-child {
			color: var(--color-success);
			font-weight: 600;
		}
	}

	.error-state {
		p:first-child {
			color: var(--color-danger);
			font-weight: 600;
		}
	}

	.reset-form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;

		.form-description {
			margin: 0;
			color: var(--color-text-secondary);
			font-size: 0.95rem;
			line-height: 1.5;
			text-align: center;
		}

		.form-group {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;

			label {
				font-weight: 500;
				font-size: 0.95rem;
				color: var(--color-text-primary);
			}

			.form-input {
				padding: 0.75rem 1rem;
				border: 1px solid var(--input-border);
				border-radius: 8px;
				font-size: 1rem;
				background: var(--color-bg-primary);
				color: var(--color-text-primary);
				transition: border-color 0.2s ease, box-shadow 0.2s ease;

				&:focus {
					outline: none;
					border-color: var(--input-border-focus);
					box-shadow: 0 0 0 3px var(--interactive-focus-ring);
				}

				&::placeholder {
					color: var(--input-placeholder);
				}

				&:disabled {
					background: var(--input-background-disabled);
					cursor: not-allowed;
					opacity: 0.6;
				}
			}
		}

		.submit-button {
			padding: 0.85rem 1.5rem;
			background: var(--color-primary);
			color: var(--color-text-inverse);
			border: none;
			border-radius: 8px;
			font-size: 1rem;
			font-weight: 600;
			cursor: pointer;
			transition: all 0.2s ease;
			margin-top: 0.5rem;
			min-height: 48px;

			&:hover:not(:disabled) {
				background: var(--color-primary-hover);
			}

			&:active:not(:disabled) {
				background: var(--color-primary-active);
			}

			&:disabled {
				opacity: 0.6;
				cursor: not-allowed;
			}
		}

		.back-link {
			text-align: center;
			color: var(--color-primary);
			text-decoration: none;
			font-size: 0.95rem;
			font-weight: 500;

			&:hover {
				text-decoration: underline;
			}
		}
	}

	@media (max-width: 480px) {
		.reset-password-card {
			padding: 2rem 1.5rem;

			h1 {
				font-size: 1.5rem;
			}
		}
	}
</style>
