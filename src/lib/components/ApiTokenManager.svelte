<script lang="ts">
import { onMount } from "svelte";

interface TokenInfo {
	id: string;
	label: string;
	expiresAt: number;
	lastUsedAt: number | null;
	createdAt: number;
}

let tokens: TokenInfo[] = $state([]);
let loading = $state(true);
let newLabel = $state("");
let creating = $state(false);
let newToken = $state<string | null>(null);
let error = $state("");
let copied = $state(false);

onMount(loadTokens);

async function loadTokens() {
	loading = true;
	try {
		const res = await fetch("/api/v1/tokens");
		if (res.ok) {
			const data = await res.json();
			tokens = data.tokens ?? [];
		}
	} catch {
		error = "Failed to load tokens";
	} finally {
		loading = false;
	}
}

async function createToken() {
	if (!newLabel.trim()) return;
	creating = true;
	error = "";
	newToken = null;

	try {
		const res = await fetch("/api/v1/tokens", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ label: newLabel.trim() }),
		});
		const data = await res.json();

		if (res.ok && data.success) {
			newToken = data.token;
			tokens = [data.tokenInfo, ...tokens];
			newLabel = "";
		} else {
			error = data.error ?? "Failed to create token";
		}
	} catch {
		error = "Failed to create token";
	} finally {
		creating = false;
	}
}

async function revokeToken(id: string) {
	try {
		const res = await fetch(`/api/v1/tokens/${id}`, { method: "DELETE" });
		if (res.ok) {
			tokens = tokens.filter((t) => t.id !== id);
			if (newToken) newToken = null;
		} else {
			const data = await res.json();
			error = data.error ?? "Failed to revoke token";
		}
	} catch {
		error = "Failed to revoke token";
	}
}

async function copyToken() {
	if (!newToken) return;
	try {
		await navigator.clipboard.writeText(newToken);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	} catch {
		// clipboard not available
	}
}

function formatDate(ms: number) {
	return new Date(ms).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function isExpiringSoon(expiresAt: number) {
	const days = (expiresAt - Date.now()) / (1000 * 60 * 60 * 24);
	return days < 14;
}
</script>

<div class="token-manager">
	<h3>API Tokens</h3>
	<p class="description">
		Tokens let AI and automation clients access your boards. Each token lasts 90 days. The raw
		token is shown only once — store it securely.
	</p>

	{#if error}
		<p class="error">{error}</p>
	{/if}

	{#if newToken}
		<div class="new-token-banner">
			<p><strong>New token created.</strong> Copy it now — it won't be shown again.</p>
			<div class="token-display">
				<code>{newToken}</code>
				<button class="btn-copy" onclick={copyToken}>
					{copied ? "Copied!" : "Copy"}
				</button>
			</div>
			<button class="btn-dismiss" onclick={() => (newToken = null)}>Dismiss</button>
		</div>
	{/if}

	<form class="create-form" onsubmit={(e) => { e.preventDefault(); createToken(); }}>
		<input
			type="text"
			placeholder="Token label (e.g. My AI agent)"
			bind:value={newLabel}
			maxlength="100"
			disabled={creating}
		/>
		<button type="submit" disabled={creating || !newLabel.trim()}>
			{creating ? "Creating…" : "Create token"}
		</button>
	</form>

	{#if loading}
		<p class="loading">Loading tokens…</p>
	{:else if tokens.length === 0}
		<p class="empty">No active tokens. Create one above.</p>
	{:else}
		<ul class="token-list">
			{#each tokens as token (token.id)}
				<li class="token-item" class:expiring={isExpiringSoon(token.expiresAt)}>
					<div class="token-info">
						<span class="token-label">{token.label}</span>
						<span class="token-meta">
							Created {formatDate(token.createdAt)} · Expires {formatDate(token.expiresAt)}
							{#if token.lastUsedAt}
								· Last used {formatDate(token.lastUsedAt)}
							{/if}
						</span>
						{#if isExpiringSoon(token.expiresAt)}
							<span class="expiry-warning">Expiring soon</span>
						{/if}
					</div>
					<button
						class="btn-revoke"
						onclick={() => revokeToken(token.id)}
					>
						Revoke
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	<p class="docs-link">
		<a href="/api/v1/openapi.json" target="_blank" rel="noopener noreferrer">
			View API documentation (OpenAPI)
		</a>
	</p>
</div>

<style>
.token-manager {
	margin-top: 2rem;
}

h3 {
	margin-bottom: 0.25rem;
}

.description {
	color: var(--color-text-secondary, #666);
	font-size: 0.9rem;
	margin-bottom: 1rem;
}

.error {
	color: var(--color-danger, #c0392b);
	margin-bottom: 0.75rem;
}

.new-token-banner {
	background: var(--color-success-bg, #eafaf1);
	border: 1px solid var(--color-success, #27ae60);
	border-radius: 6px;
	padding: 1rem;
	margin-bottom: 1rem;
}

.token-display {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	margin: 0.5rem 0;
}

.token-display code {
	font-size: 0.85rem;
	background: var(--color-code-bg, #f0f0f0);
	padding: 0.25rem 0.5rem;
	border-radius: 4px;
	word-break: break-all;
	flex: 1;
}

.btn-copy {
	padding: 0.25rem 0.75rem;
	font-size: 0.85rem;
	cursor: pointer;
	white-space: nowrap;
}

.btn-dismiss {
	font-size: 0.8rem;
	background: none;
	border: none;
	cursor: pointer;
	text-decoration: underline;
	color: var(--color-text-secondary, #666);
}

.create-form {
	display: flex;
	gap: 0.5rem;
	margin-bottom: 1.5rem;
}

.create-form input {
	flex: 1;
	padding: 0.5rem 0.75rem;
	border: 1px solid var(--color-border, #ccc);
	border-radius: 4px;
	font-size: 0.95rem;
}

.create-form button {
	padding: 0.5rem 1rem;
	cursor: pointer;
	white-space: nowrap;
}

.loading,
.empty {
	color: var(--color-text-secondary, #666);
	font-size: 0.9rem;
}

.token-list {
	list-style: none;
	padding: 0;
	margin: 0;
}

.token-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.75rem 0;
	border-bottom: 1px solid var(--color-border, #eee);
	gap: 1rem;
}

.token-item.expiring .token-label {
	color: var(--color-warning, #e67e22);
}

.token-info {
	display: flex;
	flex-direction: column;
	gap: 0.15rem;
}

.token-label {
	font-weight: 500;
}

.token-meta {
	font-size: 0.8rem;
	color: var(--color-text-secondary, #888);
}

.expiry-warning {
	font-size: 0.75rem;
	color: var(--color-warning, #e67e22);
	font-weight: 500;
}

.btn-revoke {
	padding: 0.3rem 0.75rem;
	font-size: 0.85rem;
	color: var(--color-danger, #c0392b);
	border: 1px solid currentColor;
	background: none;
	border-radius: 4px;
	cursor: pointer;
	white-space: nowrap;
}

.btn-revoke:hover {
	background: var(--color-danger, #c0392b);
	color: white;
}

.docs-link {
	margin-top: 1rem;
	font-size: 0.85rem;
}
</style>
