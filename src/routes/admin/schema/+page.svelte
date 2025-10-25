<script lang="ts">
import { onMount } from "svelte";
import AdminNav from "$lib/components/AdminNav.svelte";
import type { SchemaCheckResult } from "$lib/server/db/schema-introspection";

let result: SchemaCheckResult | null = $state(null);
let loading = $state(true);
let error = $state("");

async function loadSchemaCheck() {
	try {
		const response = await fetch("/api/admin/schema");
		if (!response.ok) {
			const errorData = await response
				.json()
				.catch(() => ({ message: response.statusText }));
			throw new Error(
				errorData.message || `HTTP ${response.status}: ${response.statusText}`,
			);
		}
		result = await response.json();
		error = "";
	} catch (err) {
		error = err instanceof Error ? err.message : String(err);
		console.error("Schema check failed:", err);
	} finally {
		loading = false;
	}
}

onMount(() => {
	loadSchemaCheck();
});

function getSeverityClass(severity: "error" | "warning") {
	return severity === "error" ? "error" : "warning";
}
</script>

<AdminNav />
<div class="page-container">
    <div class="schema-dashboard">
        <header class="dashboard-header">
            <h1>Database Schema Check</h1>
            <button onclick={loadSchemaCheck} class="refresh-button"
                >Refresh</button
            >
        </header>

        {#if loading}
            <div class="loading">Loading schema information...</div>
        {:else if error}
            <div class="error-message">{error}</div>
        {:else if result}
            <!-- Database Info -->
            <section class="info-card">
                <h2>Database Information</h2>
                <div class="info-row">
                    <span class="label">Type:</span>
                    <span class="value">{result.database.type}</span>
                </div>
                <div class="info-row">
                    <span class="label">Version:</span>
                    <span class="value">{result.database.version}</span>
                </div>
            </section>

            <!-- Conformance Status -->
            <section
                class="status-card"
                class:conformant={result.conformant}
                class:non-conformant={!result.conformant}
            >
                <h2>Schema Conformance</h2>
                <div class="status-indicator">
                    {#if result.conformant}
                        <span class="status-badge success"
                            >✓ Schema Conformant</span
                        >
                        <p>
                            Database schema matches the code schema definition.
                        </p>
                    {:else}
                        <span class="status-badge error"
                            >✗ Schema Drift Detected</span
                        >
                        <p>
                            Database schema does not match the code schema
                            definition. See issues below.
                        </p>
                    {/if}
                </div>
            </section>

            <!-- Tables Overview -->
            <section class="tables-card">
                <h2>Tables Overview</h2>
                <div class="tables-grid">
                    <div class="table-list">
                        <h3>Expected Tables ({result.tables.expected.length})</h3>
                        <ul>
                            {#each result.tables.expected as tableInfo}
                                <li
                                    class:missing={result.tables.missing.includes(
                                        tableInfo.name,
                                    )}
                                >
                                    {tableInfo.name} ({tableInfo.columnCount} cols, {tableInfo.indexCount} idx)
                                    {#if result.tables.missing.includes(tableInfo.name)}
                                        <span class="badge error">missing</span>
                                    {/if}
                                </li>
                            {/each}
                        </ul>
                    </div>

                    <div class="table-list">
                        <h3>Actual Tables ({result.tables.actual.length})</h3>
                        <ul>
                            {#each result.tables.actual as tableInfo}
                                <li
                                    class:extra={result.tables.extra.includes(
                                        tableInfo.name,
                                    )}
                                >
                                    {tableInfo.name} ({tableInfo.columnCount} cols, {tableInfo.indexCount} idx)
                                    {#if result.tables.extra.includes(tableInfo.name)}
                                        <span class="badge warning">extra</span>
                                    {/if}
                                </li>
                            {/each}
                        </ul>
                    </div>
                </div>
            </section>

            <!-- Issues -->
            {#if result.issues.length > 0}
                <section class="issues-card">
                    <h2>
                        Schema Issues ({result.issues.length})
                    </h2>
                    <div class="issues-list">
                        {#each result.issues as issue}
                            <div
                                class="issue-item {getSeverityClass(
                                    issue.severity,
                                )}"
                            >
                                <div class="issue-header">
                                    <span class="severity-badge"
                                        >{issue.severity}</span
                                    >
                                    <span class="table-name">{issue.table}</span>
                                    {#if issue.column}
                                        <span class="column-name"
                                            >.{issue.column}</span
                                        >
                                    {:else if issue.index}
                                        <span class="index-name"
                                            >[{issue.index}]</span
                                        >
                                    {/if}
                                </div>
                                <p class="issue-description">{issue.issue}</p>
                                {#if issue.expected || issue.actual}
                                    <div class="issue-details">
                                        {#if issue.expected}
                                            <div>
                                                <strong>Expected:</strong>
                                                {issue.expected}
                                            </div>
                                        {/if}
                                        {#if issue.actual}
                                            <div>
                                                <strong>Actual:</strong>
                                                {issue.actual}
                                            </div>
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </section>
            {:else}
                <section class="no-issues-card">
                    <h2>No Issues Found</h2>
                    <p>
                        All tables and columns match the expected schema
                        definition.
                    </p>
                </section>
            {/if}
        {/if}
    </div>
</div>

<style lang="less">
    @import "$lib/styles/_mixins.less";

    .page-container {
        .page-container();
    }

    .schema-dashboard {
        padding: 2rem;
        max-width: 1400px;
        margin: 0 auto;
        width: 100%;
    }

    .dashboard-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;

        h1 {
            margin: 0;
            font-size: 2rem;
            color: @neutral-darker;
        }
    }

    .refresh-button {
        padding: 0.5rem 1rem;
        background: @interactive-primary;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
            background: darken(@interactive-primary, 10%);
        }
    }

    .loading,
    .error-message {
        text-align: center;
        padding: 2rem;
        font-size: 1.2rem;
    }

    .error-message {
        color: @brand-danger;
        background: lighten(@brand-danger, 35%);
        border: 1px solid @brand-danger;
        border-radius: 8px;
    }

    .info-card,
    .status-card,
    .tables-card,
    .issues-card,
    .no-issues-card {
        background: @neutral-white;
        border: 1px solid @neutral-gray;
        border-radius: 8px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;

        h2 {
            margin: 0 0 1rem 0;
            font-size: 1.2rem;
            color: @neutral-darker;
        }
    }

    .tables-card {
        h3 {
            margin: 0 0 0.75rem 0;
            font-size: 1rem;
            color: @neutral-dark-gray;
        }
    }

    .info-row {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem 0;
        border-bottom: 1px solid @neutral-light-gray;

        &:last-child {
            border-bottom: none;
        }

        .label {
            color: @neutral-mid-gray;
            font-weight: 500;
        }

        .value {
            font-weight: 600;
            color: @neutral-darker;
            text-transform: uppercase;
        }
    }

    .status-card {
        &.conformant {
            border-color: @brand-success;
            background: lighten(@brand-success, 45%);
        }

        &.non-conformant {
            border-color: @brand-danger;
            background: lighten(@brand-danger, 42%);
        }
    }

    .status-indicator {
        text-align: center;

        p {
            margin: 0.5rem 0 0 0;
            color: @neutral-dark-gray;
        }
    }

    .status-badge {
        display: inline-block;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        font-weight: 600;
        font-size: 1.1rem;

        &.success {
            background: @brand-success;
            color: white;
        }

        &.error {
            background: @brand-danger;
            color: white;
        }
    }

    .tables-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2rem;

        @media (max-width: 768px) {
            grid-template-columns: 1fr;
        }
    }

    .table-list {
        ul {
            list-style: none;
            padding: 0;
            margin: 0;

            li {
                padding: 0.5rem;
                border-bottom: 1px solid @neutral-light-gray;
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-family: "Courier New", monospace;

                &:last-child {
                    border-bottom: none;
                }

                &.missing {
                    background: lighten(@brand-danger, 42%);
                    color: @brand-danger;
                }

                &.extra {
                    background: lighten(@brand-warning, 42%);
                    color: darken(@brand-warning, 30%);
                }
            }
        }
    }

    .badge {
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
        border-radius: 3px;
        font-weight: 600;
        text-transform: uppercase;

        &.error {
            background: @brand-danger;
            color: white;
        }

        &.warning {
            background: @brand-warning;
            color: @neutral-darker;
        }
    }

    .issues-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .issue-item {
        padding: 1rem;
        border-radius: 6px;
        border-left: 4px solid;

        &.error {
            border-left-color: @brand-danger;
            background: lighten(@brand-danger, 42%);
        }

        &.warning {
            border-left-color: @brand-warning;
            background: lighten(@brand-warning, 42%);
        }
    }

    .issue-header {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        margin-bottom: 0.5rem;
        font-family: "Courier New", monospace;
    }

    .severity-badge {
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
        border-radius: 3px;
        font-weight: 600;
        text-transform: uppercase;

        .error & {
            background: @brand-danger;
            color: white;
        }

        .warning & {
            background: @brand-warning;
            color: @neutral-darker;
        }
    }

    .table-name {
        font-weight: 600;
        color: @neutral-darker;
    }

    .column-name {
        color: @neutral-mid-gray;
    }

    .index-name {
        color: @neutral-mid-gray;
        font-style: italic;
    }

    .issue-description {
        margin: 0 0 0.5rem 0;
        color: @neutral-dark-gray;
    }

    .issue-details {
        font-size: 0.875rem;
        font-family: "Courier New", monospace;
        background: @neutral-white;
        padding: 0.5rem;
        border-radius: 4px;
        margin-top: 0.5rem;

        div {
            margin: 0.25rem 0;
        }

        strong {
            color: @neutral-dark-gray;
        }
    }

    .no-issues-card {
        text-align: center;
        background: lighten(@brand-success, 45%);
        border-color: @brand-success;

        p {
            margin: 0;
            color: @neutral-dark-gray;
        }
    }
</style>
