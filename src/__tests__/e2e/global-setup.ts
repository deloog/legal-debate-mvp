import { FullConfig } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function globalSetup(_config: FullConfig): Promise<void> {
  console.log("🚀 Starting E2E test global setup...");
  console.log("📊 Waiting for application to be ready...");

  // Playwright will automatically start of web server as configured
  // No additional setup needed for now

  console.log("✅ E2E test global setup completed");
}

export default globalSetup;
