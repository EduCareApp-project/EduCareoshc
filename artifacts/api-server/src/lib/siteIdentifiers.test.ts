import { describe, expect, it } from "vitest";
import { isDuplicateSiteIdentifier, normalizeSiteIdentifierBody } from "./siteIdentifiers";

describe("Manual, company-scoped site identifiers", () => {
  it("normalizes a supplied code without assigning a missing code", () => {
    expect(normalizeSiteIdentifierBody({ name: "Service" })).toEqual({ name: "Service" });
    expect(normalizeSiteIdentifierBody({ identifier: "  " })).toEqual({ identifier: null });
    expect(normalizeSiteIdentifierBody({ identifier: " abc " })).toEqual({ identifier: "ABC" });
  });
  it("recognizes a collision within a company without treating other errors as collisions", () => {
    expect(isDuplicateSiteIdentifier({ cause: { code: "23505", constraint: "sites_organisation_identifier_unique" } })).toBe(true);
    expect(isDuplicateSiteIdentifier({ code: "23505", constraint: "sites_identifier_unique" })).toBe(true);
    expect(isDuplicateSiteIdentifier({ code: "23505", constraint: "different_constraint" })).toBe(false);
    expect(isDuplicateSiteIdentifier(null)).toBe(false);
  });
});
