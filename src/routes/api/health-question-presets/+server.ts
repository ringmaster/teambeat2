import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPresetMetadata } from '$lib/presets/health-question-sets';

export const GET: RequestHandler = async () => {
  try {
    const presets = getPresetMetadata();

    return json({
      success: true,
      presets
    });
  } catch (error) {
    console.error('Failed to fetch health question presets:', error);
    return json(
      { success: false, error: 'Failed to fetch health question presets' },
      { status: 500 }
    );
  }
};
