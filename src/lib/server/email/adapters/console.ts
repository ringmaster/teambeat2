import type { EmailAdapter } from "../adapter";

export class ConsoleAdapter implements EmailAdapter {
	async send({ to, subject, html, from }): Promise<{ success: boolean }> {
		console.log("=".repeat(80));
		console.log("📧 EMAIL (Console Adapter - Development Mode)");
		console.log("=".repeat(80));
		console.log(`From: ${from || "noreply@teambeat.app"}`);
		console.log(`To: ${to}`);
		console.log(`Subject: ${subject}`);
		console.log("-".repeat(80));
		console.log(html);
		console.log("=".repeat(80));
		return { success: true };
	}
}
