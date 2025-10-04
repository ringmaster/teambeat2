<script lang="ts">
  import { onMount } from 'svelte';
  import type { ScorecardDatasource, ScorecardRule, ThresholdRule } from '$lib/types/scorecard';
  import { parseRPNString, serializeRPNExpression } from '$lib/utils/rpn-parser';

  interface Props {
    scorecardId: string;
    datasourceId?: string;
    seriesId: string;
  }

  let { scorecardId, datasourceId, seriesId }: Props = $props();

  // Editable rule with condition as string for UI
  interface EditableRule extends Omit<ScorecardRule, 'condition'> {
    condition: string; // String representation for editing
  }

  let datasource = $state<ScorecardDatasource | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let saving = $state(false);

  let name = $state('');
  let sourceType = $state<'paste' | 'api'>('paste');
  let dataSchema = $state('');
  let rules = $state<EditableRule[]>([]);
  let editingRuleIndex = $state<number | null>(null);

  async function loadDatasource() {
    if (!datasourceId) {
      loading = false;
      return;
    }

    try {
      loading = true;
      error = null;
      const response = await fetch(`/api/scorecards/${scorecardId}/datasources/${datasourceId}`);
      const data = await response.json();

      if (data.success) {
        datasource = data.datasource;
        name = datasource.name;
        sourceType = datasource.sourceType;
        dataSchema = datasource.dataSchema || '';

        // Convert ScorecardRule[] to EditableRule[] by serializing conditions
        const loadedRules: ScorecardRule[] = JSON.parse(datasource.rules);
        rules = loadedRules.map(rule => ({
          ...rule,
          condition: serializeRPNExpression(rule.condition)
        }));
      } else {
        error = data.error || 'Failed to load datasource';
      }
    } catch (e) {
      error = 'Failed to load datasource';
      console.error('Error loading datasource:', e);
    } finally {
      loading = false;
    }
  }

  async function saveDatasource() {
    if (!name.trim()) {
      error = 'Name is required';
      return;
    }

    if (rules.length === 0) {
      error = 'At least one rule is required';
      return;
    }

    try {
      saving = true;
      error = null;

      // Convert EditableRule[] to ScorecardRule[] by parsing conditions
      const parsedRules: ScorecardRule[] = rules.map(rule => {
        try {
          return {
            ...rule,
            condition: parseRPNString(rule.condition)
          };
        } catch (parseError) {
          throw new Error(`Invalid RPN expression in rule "${rule.title_template}": ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        }
      });

      const body = {
        name,
        source_type: sourceType,
        data_schema: dataSchema || null,
        rules: parsedRules,
        api_config: null
      };

      const url = datasourceId
        ? `/api/scorecards/${scorecardId}/datasources/${datasourceId}`
        : `/api/scorecards/${scorecardId}/datasources`;

      const method = datasourceId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to scorecard editor
        window.location.href = `/series/${seriesId}/scorecards/${scorecardId}`;
      } else {
        error = data.error || 'Failed to save datasource';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to save datasource';
      console.error('Error saving datasource:', e);
    } finally {
      saving = false;
    }
  }

  function addRule() {
    const newRule: EditableRule = {
      id: `rule-${Date.now()}`,
      section: 'Default Section',
      iterate_over: null,
      condition: 'true',
      title_template: 'New Rule',
      value_template: '',
      severity: 'info'
    };
    rules = [...rules, newRule];
    editingRuleIndex = rules.length - 1;
  }

  function deleteRule(index: number) {
    rules = rules.filter((_, i) => i !== index);
    if (editingRuleIndex === index) {
      editingRuleIndex = null;
    }
  }

  function moveRuleUp(index: number) {
    if (index === 0) return;
    const newRules = [...rules];
    [newRules[index - 1], newRules[index]] = [newRules[index], newRules[index - 1]];
    rules = newRules;
    if (editingRuleIndex === index) {
      editingRuleIndex = index - 1;
    } else if (editingRuleIndex === index - 1) {
      editingRuleIndex = index;
    }
  }

  function moveRuleDown(index: number) {
    if (index === rules.length - 1) return;
    const newRules = [...rules];
    [newRules[index], newRules[index + 1]] = [newRules[index + 1], newRules[index]];
    rules = newRules;
    if (editingRuleIndex === index) {
      editingRuleIndex = index + 1;
    } else if (editingRuleIndex === index + 1) {
      editingRuleIndex = index;
    }
  }

  onMount(() => {
    loadDatasource();
  });
</script>

<div class="datasource-editor">
  <div class="editor-header">
    <h2>{datasourceId ? 'Edit Datasource' : 'New Datasource'}</h2>
    <a href="/series/{seriesId}/scorecards/{scorecardId}" class="btn-secondary">
      Back to Scorecard
    </a>
  </div>

  {#if error}
    <div class="error-message">{error}</div>
  {/if}

  {#if loading}
    <div class="loading">Loading...</div>
  {:else}
    <form onsubmit={(e) => { e.preventDefault(); saveDatasource(); }}>
      <div class="form-section">
        <h3>Basic Information</h3>
        <div class="form-group">
          <label for="datasource-name">Name</label>
          <input
            id="datasource-name"
            type="text"
            bind:value={name}
            placeholder="e.g., GitHub Activity, Sales Metrics"
            required
          />
        </div>

        <div class="form-group">
          <label for="source-type">Source Type</label>
          <select id="source-type" bind:value={sourceType}>
            <option value="paste">Manual Paste</option>
            <option value="api" disabled>API (Coming Soon)</option>
          </select>
        </div>

        <div class="form-group">
          <label for="data-schema">Data Schema (optional)</label>
          <textarea
            id="data-schema"
            bind:value={dataSchema}
            placeholder="Describe the expected data structure"
            rows="3"
          ></textarea>
        </div>
      </div>

      <div class="form-section">
        <div class="section-header">
          <h3>Rules</h3>
          <button type="button" onclick={addRule} class="btn-primary">
            + Add Rule
          </button>
        </div>

        {#if rules.length === 0}
          <div class="empty-state">
            <p>No rules configured.</p>
            <p>Add a rule to define what data to display and how to evaluate it.</p>
          </div>
        {:else}
          <div class="rules-list">
            {#each rules as rule, index}
              <div class="rule-card" class:expanded={editingRuleIndex === index}>
                <div class="rule-header" onclick={() => editingRuleIndex = editingRuleIndex === index ? null : index}>
                  <span class="rule-number">{index + 1}</span>
                  <span class="rule-title">{rule.title_template || 'Untitled Rule'}</span>
                  <span class="rule-severity severity-{rule.severity}">{rule.severity}</span>
                  <div class="rule-controls">
                    <button type="button" onclick={(e) => { e.stopPropagation(); moveRuleUp(index); }} disabled={index === 0} title="Move up">
                      ↑
                    </button>
                    <button type="button" onclick={(e) => { e.stopPropagation(); moveRuleDown(index); }} disabled={index === rules.length - 1} title="Move down">
                      ↓
                    </button>
                    <button type="button" onclick={(e) => { e.stopPropagation(); deleteRule(index); }} class="btn-delete" title="Delete">
                      ×
                    </button>
                  </div>
                </div>

                {#if editingRuleIndex === index}
                  <div class="rule-editor">
                    <div class="form-group">
                      <label>Section</label>
                      <input type="text" bind:value={rule.section} placeholder="Section name" />
                    </div>

                    <div class="form-group">
                      <label>Rule Type</label>
                      <select bind:value={rule.iterate_over}>
                        <option value={null}>Aggregate Metric (single result)</option>
                        <option value="$.items">Detail Filter (multiple results from $.items)</option>
                      </select>
                      <small>Aggregate: evaluate once. Detail: iterate over array items.</small>
                    </div>

                    <div class="form-group">
                      <label>Condition (RPN Expression)</label>
                      <input
                        type="text"
                        bind:value={rule.condition}
                        placeholder="e.g., count 10 >"
                      />
                      <small>Stack-based expression. Example: "count 10 >" means count > 10</small>
                    </div>

                    <div class="form-group">
                      <label>Title Template</label>
                      <input
                        type="text"
                        bind:value={rule.title_template}
                        placeholder="Use {'{'}field{'}'} for interpolation"
                      />
                    </div>

                    <div class="form-group">
                      <label>Value Template (optional)</label>
                      <input
                        type="text"
                        bind:value={rule.value_template}
                        placeholder="Primary value to display"
                      />
                    </div>

                    <div class="form-group">
                      <label>Severity</label>
                      <select bind:value={rule.severity}>
                        <option value="info">Info</option>
                        <option value="warning">Warning</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="form-actions">
        <a href="/series/{seriesId}/scorecards/{scorecardId}" class="btn-secondary">
          Cancel
        </a>
        <button type="submit" disabled={saving} class="btn-primary">
          {saving ? 'Saving...' : 'Save Datasource'}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .datasource-editor {
    padding: 1.5rem;
    max-width: 900px;
    margin: 0 auto;
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .editor-header h2 {
    margin: 0;
    font-size: 1.75rem;
  }

  .error-message {
    padding: 0.75rem;
    background-color: #fee;
    border: 1px solid #fcc;
    border-radius: 4px;
    color: #c33;
    margin-bottom: 1rem;
  }

  .loading {
    text-align: center;
    padding: 3rem;
    color: #666;
  }

  .form-section {
    background-color: #f8f9fa;
    border-radius: 6px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .form-section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.25rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .section-header h3 {
    margin: 0;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.25rem;
    font-weight: 500;
  }

  .form-group input,
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-family: inherit;
    font-size: 1rem;
  }

  .form-group small {
    display: block;
    margin-top: 0.25rem;
    color: #666;
    font-size: 0.875rem;
  }

  .form-group textarea {
    resize: vertical;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: #666;
    border: 1px dashed #ccc;
    border-radius: 6px;
  }

  .empty-state p {
    margin: 0.5rem 0;
  }

  .rules-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .rule-card {
    border: 1px solid #ddd;
    border-radius: 6px;
    background-color: #fff;
    overflow: hidden;
  }

  .rule-card.expanded {
    border-color: #007bff;
  }

  .rule-header {
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    user-select: none;
  }

  .rule-header:hover {
    background-color: #f8f9fa;
  }

  .rule-number {
    font-weight: 600;
    color: #666;
    min-width: 1.5rem;
  }

  .rule-title {
    flex: 1;
    font-weight: 500;
  }

  .rule-severity {
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .severity-info {
    background-color: #d1ecf1;
    color: #0c5460;
  }

  .severity-warning {
    background-color: #fff3cd;
    color: #856404;
  }

  .severity-critical {
    background-color: #f8d7da;
    color: #721c24;
  }

  .rule-controls {
    display: flex;
    gap: 0.25rem;
  }

  .rule-controls button {
    padding: 0.25rem 0.5rem;
    border: 1px solid #ddd;
    background-color: white;
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .rule-controls button:hover:not(:disabled) {
    background-color: #f8f9fa;
  }

  .rule-controls button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .rule-controls .btn-delete {
    color: #dc3545;
    font-weight: bold;
  }

  .rule-editor {
    padding: 1rem;
    border-top: 1px solid #ddd;
    background-color: #f8f9fa;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding-top: 1rem;
  }

  .btn-primary,
  .btn-secondary {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    display: inline-block;
  }

  .btn-primary {
    background-color: #007bff;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #0056b3;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background-color: #6c757d;
    color: white;
  }

  .btn-secondary:hover {
    background-color: #545b62;
  }
</style>
