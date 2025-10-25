export interface EmailAdapter {
	send(params: {
		to: string;
		subject: string;
		html: string;
		from?: string;
	}): Promise<{ success: boolean; error?: string }>;
}
