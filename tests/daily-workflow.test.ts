import { readFileSync } from "node:fs";

import { describe, expect, it } from "bun:test";

describe("daily paper feeds workflow", () => {
  it("updates delivery history without replacing the live Actions checkout", () => {
    const workflow = readFileSync(".github/workflows/daily.yml", "utf8");
    const saveHistoryStep = workflow.slice(workflow.indexOf("- name: Save delivery history"));

    expect(saveHistoryStep).toContain("git worktree add");
    expect(saveHistoryStep).toContain('git -C "${state_worktree}"');
    expect(saveHistoryStep).not.toMatch(/^\s+git switch /m);
  });
});
