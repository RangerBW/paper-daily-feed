import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("maintenance workflow guidance", () => {
  it("explains how to configure workflow-file sync when workflow updates are skipped", () => {
    const workflow = readFileSync(".github/workflows/maintenance.yml", "utf8");

    expect(workflow).toContain("To also sync workflow files:");
    expect(workflow).toContain("1. Open https://github.com/settings/personal-access-tokens/new");
    expect(workflow).toContain("2. Create a fine-grained token scoped to this fork with Contents and Workflows read/write.");
    expect(workflow).toContain("3. Open https://github.com/${GITHUB_REPOSITORY}/settings/secrets/actions/new");
    expect(workflow).toContain("4. Save the token as an Actions secret named MAINTENANCE_SYNC_TOKEN.");
  });
});
