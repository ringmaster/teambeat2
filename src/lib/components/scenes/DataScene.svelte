<script lang="ts">
import { onMount, onDestroy } from "svelte";
import jmespath from "jmespath";

interface Column {
  id: string;
  title: string;
}

interface Rule {
  id: string;
  sceneId: string;
  seq: number;
  section: string;
  label: string;
  query: string;
  panelSize: "small" | "medium" | "full";
  titleTemplate: string;
  bodyTemplate: string;
  copyTemplate?: string | null;
  emphasisPath?: string | null;
  emphasisMap?: string | null;
}

interface Panel {
  rule: Rule;
  item: any;
  title: string;
  body: string;
  emphasis: string | null;
  panelKey: string;
}

interface Props {
  board: any;
  scene: any;
  enabledColumns: Column[];
  canAddCards: boolean;
}

let { board, scene, enabledColumns, canAddCards }: Props = $props();

const MAX_PANELS_PER_RULE = 50;

let dataset = $state<any>(null);
let rules = $state<Rule[]>([]);
let loading = $state(true);
let error = $state<string | null>(null);
let addingCardFor = $state<string | null>(null);
let addCardDropdownOpen = $state<string | null>(null);
let truncatedRules = $state<string[]>([]);

// Simple {field.nested} interpolation
function interpolate(template: string, obj: any): string {
  if (!template || !obj) return template || "";
  return template.replace(/\{([^}]+)\}/g, (_, path) => {
    const parts = path.split(".");
    let val: any = obj;
    for (const part of parts) {
      if (val == null) return "";
      val = val[part];
    }
    return val == null ? "" : String(val);
  });
}

function evalQuery(query: string, data: any): any[] {
  if (!query || !data) return [];
  try {
    const result = jmespath.search(data, query);
    if (result === null || result === undefined) return [];
    if (Array.isArray(result)) return result;
    return [result];
  } catch (e) {
    console.warn("JMESPath error:", query, e);
    return [];
  }
}

function getEmphasis(item: any, rule: Rule): string | null {
  if (!rule.emphasisPath || !rule.emphasisMap) return null;
  try {
    const map = JSON.parse(rule.emphasisMap);
    const val = jmespath.search(item, rule.emphasisPath);
    const key = val == null ? null : String(val);
    return key !== null ? (map[key] ?? null) : null;
  } catch {
    return null;
  }
}

function groupRules(rs: Rule[]): { section: string; rules: Rule[] }[] {
  const sections: { section: string; rules: Rule[] }[] = [];
  const seen = new Map<string, { section: string; rules: Rule[] }>();
  for (const rule of rs) {
    const key = rule.section || "";
    if (!seen.has(key)) {
      const group = { section: key, rules: [] };
      seen.set(key, group);
      sections.push(group);
    }
    seen.get(key)!.rules.push(rule);
  }
  return sections;
}

let sections = $derived.by(() => {
  if (!dataset || rules.length === 0) return [];
  return groupRules(rules);
});

function getPanelsForRule(rule: Rule): { panels: Panel[]; truncated: boolean; total: number } {
  const items = evalQuery(rule.query, dataset);
  const total = items.length;
  const truncated = total > MAX_PANELS_PER_RULE;
  const sliced = truncated ? items.slice(0, MAX_PANELS_PER_RULE) : items;
  const panels = sliced.map((item, idx) => ({
    rule,
    item,
    title: interpolate(rule.titleTemplate, item),
    body: interpolate(rule.bodyTemplate, item),
    emphasis: getEmphasis(item, rule),
    panelKey: `${rule.id}-${idx}`,
  }));
  return { panels, truncated, total };
}

async function loadData() {
  try {
    loading = true;
    error = null;
    truncatedRules = [];
    const [dataRes, rulesRes] = await Promise.all([
      fetch(`/api/boards/${board.id}/data-source`),
      fetch(`/api/scenes/${scene.id}/data-rules`),
    ]);
    const dataJson = await dataRes.json();
    const rulesJson = await rulesRes.json();
    if (dataJson.success) dataset = dataJson.data;
    if (rulesJson.success) rules = (rulesJson.rules || []).sort((a: Rule, b: Rule) => a.seq - b.seq);
  } catch (e) {
    error = "Failed to load data scene.";
    console.error(e);
  } finally {
    loading = false;
  }
}

