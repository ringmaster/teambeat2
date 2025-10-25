import { Resend } from "resend";
import type { EmailAdapter } from "../adapter";

export class ResendAdapter implements EmailAdapter {
	private resend: Resend;

	constructor() {
		const apiKey = process.env.RESEND_API_KEY;
		if (!apiKey) {
			throw new Error("RESEND_API_KEY environment variable required");
		}
		this.resend = new Resend(apiKey);
	}

	async send({
		to,
		subject,
		html,
		from,
	}): Promise<{ success: boolean; error?: string }> {
		try {
			const response = await this.resend.emails.send({
				from:
					from || process.env.RESEND_FROM || "TeamBeat <noreply@teambeat.dev>",
				to,
				subject,
				html,
			});
			console.log("Resend send email response:", response);
			return { success: true };
		} catch (error) {
			console.error("Resend send error:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}
}
