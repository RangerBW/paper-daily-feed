import { readFileSync } from "node:fs";

import { describe, expect, it } from "bun:test";

describe("daily paper feeds workflow", () => {
  it("does not load or persist a daily quotation cache", () => {
    const workflow = readFileSync(".github/workflows/daily.yml", "utf8");

    expect(workflow).not.toContain(".daily-romance.json");
    expect(workflow).toContain("group: paper-daily-feed-state");
    expect(workflow).not.toContain("daily-romance-transformers");
  });

  it("updates delivery history without replacing the live Actions checkout", () => {
    const workflow = readFileSync(".github/workflows/daily.yml", "utf8");
    const saveHistoryStep = workflow.slice(workflow.indexOf("- name: Save delivery history"));

    expect(saveHistoryStep).toContain("git worktree add");
    expect(saveHistoryStep).toContain('git -C "${state_worktree}"');
    expect(saveHistoryStep).not.toMatch(/^\s+git switch /m);
  });
});
