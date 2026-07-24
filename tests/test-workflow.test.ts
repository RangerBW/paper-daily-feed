import { readFileSync } from "node:fs";

import { describe, expect, it } from "bun:test";

describe("test paper feeds workflow", () => {
  it("runs the recommendation feed with SMTP delivery enabled", () => {
    const workflow = readFileSync(".github/workflows/test.yml", "utf8");

    expect(workflow).toContain("Run recommendation feed in test mode");
    expect(workflow).toContain("RUNTIME_DEBUG: false");
    expect(workflow).toContain("uses: ./.github/actions/setup-bun");
    expect(workflow).toContain("run: bun src/index.ts run");
  });

  it("centralizes the pinned Bun runtime and frozen install", () => {
    const setupAction = readFileSync(".github/actions/setup-bun/action.yml", "utf8");
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      packageManager?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      engines?: Record<string, string>;
    };
    const bunfig = readFileSync("bunfig.toml", "utf8");
    const workflows = ["ci", "daily", "maintenance", "release", "test"].map((name) =>
      readFileSync(`.github/workflows/${name}.yml`, "utf8")
    );

    const bunVersion = packageJson.packageManager?.match(/^bun@(\d+\.\d+\.\d+)$/)?.[1];
    expect(bunVersion).toBeDefined();
    expect(packageJson.devDependencies?.["@types/bun"]).toBe(`^${bunVersion}`);
    expect(packageJson.engines).toBeUndefined();
    expect(packageJson.dependencies).not.toHaveProperty("js-yaml");
    expect(packageJson.devDependencies).not.toHaveProperty("@types/js-yaml");
    expect(setupAction).toContain(`run: npm install -g bun@${bunVersion}`);
    expect(setupAction).not.toContain("uses: oven-sh/setup-bun");
    expect(setupAction).not.toContain("bun-version:");
    expect(setupAction).not.toContain("bun pm cache");
    expect(setupAction).not.toContain("actions/cache");
    expect(setupAction).toContain("ONNXRUNTIME_NODE_INSTALL: skip");
    expect(setupAction).toContain("run: bun ci");
    expect(bunfig).toContain('auto = "disable"');

    for (const workflow of workflows) {
      expect(workflow).toContain("uses: ./.github/actions/setup-bun");
      expect(workflow).not.toContain("actions/setup-node");
      expect(workflow).not.toMatch(/\bnpm\b/);
    }
  });
});
