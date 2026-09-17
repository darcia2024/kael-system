import assert from "node:assert/strict";
import { feedbackDateIso } from "./src/lib/feedback-date";

const expected = "2026-09-17T06:00:00.000Z";
for (const input of [new Date(expected), expected, "2026-09-17T13:00:00+07:00"]) {
  assert.equal(feedbackDateIso(input), expected);
  assert.equal(feedbackDateIso(input).slice(0, 10), "2026-09-17");
}
for (const input of [null, undefined, "", "invalid", new Date(NaN), {}, 123]) {
  assert.equal(feedbackDateIso(input), "");
}
console.log("Feedback date regression checks passed.");
