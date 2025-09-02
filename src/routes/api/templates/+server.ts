import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const templates = [
		{
			id: 'basic',
			name: 'Basic Retrospective',
			description: 'A simple retrospective with what went well, what could be improved, and action items.',
			columns: ['What went well?', 'What could be improved?', 'Action items'],
			scenes: 3
		},
		{
			id: 'kafe',
			name: 'KAFE (Keep, Add, Fix, Explore)',
			description: 'A structured approach focusing on what to keep, add, fix, and explore.',
			columns: ['Keep (What should we continue doing?)', 'Add (What should we start doing?)', 'Fix (What should we stop or change?)', 'Explore (What should we investigate?)'],
			scenes: 4
		},
		{
			id: 'startstop',
			name: 'Start, Stop, Continue',
			description: 'Focus on behaviors to start, stop, and continue for the next iteration.',
			columns: ['Start (What should we begin doing?)', 'Stop (What should we cease doing?)', 'Continue (What should we keep doing?)'],
			scenes: 3
		},
		{
			id: 'madsadglad',
			name: 'Mad, Sad, Glad',
			description: 'An emotional retrospective focusing on feelings and reactions.',
			columns: ['Mad (What frustrated us?)', 'Sad (What disappointed us?)', 'Glad (What made us happy?)'],
			scenes: 3
		},
		{
			id: 'fourls',
			name: "4 L's (Liked, Learned, Lacked, Longed for)",
			description: 'A comprehensive reflection on the four L\'s of team experience.',
			columns: ['Liked (What did we enjoy?)', 'Learned (What did we discover?)', 'Lacked (What was missing?)', 'Longed for (What did we wish for?)'],
			scenes: 4
		},
		{
			id: 'leancoffee',
			name: 'Lean Coffee',
			description: 'A democratic discussion format where topics are proposed, voted on, and discussed.',
			columns: ['Topics to Discuss', 'Currently Discussing', 'Discussed'],
			scenes: 3
		}
	];

	return json({
		success: true,
		templates
	});
};