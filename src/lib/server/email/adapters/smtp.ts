import nodemailer from "nodemailer";
import type { EmailAdapter } from "../adapter";

export class SMTPAdapter implements EmailAdapter {
	private transporter;

	constructor() {
		this.transporter = nodemailer.createTransport({
			host: process.env.SMTP_HOST,
			port: parseInt(process.env.SMTP_PORT || "587", 10),
			secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
			auth: {
				user: process.env.SMTP_USER,
				pass: process.env.SMTP_PASS,
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
			await this.transporter.sendMail({
				from: from || process.env.SMTP_FROM || "noreply@teambeat.app",
				to,
				subject,
				html,
			});
			return { success: true };
		} catch (error) {
			console.error("SMTP send error:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}
}
