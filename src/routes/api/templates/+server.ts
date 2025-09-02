import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTemplateList } from '$lib/server/templates.js';

export const GET: RequestHandler = async () => {
	const templates = getTemplateList();

	return json({
		success: true,
		templates
	});
};