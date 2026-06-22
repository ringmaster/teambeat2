<script lang="ts">
import type { PageData } from "./$types";

const { data }: { data: PageData } = $props();
const baseUrl = data.baseUrl;

let copiedKey = $state<string | null>(null);

async function copy(text: string, key: string) {
	try {
		await navigator.clipboard.writeText(text);
		copiedKey = key;
		setTimeout(() => (copiedKey = null), 2000);
	} catch {
		// clipboard unavailable
	}
}

const envBlock = `export TEAMBEAT_API_TOKEN="tb_your_token_here"
export TEAMBEAT_BASE_URL="${baseUrl}"`;

const claudeMdBlock = `## Teambeat Integration

Base URL: ${baseUrl}
Auth: \`Authorization: Bearer $TEAMBEAT_API_TOKEN\` on all /api/v1/ requests

### Session Startup

When a session begins where Teambeat work is likely, or when the user mentions
retrospectives, boards, health checks, or scorecards:

1. GET /api/v1/series — list available series (team workspaces)
2. For each series, GET /api/v1/series/{id}/boards?limit=5 — fetch recent boards
3. Present a compact summary: series name, most recent board name and date
4. Ask: "Which series and board would you like to work with?"
5. Remember the chosen series ID and board ID for the rest of the session

Skip the discovery step if the user has already named a specific series or board,
or if you already know the IDs from earlier in the session.

### Key Endpoints

Series (your team workspaces):
  GET /api/v1/series                          list series you belong to
  GET /api/v1/series/{id}/boards              recent boards (limit/offset)
  GET /api/v1/series/{id}/health-summary      longitudinal health trends
  GET /api/v1/series/{id}/agreements          cross-board agreement history

Boards (individual retrospective meetings):
  GET /api/v1/boards/{id}                     full board with scenes/columns/cards
  GET /api/v1/boards/{id}/cards               cards with column context
  GET /api/v1/boards/{id}/agreements          agreements (?completed=true|false)
  GET /api/v1/boards/{id}/scorecard-results   current scorecard data
  POST /api/v1/series/{id}/boards             create a board

Scorecard injection (push AI findings directly to the board):
  POST /api/v1/datasources/{id}/inject

### Inject Payload Shape
{
  "data": [
    {
      "section": "Category Name",
      "title": "Finding title",
      "primaryValue": "5 issues",
      "secondaryValues": { "Files affected": "12", "High risk": "2" },
      "severity": "info | warning | critical"
    }
  ]
}
Max 500 items per call. severity defaults to "info" if omitted.`;

const injectExample = `curl -X POST ${baseUrl}/api/v1/datasources/DATASOURCE_ID/inject \\
  -H "Authorization: Bearer $TEAMBEAT_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "data": [
      {
        "section": "Technical Debt",
        "title": "TODO/FIXME comments",
        "primaryValue": "47 items",
        "secondaryValues": { "Critical": "3", "Files": "18" },
        "severity": "warning"
      }
    ]
  }'`;

