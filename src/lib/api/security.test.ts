import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkRateLimit,
  parseBlendSlug,
  parseLetterboxdUsername,
  parseParticipantSlot,
} from "@/lib/api/security";

describe("api security validation", () => {
  it("accepts valid blend slugs", () => {
    assert.equal(parseBlendSlug("m6pfm6fC9X"), "m6pfm6fC9X");
  });

  it("rejects malformed blend slugs", () => {
    assert.equal(parseBlendSlug("../etc/passwd"), null);
    assert.equal(parseBlendSlug("a"), null);
    assert.equal(parseBlendSlug("slug with spaces"), null);
  });

  it("accepts valid Letterboxd usernames", () => {
    assert.equal(parseLetterboxdUsername("bwhome"), "bwhome");
    assert.equal(parseLetterboxdUsername("user_name-1"), "user_name-1");
  });

  it("rejects invalid Letterboxd usernames", () => {
    assert.equal(parseLetterboxdUsername("user name"), null);
    assert.equal(parseLetterboxdUsername("<script>"), null);
    assert.equal(parseLetterboxdUsername("a".repeat(40)), null);
  });

  it("validates participant slots", () => {
    assert.equal(parseParticipantSlot(1), 1);
    assert.equal(parseParticipantSlot(2), 2);
    assert.equal(parseParticipantSlot(3), null);
    assert.equal(parseParticipantSlot("1"), null);
  });

  it("blocks requests after the rate limit is exceeded", () => {
    const rule = { id: "test", limit: 2, windowMs: 60_000 };
    assert.equal(checkRateLimit("127.0.0.1", rule).allowed, true);
    assert.equal(checkRateLimit("127.0.0.1", rule).allowed, true);
    assert.equal(checkRateLimit("127.0.0.1", rule).allowed, false);
  });
});
