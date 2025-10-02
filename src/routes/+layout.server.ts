import type { LayoutServerLoad } from './$types';
import { version } from '../../package.json';

export const load: LayoutServerLoad = async () => {
	return {
		version
	};
};