const prompts = [
	{
		key: "health",
		title: "Review team health trends",
		description: "Pulls health check history and surfaces declining questions.",
		text: `Fetch the health summary from ${baseUrl}/api/v1/series/SERIES_ID/health-summary?limit=10 using Authorization: Bearer $TEAMBEAT_API_TOKEN. Identify questions with a downward trend across the last five meetings. Write a brief summary for a team lead: what's improving, what's declining, and what to watch.`,
	},
	{
		key: "agreements",
		title: "List open agreements",
		description: "Finds everything the team committed to but hasn't completed.",
		text: `Call GET ${baseUrl}/api/v1/series/SERIES_ID/agreements?completed=false&limit=100 with Authorization: Bearer $TEAMBEAT_API_TOKEN. Format the results as a markdown checkbox list, grouped by board/meeting date (newest first). Include the board name and meeting date for each item.`,
	},
	{
		key: "codebase",
		title: "Push codebase analysis to scorecard",
		description: "The inject endpoint lets Claude write findings directly onto the board.",
		text: `Analyze this codebase for technical debt across these dimensions: TODO/FIXME comments (count and sample), functions over 50 lines, files over 500 lines, missing error handling in async functions, and test coverage gaps. Then POST the results to ${baseUrl}/api/v1/datasources/DATASOURCE_ID/inject with Authorization: Bearer $TEAMBEAT_API_TOKEN. Use one object per dimension, with a short section name, a descriptive title, the count as primaryValue, and secondaryValues for details. Set severity to "warning" for items over threshold, "critical" for anything blocking.`,
	},
	{
		key: "sprint",
		title: "Sprint summary to scorecard",
		description: "Turns your git history into board-ready scorecard data.",
		text: `Review the git log from the past two weeks (git log --since="2 weeks ago" --oneline). Categorize commits into: Deployments, Bug Fixes, New Features, and Refactors. POST a summary to ${baseUrl}/api/v1/datasources/DATASOURCE_ID/inject with Authorization: Bearer $TEAMBEAT_API_TOKEN. One object per category. Use commit count as primaryValue and list 2-3 representative titles as secondaryValues. Set severity to "info" for everything unless there were zero deployments or more than 5 bug fixes (use "warning" then).`,
	},
	{
		key: "board",
		title: "Summarize a board",
		description: "Good for async review before or after a meeting.",
		text: `Fetch board BOARD_ID from ${baseUrl}/api/v1/boards/BOARD_ID using Authorization: Bearer $TEAMBEAT_API_TOKEN. Also fetch /api/v1/boards/BOARD_ID/agreements and /api/v1/boards/BOARD_ID/cards. Write a concise meeting summary: how many cards per column, the top themes you see in the card content, how many agreements were made, and how many are still open.`,
	},
];
</script>

<svelte:head>
	<title>Claude Code Integration — Teambeat</title>
</svelte:head>

