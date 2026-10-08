import { it, expect } from "vitest";
import {
  expectedDenial,
  requireExpectedDenial,
} from "../scripts/managed-probe-denial";
it("real API probe denial evidence rejects outages, invalid requests and empty responses", () => {
  for (const error of [
    null,
    undefined,
    new Error("Network unavailable"),
    { status: 503, statusCode: 503 },
    { statusCode: 400 },
    { statusCode: 401 },
    { code: "PGRST301" },
    { statusCode: "500" },
  ])
    expect(expectedDenial(error, "storage")).toBe(false);
  expect(expectedDenial({ statusCode: "404" }, "storage")).toBe(true);
  expect(expectedDenial({ statusCode: 403 }, "storage")).toBe(true);
  expect(expectedDenial({ status: 401 }, "auth")).toBe(true);
  expect(expectedDenial({ status: 503 }, "auth")).toBe(false);
  expect(expectedDenial({ code: "42501" }, "database")).toBe(true);
  expect(expectedDenial({ code: "08006" }, "database")).toBe(false);
  expect(() => requireExpectedDenial(null, "storage")).toThrow(
    "API_DENIAL_INCONCLUSIVE",
  );
});
