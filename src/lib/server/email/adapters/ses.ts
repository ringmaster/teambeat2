import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import type { EmailAdapter } from "../adapter";

export class SESAdapter implements EmailAdapter {
	private client: SESClient;

	constructor() {
		this.client = new SESClient({
			region: process.env.AWS_REGION || "us-east-1",
			credentials: {
				accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
			},
		});
	}

	async send({
		to,
		subject,
		html,
		from,
	}): Promise<{ success: boolean; error?: string }> {
		try {
			const command = new SendEmailCommand({
				Source: from || process.env.SES_FROM || "noreply@teambeat.app",
				Destination: { ToAddresses: [to] },
				Message: {
					Subject: { Data: subject },
					Body: { Html: { Data: html } },
				},
			});

			await this.client.send(command);
			return { success: true };
		} catch (error) {
			console.error("SES send error:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}
}
