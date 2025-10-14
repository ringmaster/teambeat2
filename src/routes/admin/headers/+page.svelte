<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="page-container">
	<div class="headers-page">
		<h1>Request Headers</h1>

		<section class="client-info">
			<h2>Client Address</h2>
			<p class="client-address">{data.clientAddress}</p>
		</section>

		<section class="headers-table">
			<h2>Request Headers</h2>
			<table>
				<thead>
					<tr>
						<th>Header Name</th>
						<th>Value</th>
					</tr>
				</thead>
				<tbody>
					{#each Object.entries(data.headers) as [name, value]}
						<tr>
							<td class="header-name">{name}</td>
							<td class="header-value">{value}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	</div>
</div>

<style lang="less">
	@import "$lib/styles/_mixins.less";

	.page-container {
		.page-container();
	}

	.headers-page {
		padding: 2rem;
		max-width: 1200px;
		margin: 0 auto;

		h1 {
			margin: 0 0 2rem 0;
			font-size: 2rem;
		}
	}

	.client-info {
		margin-bottom: 2rem;
		padding: 1rem;
		background: var(--color-background-secondary);
		border-radius: 8px;

		h2 {
			margin-bottom: 0.5rem;
			font-size: 1.25rem;
			color: var(--color-text-primary);
		}

		.client-address {
			font-family: monospace;
			font-size: 1.1rem;
			color: var(--color-text-secondary);
			margin: 0;
		}
	}

	.headers-table {
		h2 {
			margin-bottom: 1rem;
			font-size: 1.25rem;
			color: var(--color-text-primary);
		}

		table {
			width: 100%;
			border-collapse: collapse;
			background: var(--color-background-primary);
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
			border-radius: 8px;
			overflow: hidden;

			thead {
				background: var(--color-background-tertiary);

				th {
					padding: 1rem;
					text-align: left;
					font-weight: 600;
					color: var(--color-text-primary);
					border-bottom: 2px solid var(--color-border);
				}
			}

			tbody {
				tr {
					border-bottom: 1px solid var(--color-border);

					&:last-child {
						border-bottom: none;
					}

					&:hover {
						background: var(--color-background-secondary);
					}
				}

				td {
					padding: 0.75rem 1rem;
					vertical-align: top;

					&.header-name {
						font-weight: 500;
						color: var(--color-text-primary);
						font-family: monospace;
						width: 30%;
					}

					&.header-value {
						color: var(--color-text-secondary);
						font-family: monospace;
						word-break: break-all;
					}
				}
			}
		}
	}
</style>
