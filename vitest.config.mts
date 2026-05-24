import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: "./wrangler.jsonc" },
				miniflare: {
					bindings: {
						BOT_TOKEN: "test-token",
						BOT_INFO: JSON.stringify({ id: 1, is_bot: true, first_name: "Test", username: "test_bot" }),
						WEBHOOK_SECRET: "test-secret",
					},
				},
			},
		},
	},
});
