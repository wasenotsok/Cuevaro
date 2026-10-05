import { it, expect } from "vitest";
import {
  updateAttention,
  type AttentionRecord,
} from "../packages/domain/attention";
const record = (): AttentionRecord => ({
  version: 1,
  events: [
    {
      kind: "return",
      status: "active",
      dueDate: "2026-10-19",
      timezone: "Asia/Manila",
      sourceFactIds: ["a", "b"],
      ruleVersion: "v1",
    },
  ],
  cues: [
    {
      id: "cue",
      kind: "return",
      dueDate: "2026-10-19",
      scheduledFor: "2026-10-12",
      state: "scheduled",
    },
  ],
});
it("dismiss does not delete underlying event and snooze has bounded date semantics", () => {
  const r = record();
  expect(
    updateAttention(r, { type: "dismiss", cueId: "cue" }, 1, "2026-10-05")
      .events[0].status,
  ).toBe("active");
  const snoozed = updateAttention(
    r,
    { type: "snooze", cueId: "cue", date: "2026-10-14" },
    1,
    "2026-10-05",
  );
  expect(snoozed.cues[0].scheduledFor).toBe("2026-10-14");
  expect(r.cues[0].scheduledFor).toBe("2026-10-12");
  for (const date of ["2026-02-30", "2026-10-01", "2026-10-20"])
    expect(() =>
      updateAttention(
        r,
        { type: "snooze", cueId: "cue", date },
        1,
        "2026-10-05",
      ),
    ).toThrow("INVALID_SNOOZE_DATE");
});
it("closing lifecycle cancels reminder occurrences and refuses stale/foreign commands", () => {
  const r = record(),
    closed = updateAttention(
      r,
      { type: "stop", kind: "return" },
      1,
      "2026-10-05",
    );
  expect(closed.events[0].status).toBe("not_applicable");
  expect(closed.cues[0].state).toBe("cancelled");
  expect(closed.version).toBe(2);
  expect(() =>
    updateAttention(closed, { type: "stop", kind: "return" }, 1, "2026-10-05"),
  ).toThrow("STATE_CONFLICT");
  expect(() =>
    updateAttention(r, { type: "dismiss", cueId: "foreign" }, 1, "2026-10-05"),
  ).toThrow("INVALID_CUE");
});