let unsubscribe: (() => void) | null = null;

onMount(() => {
  loadData();
  const listener = () => loadData();
  window.addEventListener("data_source_updated", listener);
  unsubscribe = () => window.removeEventListener("data_source_updated", listener);
});

onDestroy(() => unsubscribe?.());

// Close dropdown on outside click
function handleDocClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest(".data-panel-menu")) addCardDropdownOpen = null;
}

onMount(() => document.addEventListener("click", handleDocClick));
onDestroy(() => document.removeEventListener("click", handleDocClick));

async function addToColumn(panel: Panel, columnId: string) {
  const content = panel.rule.copyTemplate
    ? interpolate(panel.rule.copyTemplate, panel.item)
    : [panel.title, panel.body].filter(Boolean).join("\n\n");

  try {
    addingCardFor = panel.panelKey;
    const res = await fetch(`/api/boards/${board.id}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columnId, content }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Failed");
    addCardDropdownOpen = null;
  } catch (e) {
    console.error("Failed to add card:", e);
  } finally {
    addingCardFor = null;
  }
}
</script>

<div class="data-scene-wrapper">
  <div class="data-scene-content">
    {#if loading}
      <div class="data-empty">Loading…</div>
    {:else if error}
      <div class="data-empty data-empty--error">{error}</div>
    {:else if !dataset}
      <div class="data-empty">No data has been pushed to this series yet.</div>
    {:else if rules.length === 0}
      <div class="data-empty">No display rules configured for this scene.</div>
    {:else}
      {#each sections as { section, rules: sectionRules }}
        <div class="data-section">
          {#if section}
            <h2 class="data-section-title">{section}</h2>
          {/if}
          {#each sectionRules as rule}
            {@const { panels, truncated, total } = getPanelsForRule(rule)}
            {#if truncated}
              <div class="data-cap-warning">
                Showing {MAX_PANELS_PER_RULE} of {total} results for "{rule.label}". Only the first {MAX_PANELS_PER_RULE} items are displayed.
              </div>
            {/if}
            {#if panels.length > 0}
              <div class="data-panels data-panels--{rule.panelSize}">
                {#each panels as panel (panel.panelKey)}
                  <div class="data-panel data-panel--{rule.panelSize} {panel.emphasis ? `data-panel--${panel.emphasis}` : ''}">
                    {#if panel.title}
                      <div class="data-panel-title">{panel.title}</div>
                    {/if}
                    {#if panel.body}
                      <div class="data-panel-body">{panel.body}</div>
                    {/if}
                    {#if canAddCards && enabledColumns.length > 0}
                      <div class="data-panel-footer">
                        <div class="data-panel-menu">
                          <button
                            class="icon-button"
                            onclick={(e) => { e.stopPropagation(); addCardDropdownOpen = addCardDropdownOpen === panel.panelKey ? null : panel.panelKey; }}
                            disabled={addingCardFor === panel.panelKey}
                            title="Add to column"
                          >
                            {#if addingCardFor === panel.panelKey}
                              <span class="adding-indicator">…</span>
                            {:else}
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                              </svg>
                            {/if}
                          </button>
                          {#if addCardDropdownOpen === panel.panelKey}
                            <div class="dropdown-menu">
                              <div class="dropdown-header">Copy to column:</div>
                              {#each enabledColumns as col}
                                <button
                                  class="dropdown-item"
                                  onclick={() => addToColumn(panel, col.id)}
                                >
                                  {col.title}
                                </button>
                              {/each}
                            </div>
                          {/if}
                        </div>
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            {:else}
              <p class="data-rule-empty"><em>No results for "{rule.label}"</em></p>
            {/if}
          {/each}
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
.data-scene-wrapper {
  display: flex;
  background: var(--color-bg-primary);
  flex: 1;
  overflow-y: auto;
  width: 100%;
}

.data-scene-content {
  max-width: 80rem;
  margin: 0 auto;
  padding: var(--spacing-6, 1.5rem) var(--spacing-4, 1rem);
  width: 100%;

  @media (min-width: 768px) {
    padding-left: var(--spacing-6, 1.5rem);
    padding-right: var(--spacing-6, 1.5rem);
  }
}

.data-empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary, #6b7280);
  font-size: 1rem;
}

.data-empty--error {
  color: var(--color-red-600, #dc2626);
}

.data-cap-warning {
  background: var(--color-warning-bg, #fef3c7);
  border: 1px solid var(--color-warning, #f59e0b);
  border-radius: var(--radius-md, 6px);
  padding: var(--spacing-2, 0.5rem) var(--spacing-3, 0.75rem);
  margin-bottom: var(--spacing-3, 0.75rem);
  font-size: var(--text-sm, 0.875rem);
  color: var(--color-warning-text, #92400e);
}

.data-section {
  margin-bottom: var(--spacing-8, 2rem);
}

.data-section-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary, #111827);
  margin: 0 0 var(--spacing-4, 1rem) 0;
  padding-bottom: var(--spacing-2, 0.5rem);
  border-bottom: 2px solid var(--surface-tertiary, #e5e7eb);
}

.data-rule-empty {
  color: var(--text-tertiary, #9ca3af);
  font-size: var(--text-sm, 0.875rem);
}

.data-panels {
  display: grid;
  gap: var(--spacing-3, 0.75rem);
  margin-bottom: var(--spacing-4, 1rem);
}

.data-panels--small {
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
}

.data-panels--medium {
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.data-panels--full {
  grid-template-columns: 1fr;
}

.data-panel {
  background: var(--surface-primary, #fff);
  border: 1px solid var(--surface-tertiary, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  padding: var(--spacing-3, 0.75rem) var(--spacing-4, 1rem);
  border-left: 4px solid transparent;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2, 0.35rem);
}

.data-panel--danger {
  border-left-color: var(--color-danger, #dc2626);
  background: var(--color-danger-bg, #fef2f2);
}

.data-panel--warning {
  border-left-color: var(--color-warning, #f59e0b);
  background: var(--color-warning-bg-light, #fffbeb);
}

.data-panel--info {
  border-left-color: var(--color-info, #3b82f6);
  background: var(--color-info-bg, #eff6ff);
}

.data-panel-title {
  font-weight: 600;
  font-size: var(--text-sm, 0.9rem);
  color: var(--text-primary, #111827);
  line-height: 1.3;
}

.data-panel-body {
  font-size: var(--text-xs, 0.82rem);
  color: var(--text-secondary, #6b7280);
  white-space: pre-line;
  line-height: 1.4;
  flex: 1;
}

.data-panel-footer {
  margin-top: var(--spacing-2, 0.5rem);
  display: flex;
  justify-content: flex-end;
}

.data-panel-menu {
  position: relative;
}

/* Reuse app dropdown styles */
.dropdown-menu {
  position: absolute;
  bottom: calc(100% + 4px);
  right: 0;
  background: var(--surface-primary, white);
  border: 1px solid var(--surface-tertiary, #e5e7eb);
  border-radius: var(--radius-md, 6px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 180px;
  z-index: 100;
}

.dropdown-header {
  padding: var(--spacing-2, 0.5rem) var(--spacing-3, 0.75rem);
  font-size: var(--text-xs, 0.75rem);
  font-weight: 600;
  color: var(--text-secondary, #6b7280);
  text-transform: uppercase;
  border-bottom: 1px solid var(--surface-tertiary, #e5e7eb);
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: var(--spacing-2, 0.5rem) var(--spacing-3, 0.75rem);
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-primary, #374151);
  transition: background-color 0.15s ease;

  &:hover {
    background: var(--surface-secondary, #f3f4f6);
  }
}

.adding-indicator {
  font-size: 0.75rem;
  color: var(--text-secondary);
}
</style>
