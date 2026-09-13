import { defineConfig, devices } from "@playwright/test";

// "Small" and "large" here mirror this app's own xs/sm MUI breakpoint split
// (see the {xs:...,sm:...} responsive props throughout src/) rather than
// picking arbitrary device presets - 375 sits below the sm breakpoint,
// 1440 comfortably above it.
export default defineConfig({
    testDir: "./e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: "list",
    use: {
        baseURL: "http://localhost:5183",
        trace: "retain-on-failure",
    },
    projects: [
        {
            name: "iphone-se",
            use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 667 } },
        },
        {
            name: "small",
            use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } },
        },
        {
            name: "large",
            use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
        },
    ],
    webServer: {
        command: "node_modules/.bin/vite --port 5183",
        url: "http://localhost:5183",
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
    },
});
