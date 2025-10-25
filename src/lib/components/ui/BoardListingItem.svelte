<script lang="ts">
import type { Snippet } from "svelte";
import Pill from "./Pill.svelte";

interface Props {
	name: string;
	meetingDate?: string | null;
	createdAt?: string;
	status?: "draft" | "active" | "complete" | "archived";
	onclick?: () => void;
	class?: string;
	actions?: Snippet;
}

let {
	name,
	meetingDate,
	createdAt,
	status = "draft",
	onclick,
	class: className = "",
	actions,
}: Props = $props();

function formatDate(dateString: string | null | undefined) {
	if (!dateString) return "";
	const date = new Date(dateString);
	const options: Intl.DateTimeFormatOptions = {
		weekday: "short",
		month: "short",
		day: "numeric",
		year: "numeric",
	};
	return date.toLocaleDateString("en-US", options);
}

let displayDate = $derived(formatDate(meetingDate || createdAt));

let itemClass = $derived.by(() => {
	let classes = ["board-listing-item"];
	if (className) {
		classes.push(className);
	}
	return classes.join(" ");
});
</script>

<button
    {onclick}
    class={itemClass}
>
    <div class="board-listing-content">
        <div class="board-listing-info">
            <h4 class="board-listing-name">{name}</h4>
            {#if displayDate}
                <p class="board-listing-date">{displayDate}</p>
            {/if}
        </div>
        <div class="board-listing-actions">
            {#if actions}
                {@render actions()}
            {/if}
            <Pill preset={status}>{status}</Pill>
        </div>
    </div>
</button>