import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
	resolve: { alias: { $lib: path.resolve('./src/lib'), '$env/dynamic/private': path.resolve('./src/lib/production/test-env.ts'), '$env/static/public': path.resolve('./src/lib/production/test-env.ts'), '$env/dynamic/public': path.resolve('./src/lib/production/test-env.ts'), '$app/forms': path.resolve('./src/lib/production/test-env.ts'), '$app/navigation': path.resolve('./src/lib/production/test-env.ts'), '$app/state': path.resolve('./src/lib/production/test-env.ts') } },
	test: { include: ['src/**/*.test.ts'], environment: 'node', testTimeout: 60000 }
});
