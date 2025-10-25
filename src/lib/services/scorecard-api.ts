/**
 * Scorecard API Service
 * Centralized API calls for scorecard and datasource operations
 */

import type {
	Scorecard,
	ScorecardDatasource,
	ScorecardRule,
} from "$lib/types/scorecard";

export interface ScorecardListResponse {
	success: boolean;
	scorecards: Scorecard[];
	error?: string;
}

export interface ScorecardDetailResponse {
	success: boolean;
	scorecard: Scorecard;
	error?: string;
}

export interface DatasourceDetailResponse {
	success: boolean;
	datasource: ScorecardDatasource;
	error?: string;
}

export interface SuccessResponse {
	success: boolean;
	error?: string;
}

/**
 * Scorecard Operations
 */

export async function listScorecards(
	seriesId: string,
): Promise<ScorecardListResponse> {
	const response = await fetch(`/api/series/${seriesId}/scorecards`);
	return await response.json();
}

export async function getScorecardDetail(
	seriesId: string,
	scorecardId: string,
): Promise<ScorecardDetailResponse> {
	const response = await fetch(
		`/api/series/${seriesId}/scorecards/${scorecardId}`,
	);
	return await response.json();
}

export async function createScorecard(
	seriesId: string,
	name: string,
	description?: string | null,
): Promise<ScorecardDetailResponse> {
	const response = await fetch(`/api/series/${seriesId}/scorecards`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name, description: description || null }),
	});
	return await response.json();
}

export async function updateScorecard(
	seriesId: string,
	scorecardId: string,
	name: string,
	description?: string | null,
): Promise<ScorecardDetailResponse> {
	const response = await fetch(
		`/api/series/${seriesId}/scorecards/${scorecardId}`,
		{
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name, description: description || null }),
		},
	);
	return await response.json();
}

export async function deleteScorecard(
	seriesId: string,
	scorecardId: string,
): Promise<SuccessResponse> {
	const response = await fetch(
		`/api/series/${seriesId}/scorecards/${scorecardId}`,
		{
			method: "DELETE",
		},
	);
	return await response.json();
}

/**
 * Datasource Operations
 */

export async function getDatasourceDetail(
	scorecardId: string,
	datasourceId: string,
): Promise<DatasourceDetailResponse> {
	const response = await fetch(
		`/api/scorecards/${scorecardId}/datasources/${datasourceId}`,
	);
	return await response.json();
}

export async function createDatasource(
	scorecardId: string,
	name: string,
	sourceType: "paste" | "api" = "paste",
): Promise<DatasourceDetailResponse> {
	const response = await fetch(`/api/scorecards/${scorecardId}/datasources`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			name,
			source_type: sourceType,
			data_schema: null,
			rules: [],
			api_config: null,
		}),
	});
	return await response.json();
}

export async function updateDatasource(
	scorecardId: string,
	datasourceId: string,
	data: {
		name: string;
		data_schema: string | null;
		rules: ScorecardRule[];
		api_config?: any | null;
	},
): Promise<DatasourceDetailResponse> {
	const response = await fetch(
		`/api/scorecards/${scorecardId}/datasources/${datasourceId}`,
		{
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: data.name,
				data_schema: data.data_schema,
				rules: data.rules,
				api_config: data.api_config || null,
			}),
		},
	);
	return await response.json();
}

export async function deleteDatasource(
	scorecardId: string,
	datasourceId: string,
): Promise<SuccessResponse> {
	const response = await fetch(
		`/api/scorecards/${scorecardId}/datasources/${datasourceId}`,
		{
			method: "DELETE",
		},
	);
	return await response.json();
}

export async function reorderDatasources(
	scorecardId: string,
	datasourceIds: string[],
): Promise<SuccessResponse> {
	const response = await fetch(
		`/api/scorecards/${scorecardId}/datasources/reorder`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ datasource_ids: datasourceIds }),
		},
	);
	return await response.json();
}

/**
 * Scene Scorecard Operations
 */

export async function getSceneScorecards(sceneId: string): Promise<any> {
	const response = await fetch(`/api/scenes/${sceneId}/scorecards`);
	if (!response.ok) {
		throw new Error(`Failed to fetch scene scorecards: ${response.statusText}`);
	}
	return await response.json();
}

export async function attachScorecard(
	sceneId: string,
	scorecardId: string,
): Promise<SuccessResponse> {
	const response = await fetch(`/api/scenes/${sceneId}/scorecards`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ scorecard_id: scorecardId }),
	});
	return await response.json();
}

export async function detachScorecard(
	sceneScorecardId: string,
): Promise<SuccessResponse> {
	const response = await fetch(`/api/scene-scorecards/${sceneScorecardId}`, {
		method: "DELETE",
	});
	return await response.json();
}
