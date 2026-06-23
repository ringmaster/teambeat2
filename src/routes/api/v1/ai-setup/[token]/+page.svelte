<script lang="ts">
import type { PageData } from "./$types";
const { data }: { data: PageData } = $props();

const accessUrl = `${data.baseUrl.replace("/api/v1", "")}/api/v1/ai-setup/${data.token}`;

let copied = $state(false);

async function copyUrl() {
	try {
		await navigator.clipboard.writeText(accessUrl);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	} catch {}
}
</script>

<svelte:head>
	<title>Teambeat API Access URL</title>
</svelte:head>

<div class="setup-page">
	<div class="setup-card">
		<h1>Your API Access URL</h1>
		<p class="subtitle">Authenticated as <strong>{data.user.email}</strong></p>

		<div class="url-box">
			<code class="url-text">{accessUrl}</code>
			<button class="copy-btn" onclick={copyUrl}>
				{copied ? "Copied!" : "Copy URL"}
			</button>
		</div>

		<section>
			<h2>What is this?</h2>
			<p>This URL gives an AI agent everything it needs to connect to Teambeat on your behalf — your authentication token, your series list, and instructions on how to use the API. Treat it like a password.</p>
		</section>

		<section>
			<h2>How to use it with Claude Code</h2>
			<p>Paste a prompt like this into Claude Code:</p>
			<div class="example-prompt">
				<p>Use this Teambeat API access URL <span class="url-inline">{accessUrl}</span> to [describe what you want Claude to do].</p>
			</div>
			<p class="example-note">Examples of what to ask:</p>
			<ul>
				<li>"…to show data from Jira about our current sprint and add blockers to the Issues List column."</li>
				<li>"…to push today's deployment metrics to the active board's data scene."</li>
				<li>"…to summarize the agreements from our last three retrospectives."</li>
			</ul>
		</section>

		<section>
			<h2>What Claude Code will do</h2>
			<p>When Claude Code fetches that URL it receives:</p>
			<ul>
				<li>Your authentication token (used automatically for all API calls)</li>
				<li>Your series and their IDs</li>
				<li>A full list of available endpoints and how to use them</li>
				<li>Instructions for how to find the active board and push or read data</li>
			</ul>
			<p>No further setup is required.</p>
		</section>

		<section class="warning">
			<h2>Keep this URL private</h2>
			<p>Anyone with this URL can read and modify your Teambeat boards. If you share it accidentally, revoke it from your <a href="/profile">profile page</a> and create a new one.</p>
		</section>

		<div class="links">
			<a href="/profile">Manage API access URLs</a>
			<a href="/docs/claude-code">Full documentation</a>
		</div>
	</div>
</div>

<style>
.setup-page {
	min-height: 100vh;
	background: var(--color-bg-primary, #f9fafb);
	display: flex;
	align-items: flex-start;
	justify-content: center;
	padding: 3rem 1rem;
}

.setup-card {
	background: white;
	border: 1px solid var(--surface-tertiary, #e5e7eb);
	border-radius: 12px;
	padding: 2rem 2.25rem;
	width: 100%;
	max-width: 640px;
	box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

h1 {
	font-size: 1.4rem;
	margin: 0 0 0.2rem;
}

.subtitle {
	color: var(--text-secondary, #6b7280);
	margin: 0 0 1.5rem;
	font-size: 0.9rem;
}

.url-box {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	background: var(--surface-secondary, #f3f4f6);
	border: 1px solid var(--surface-tertiary, #e5e7eb);
	border-radius: 8px;
	padding: 0.75rem 1rem;
	margin-bottom: 2rem;
}

.url-text {
	flex: 1;
	font-size: 0.78rem;
	word-break: break-all;
	background: none;
	color: var(--text-primary, #111);
}

.copy-btn {
	flex-shrink: 0;
	padding: 0.35rem 0.8rem;
	font-size: 0.85rem;
	border: 1px solid var(--surface-tertiary, #ccc);
	border-radius: 6px;
	background: white;
	cursor: pointer;
	font-weight: 500;

	&:hover {
		background: var(--surface-secondary, #f3f4f6);
	}
}

section {
	margin-bottom: 1.75rem;
}

h2 {
	font-size: 0.95rem;
	font-weight: 600;
	margin: 0 0 0.5rem;
	color: var(--text-primary, #111);
}

p {
	font-size: 0.9rem;
	color: var(--text-secondary, #374151);
	margin: 0 0 0.6rem;
	line-height: 1.5;
}

ul {
	margin: 0.25rem 0 0 1.25rem;
	padding: 0;
}

li {
	font-size: 0.875rem;
	color: var(--text-secondary, #374151);
	margin-bottom: 0.3rem;
	line-height: 1.4;
}

.example-prompt {
	background: var(--surface-secondary, #f3f4f6);
	border-left: 3px solid var(--color-primary, #6366f1);
	border-radius: 0 6px 6px 0;
	padding: 0.75rem 1rem;
	margin-bottom: 0.75rem;
}

.example-prompt p {
	margin: 0;
	font-size: 0.875rem;
	font-style: italic;
}

.url-inline {
	color: var(--color-primary, #6366f1);
	word-break: break-all;
	font-family: monospace;
	font-style: normal;
	font-size: 0.78rem;
}

.example-note {
	font-size: 0.85rem;
	font-weight: 500;
	color: var(--text-primary, #111);
	margin-bottom: 0.25rem !important;
}

.warning {
	background: var(--color-warning-bg, #fffbeb);
	border: 1px solid var(--color-warning, #f59e0b);
	border-radius: 8px;
	padding: 1rem 1.25rem;
	margin-bottom: 1.75rem;
}

.warning h2 {
	color: var(--color-warning-text, #92400e);
}

.warning p {
	color: var(--color-warning-text, #92400e);
	margin: 0;
}

.links {
	padding-top: 1.25rem;
	border-top: 1px solid var(--surface-tertiary, #e5e7eb);
	display: flex;
	gap: 1.5rem;
	flex-wrap: wrap;
	font-size: 0.85rem;
}
</style>
