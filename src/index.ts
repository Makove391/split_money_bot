import { createWebhookHandler } from "./bot";

export default {
	async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
		const handler = createWebhookHandler(env);
		return handler(request);
	},
} satisfies ExportedHandler<Env>;