<div class="docs-page">
	<div class="docs-content">

		<header class="docs-header">
			<h1>Using Teambeat with Claude Code</h1>
			<p class="lead">
				Claude Code can read your board data and push AI-generated findings directly into scorecards.
				The <code>/api/v1/datasources/{"{id}"}/inject</code> endpoint was built specifically for this —
				Claude analyzes something (your codebase, git history, ticket queue) and writes the results
				straight to your next retrospective.
			</p>
		</header>

		<section>
			<h2>Setup</h2>

			<div class="steps">
				<div class="step">
					<span class="step-num">1</span>
					<div class="step-body">
						<h3>Create an API token</h3>
						<p>Go to <a href="/profile">your profile</a> and create a token. Label it something memorable like <em>"Claude Code — my-project"</em>. The token is shown once — copy it before dismissing.</p>
					</div>
				</div>

				<div class="step">
					<span class="step-num">2</span>
					<div class="step-body">
						<h3>Set environment variables</h3>
						<p>Add these to your shell profile (<code>~/.zshrc</code>, <code>~/.bashrc</code>, etc.):</p>
						<div class="code-block">
							<pre><code>{envBlock}</code></pre>
							<button class="copy-btn" onclick={() => copy(envBlock, "env")}>
								{copiedKey === "env" ? "Copied!" : "Copy"}
							</button>
						</div>
					</div>
				</div>

				<div class="step">
					<span class="step-num">3</span>
					<div class="step-body">
						<h3>Add to your project's <code>CLAUDE.md</code></h3>
						<p>
							Paste this into the <code>CLAUDE.md</code> at the root of any project where you want
							Claude to use Teambeat. Fill in the IDs for your series, boards, and datasources
							(find them in the URL bar when viewing those pages).
						</p>
						<div class="code-block">
							<pre><code>{claudeMdBlock}</code></pre>
							<button class="copy-btn" onclick={() => copy(claudeMdBlock, "claudemd")}>
								{copiedKey === "claudemd" ? "Copied!" : "Copy"}
							</button>
						</div>
					</div>
				</div>
			</div>
		</section>

		<section>
			<h2>Sample Prompts</h2>
			<p class="section-intro">
				Copy any of these into Claude Code (replace the placeholder IDs). Each one is self-contained —
				no prior context needed.
			</p>

			<div class="prompts">
				{#each prompts as prompt (prompt.key)}
					<div class="prompt-card">
						<div class="prompt-header">
							<div>
								<h3>{prompt.title}</h3>
								<p class="prompt-desc">{prompt.description}</p>
							</div>
							<button class="copy-btn" onclick={() => copy(prompt.text, prompt.key)}>
								{copiedKey === prompt.key ? "Copied!" : "Copy"}
							</button>
						</div>
						<pre class="prompt-text"><code>{prompt.text}</code></pre>
					</div>
				{/each}
			</div>
		</section>

		<section>
			<h2>Scorecard injection</h2>
			<p>
				The inject endpoint replaces all prior AI-generated results for a datasource with the new
				payload — so Claude can re-run analysis and the board updates immediately without anyone
				manually triggering a collection. Here's the curl shape:
			</p>
			<div class="code-block">
				<pre><code>{injectExample}</code></pre>
				<button class="copy-btn" onclick={() => copy(injectExample, "inject")}>
					{copiedKey === "inject" ? "Copied!" : "Copy"}
				</button>
			</div>
			<p class="note">
				Find the datasource ID on your board's scorecard configuration page.
				The datasource must have its source type set to <strong>AI</strong> — only AI datasources accept injected data.
			</p>
		</section>

		<section>
			<h2>Endpoint reference</h2>
			<table class="endpoint-table">
				<thead>
					<tr>
						<th>Method</th>
						<th>Path</th>
						<th>What it returns</th>
					</tr>
				</thead>
				<tbody>
					<tr><td>GET</td><td><code>/api/v1/series</code></td><td>Series you belong to with your role</td></tr>
					<tr><td>GET</td><td><code>/api/v1/series/{"{id}"}/boards</code></td><td>Boards in a series (paginated, filterable by status)</td></tr>
					<tr><td>POST</td><td><code>/api/v1/series/{"{id}"}/boards</code></td><td>Create a board (optionally with columns, scenes, seed cards)</td></tr>
					<tr><td>GET</td><td><code>/api/v1/series/{"{id}"}/health-summary</code></td><td>Health question history across recent boards</td></tr>
					<tr><td>GET</td><td><code>/api/v1/series/{"{id}"}/agreements</code></td><td>Agreements across all boards (paginated, filterable)</td></tr>
					<tr><td>GET</td><td><code>/api/v1/boards/{"{id}"}</code></td><td>Full board with scenes, columns, cards</td></tr>
					<tr><td>GET</td><td><code>/api/v1/boards/{"{id}"}/cards</code></td><td>Cards with column title and vote/comment counts</td></tr>
					<tr><td>GET</td><td><code>/api/v1/boards/{"{id}"}/agreements</code></td><td>Board-level agreements (?completed filter)</td></tr>
					<tr><td>GET</td><td><code>/api/v1/boards/{"{id}"}/scorecard-results</code></td><td>Processed scorecard data for the board</td></tr>
					<tr><td>POST</td><td><code>/api/v1/datasources/{"{id}"}/inject</code></td><td>Push AI findings to a scorecard (replaces prior AI results)</td></tr>
					<tr><td>GET</td><td><code>/api/v1/tokens</code></td><td>List your API tokens</td></tr>
					<tr><td>POST</td><td><code>/api/v1/tokens</code></td><td>Create a token</td></tr>
					<tr><td>DELETE</td><td><code>/api/v1/tokens/{"{id}"}</code></td><td>Revoke a token</td></tr>
				</tbody>
			</table>
			<p class="note">
				All endpoints accept <code>Authorization: Bearer &lt;token&gt;</code>.
				The full machine-readable spec is at
				<a href="/api/v1/openapi.json" target="_blank" rel="noopener noreferrer">/api/v1/openapi.json</a>.
			</p>
		</section>

	</div>
</div>

<style>
.docs-page {
	display: flex;
	background: var(--color-bg-primary);
	flex: 1;
	overflow-y: auto;
	width: 100%;
	justify-content: center;
	padding: 2rem 1rem 4rem;
}

.docs-content {
	max-width: 52rem;
	width: 100%;
}

.docs-header {
	margin-bottom: 2.5rem;
	padding-bottom: 1.5rem;
	border-bottom: 2px solid var(--color-border);
}

.docs-header h1 {
	font-size: 1.75rem;
	font-weight: 700;
	margin-bottom: 0.75rem;
}

.lead {
	font-size: 1rem;
	color: var(--color-text-secondary);
	line-height: 1.6;
	margin: 0;
}

section {
	margin-bottom: 2.5rem;
}

section h2 {
	font-size: 1.25rem;
	font-weight: 600;
	margin-bottom: 1rem;
	padding-bottom: 0.4rem;
	border-bottom: 1px solid var(--color-border);
}

.section-intro {
	color: var(--color-text-secondary);
	margin-bottom: 1.25rem;
}

/* Steps */
.steps {
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
}

.step {
	display: flex;
	gap: 1rem;
	align-items: flex-start;
}

.step-num {
	flex-shrink: 0;
	width: 1.75rem;
	height: 1.75rem;
	background: var(--color-primary);
	color: white;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 0.85rem;
	font-weight: 700;
	margin-top: 0.1rem;
}

.step-body h3 {
	font-size: 1rem;
	font-weight: 600;
	margin-bottom: 0.35rem;
}

.step-body p {
	color: var(--color-text-secondary);
	margin-bottom: 0.75rem;
	line-height: 1.5;
}

/* Code blocks */
.code-block {
	position: relative;
	background: #1e1e2e;
	border-radius: 6px;
	overflow: hidden;
}

.code-block pre {
	margin: 0;
	padding: 1rem 3.5rem 1rem 1rem;
	overflow-x: auto;
}

.code-block code {
	font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
	font-size: 0.8rem;
	line-height: 1.6;
	color: #cdd6f4;
	white-space: pre;
	/* reset global code style that would apply a light bg box inside the dark block */
	background: transparent;
	padding: 0;
	border-radius: 0;
}

.copy-btn {
	position: absolute;
	top: 0.5rem;
	right: 0.5rem;
	padding: 0.2rem 0.6rem;
	font-size: 0.75rem;
	background: rgba(255,255,255,0.1);
	color: #cdd6f4;
	border: 1px solid rgba(255,255,255,0.2);
	border-radius: 4px;
	cursor: pointer;
	white-space: nowrap;
	transition: background 0.15s;
}

.copy-btn:hover {
	background: rgba(255,255,255,0.2);
}

/* Prompt cards */
.prompts {
	display: flex;
	flex-direction: column;
	gap: 1.25rem;
}

.prompt-card {
	border: 1px solid var(--color-border);
	border-radius: 8px;
	overflow: hidden;
}

.prompt-header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 1rem;
	padding: 0.875rem 1rem;
	background: var(--color-bg-secondary, #fff);
}

.prompt-header h3 {
	font-size: 0.95rem;
	font-weight: 600;
	margin-bottom: 0.2rem;
}

.prompt-desc {
	font-size: 0.8rem;
	color: var(--color-text-secondary);
	margin: 0;
}

.prompt-header .copy-btn {
	position: static;
	background: var(--color-bg-muted, #f3f4f6);
	color: var(--color-text-secondary);
	border-color: var(--color-border);
	flex-shrink: 0;
}

.prompt-header .copy-btn:hover {
	background: var(--color-border);
}

.prompt-text {
	margin: 0;
	padding: 0.875rem 1rem;
	background: #1e1e2e;
	overflow-x: auto;
}

.prompt-text code {
	font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
	font-size: 0.8rem;
	line-height: 1.6;
	color: #cdd6f4;
	white-space: pre-wrap;
	word-break: break-word;
	background: transparent;
	padding: 0;
	border-radius: 0;
}

/* Table */
.endpoint-table {
	width: 100%;
	border-collapse: collapse;
	font-size: 0.875rem;
	margin-bottom: 0.75rem;
}

.endpoint-table th {
	text-align: left;
	padding: 0.5rem 0.75rem;
	background: var(--color-bg-muted, #f3f4f6);
	border-bottom: 2px solid var(--color-border);
	font-weight: 600;
}

.endpoint-table td {
	padding: 0.5rem 0.75rem;
	border-bottom: 1px solid var(--color-border);
	vertical-align: top;
}

.endpoint-table tr:last-child td {
	border-bottom: none;
}

.endpoint-table td:first-child {
	font-family: ui-monospace, monospace;
	font-size: 0.8rem;
	color: var(--color-primary);
	white-space: nowrap;
}

.endpoint-table code {
	font-size: 0.8rem;
	background: var(--color-bg-muted, #f3f4f6);
	padding: 0.1rem 0.35rem;
	border-radius: 3px;
}

.note {
	font-size: 0.85rem;
	color: var(--color-text-secondary);
	line-height: 1.5;
}

code {
	font-family: ui-monospace, 'Cascadia Code', monospace;
	font-size: 0.875em;
	background: var(--color-bg-muted, #f3f4f6);
	padding: 0.1em 0.35em;
	border-radius: 3px;
}
</style>
