import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("maintenance workflow guidance", () => {
  it("explains how to configure workflow-file sync when workflow updates are skipped", () => {
    const workflow = readFileSync(".github/workflows/maintenance.yml", "utf8");

    expect(workflow).toContain("### What to do next");
    expect(workflow).toContain("1. Open this token page: https://github.com/settings/personal-access-tokens/new");
    expect(workflow).toContain("3. Give the token these repository permissions: **Contents: Read and write** and **Workflows: Read and write**.");
    expect(workflow).toContain("6. Set **Name** to \\`MAINTENANCE_SYNC_TOKEN\\`.");
    expect(workflow).toContain("9. Click **Run workflow**.");
    expect(workflow).toContain("Expected result: the next run says **Auto-sync completed** and your fork \\`main\\` has no extra sync commit.");
  });

  it("rebases fork commits on top of upstream when users customize main", () => {
    const workflow = readFileSync(".github/workflows/maintenance.yml", "utf8");

    expect(workflow).toContain("git merge-base --is-ancestor upstream/main origin/main");
    expect(workflow).toContain("git rebase upstream/main");
    expect(workflow).toContain("with your custom commits replayed on top");
  });
});
