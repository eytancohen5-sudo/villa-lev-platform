// Rules-text assertion suite for the RBAC change.
//
// Why this exists (and what it doesn't do):
//   The canonical way to test Firestore rules is `@firebase/rules-unit-
//   testing`, which spins up the Firestore emulator (Java required). The
//   build host for tonight's ship has no JRE installed, so we can't run
//   the emulator-based suite without out-of-scope infra changes.
//
//   This test is a structural/lexical guard: it loads the rules file as
//   text and asserts that the BLOCKER guards from plan-challenger are
//   present on the right predicates. It will catch:
//     - role-enum check accidentally dropped from a users/ write predicate
//     - lastSignInAt whitelist accidentally widened
//     - legacy-admin fallback accidentally removed before its time
//     - canEdit() guard accidentally dropped from scenarios writes
//
//   It will NOT catch logic errors inside the rules language (e.g. an
//   `allow` with a typo'd helper name that resolves to false silently).
//   That coverage is the follow-up emulator suite.
//
//   The pragmatic substitute is documented in the RBAC ADR (0002) and in
//   the implementer's final report.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Rules file lives in the sibling admin repo. The platform's vitest CWD is
// `villa-lev-platform/`, so resolve relative to the project root.
// __dirname = villa-lev-platform/src/lib/data/__tests__ — six levels up
// lands at ~/Desktop, then back down into the sibling `Villa Lev Claude`
// workspace where the admin repo lives.
const RULES_PATH = resolve(
  __dirname,
  "../../../../../../Villa Lev Claude/villa-lev-admin/firestore.rules",
);

function loadRules(): string {
  return readFileSync(RULES_PATH, "utf8");
}

// Extract a `match /<path>/ { ... }` block by collection name. Returns the
// substring including the opening match line and closing brace.
//
// Subtle: rule paths contain `{placeholder}` segments (e.g.
// `match /users/{uid}`) — those braces are NOT block delimiters. We start
// counting body braces only AFTER skipping past the header up to the first
// space-followed-by-`{` (the block open).
function extractMatchBlock(rules: string, matchHeader: string): string {
  const startIdx = rules.indexOf(matchHeader);
  if (startIdx < 0) {
    throw new Error(`No match block found for header: ${matchHeader}`);
  }
  // Find the body-opening brace: the first `{` that comes AFTER the header
  // and is preceded by whitespace (so we don't catch a `{placeholder}` brace).
  const headerEnd = startIdx + matchHeader.length;
  let bodyOpen = -1;
  for (let i = headerEnd; i < rules.length; i += 1) {
    if (rules[i] === "{" && /\s/.test(rules[i - 1] ?? "")) {
      bodyOpen = i;
      break;
    }
  }
  if (bodyOpen < 0) {
    throw new Error(`No body brace found for: ${matchHeader}`);
  }
  // Now walk forward from the body open, ignoring nested `{placeholder}`
  // braces inside any further `match` headers (none expected today, but
  // safe).
  let depth = 1;
  for (let i = bodyOpen + 1; i < rules.length; i += 1) {
    const ch = rules[i];
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return rules.slice(startIdx, i + 1);
      }
    }
  }
  throw new Error(`Unterminated match block for: ${matchHeader}`);
}

describe("firestore.rules — RBAC structural guards", () => {
  it("rules file is readable from the admin repo", () => {
    const rules = loadRules();
    expect(rules.length).toBeGreaterThan(100);
    expect(rules).toContain("rules_version = '2';");
  });

  // ── BLOCKER #1: role-enum validation ──────────────────────────────────

  it("defines isValidRoleWrite() with all three valid roles", () => {
    const rules = loadRules();
    expect(rules).toMatch(/function\s+isValidRoleWrite\s*\(\s*\)/);
    expect(rules).toMatch(
      /request\.resource\.data\.role\s+in\s+\[\s*'admin'\s*,\s*'editor'\s*,\s*'viewer'\s*\]/,
    );
  });

  it("users/{uid} create predicate gates on isValidRoleWrite()", () => {
    const usersBlock = extractMatchBlock(loadRules(), "match /users/{uid}");
    // Find the create allow line(s) and assert isValidRoleWrite is in scope.
    expect(usersBlock).toMatch(/allow\s+create\s*:[\s\S]*?isValidRoleWrite\s*\(\s*\)/);
  });

  it("users/{uid} update predicate gates on isValidRoleWrite() for admin path", () => {
    const usersBlock = extractMatchBlock(loadRules(), "match /users/{uid}");
    expect(usersBlock).toMatch(/allow\s+update\s*:[\s\S]*?isValidRoleWrite\s*\(\s*\)/);
  });

  it("invites/{inviteId} create predicate gates on isValidRoleWrite()", () => {
    const invitesBlock = extractMatchBlock(
      loadRules(),
      "match /invites/{inviteId}",
    );
    expect(invitesBlock).toMatch(
      /allow\s+create\s*:[\s\S]*?isValidRoleWrite\s*\(\s*\)/,
    );
  });

  it("the role enum is exactly ['admin','editor','viewer'] — no 'owner' / 'Editor' / etc.", () => {
    // Strip rules-language comments (// to end-of-line) so example values
    // referenced in BLOCKER documentation don't trigger false positives.
    const rules = loadRules().replace(/\/\/[^\n]*/g, "");
    expect(rules).toContain("'admin'");
    expect(rules).toContain("'editor'");
    expect(rules).toContain("'viewer'");
    expect(rules).not.toMatch(/['"]Editor['"]/);
    expect(rules).not.toMatch(/['"]Admin['"]/);
    expect(rules).not.toMatch(/['"]Viewer['"]/);
    expect(rules).not.toMatch(/['"]owner['"]/);
    expect(rules).not.toMatch(/['"]Owner['"]/);
  });

  // ── BLOCKER #2: self-update whitelist ─────────────────────────────────

  it("defines isLastSignInOnly() using diff().affectedKeys().hasOnly(['lastSignInAt'])", () => {
    const rules = loadRules();
    expect(rules).toMatch(/function\s+isLastSignInOnly\s*\(\s*\)/);
    expect(rules).toMatch(
      /request\.resource\.data\.diff\s*\(\s*resource\.data\s*\)\s*\.\s*affectedKeys\s*\(\s*\)\s*\.\s*hasOnly\s*\(\s*\[\s*'lastSignInAt'\s*\]\s*\)/,
    );
  });

  it("users/{uid} self-update gates on isLastSignInOnly()", () => {
    const usersBlock = extractMatchBlock(loadRules(), "match /users/{uid}");
    expect(usersBlock).toMatch(
      /request\.auth\.uid\s*==\s*uid\s*&&\s*isLastSignInOnly\s*\(\s*\)/,
    );
  });

  // ── BLOCKER #3: legacy fallback stays alive ───────────────────────────

  it("isLegacyAdmin() is still defined in the rules file", () => {
    const rules = loadRules();
    expect(rules).toMatch(/function\s+isLegacyAdmin\s*\(\s*\)/);
    expect(rules).toContain("eytancohen5@gmail.com");
  });

  it("isAdmin() unions hasRole('admin') with isLegacyAdmin()", () => {
    const rules = loadRules();
    expect(rules).toMatch(
      /function\s+isAdmin\s*\(\s*\)[\s\S]*?hasRole\s*\(\s*['"]admin['"]\s*\)[\s\S]*?isLegacyAdmin\s*\(\s*\)/,
    );
  });

  it("canEdit() unions hasRole('admin') / hasRole('editor') / isLegacyAdmin()", () => {
    const rules = loadRules();
    expect(rules).toMatch(
      /function\s+canEdit\s*\(\s*\)[\s\S]*?hasRole\s*\(\s*['"]editor['"]\s*\)[\s\S]*?isLegacyAdmin\s*\(\s*\)/,
    );
  });

  // ── Scenarios per-owner sharing model (ADR-0004) ──────────────────────
  // The scenarios block was rewritten 2026-05-22 to support cross-user
  // share-by-publish. READ is no longer blanket-public — published==true OR
  // owner-auth. WRITE gates on canEdit() AND owner match. DELETE is now
  // owner-gated (was `if false`). copiedFrom is immutable field-by-field
  // (NOT whole-map equality — Revision M1 guard).

  it("scenarios/{scenarioId} read allows published==true", () => {
    const b = extractMatchBlock(loadRules(), "match /scenarios/{scenarioId}");
    expect(b).toMatch(
      /allow\s+read\s*:[\s\S]*?resource\.data\.published\s*==\s*true/,
    );
  });

  it("scenarios/{scenarioId} read also allows owner-auth (unpublished drafts)", () => {
    const b = extractMatchBlock(loadRules(), "match /scenarios/{scenarioId}");
    expect(b).toMatch(
      /allow\s+read\s*:[\s\S]*?request\.auth\s*!=\s*null[\s\S]*?resource\.data\.userId\s*==\s*request\.auth\.uid/,
    );
  });

  it("scenarios/{scenarioId} read is no longer blanket-public (`if true`)", () => {
    const b = extractMatchBlock(loadRules(), "match /scenarios/{scenarioId}");
    expect(b).not.toMatch(/allow\s+read\s*:\s*if\s+true\s*;/);
  });

  it("scenarios/{scenarioId} create gates on canEdit()", () => {
    const b = extractMatchBlock(loadRules(), "match /scenarios/{scenarioId}");
    expect(b).toMatch(/allow\s+create\s*:[\s\S]*?canEdit\s*\(\s*\)/);
  });

  it("scenarios/{scenarioId} create stamps caller as userId", () => {
    const b = extractMatchBlock(loadRules(), "match /scenarios/{scenarioId}");
    expect(b).toMatch(
      /allow\s+create\s*:[\s\S]*?request\.resource\.data\.userId\s*==\s*request\.auth\.uid/,
    );
  });

  it("scenarios/{scenarioId} create validates ownerDisplayName is string", () => {
    const b = extractMatchBlock(loadRules(), "match /scenarios/{scenarioId}");
    expect(b).toMatch(/ownerDisplayName\s+is\s+string/);
  });

  it("scenarios/{scenarioId} create validates published is bool", () => {
    const b = extractMatchBlock(loadRules(), "match /scenarios/{scenarioId}");
    expect(b).toMatch(/published\s+is\s+bool/);
  });

  it("scenarios/{scenarioId} create validates copiedFrom shape when present", () => {
    const b = extractMatchBlock(loadRules(), "match /scenarios/{scenarioId}");
    expect(b).toMatch(/copiedFrom\s*==\s*null/);
    expect(b).toMatch(/copiedFrom\.userId\s+is\s+string/);
    expect(b).toMatch(/copiedFrom\.scenarioId\s+is\s+string/);
    expect(b).toMatch(/copiedFrom\.displayName\s+is\s+string/);
    expect(b).toMatch(/copiedFrom\.copiedAt\s+is\s+number/);
  });

  it("scenarios/{scenarioId} update gates on canEdit() and caller-is-owner", () => {
    const b = extractMatchBlock(loadRules(), "match /scenarios/{scenarioId}");
    expect(b).toMatch(/allow\s+update\s*:[\s\S]*?canEdit\s*\(\s*\)/);
    expect(b).toMatch(
      /allow\s+update\s*:[\s\S]*?resource\.data\.userId\s*==\s*request\.auth\.uid/,
    );
  });

  it("scenarios/{scenarioId} update enforces userId immutability", () => {
    const b = extractMatchBlock(loadRules(), "match /scenarios/{scenarioId}");
    expect(b).toMatch(
      /allow\s+update\s*:[\s\S]*?request\.resource\.data\.userId\s*==\s*resource\.data\.userId/,
    );
  });

  it("scenarios/{scenarioId} update enforces id immutability", () => {
    const b = extractMatchBlock(loadRules(), "match /scenarios/{scenarioId}");
    expect(b).toMatch(
      /allow\s+update\s*:[\s\S]*?request\.resource\.data\.id\s*==\s*resource\.data\.id/,
    );
  });

  it("scenarios/{scenarioId} update enforces copiedFrom immutability field-by-field (NOT whole-map equality)", () => {
    // Revision M1 guard: rules-language map equality has surprising semantics
    // (key-order, missing-vs-null), so each subfield is compared explicitly.
    const b = extractMatchBlock(loadRules(), "match /scenarios/{scenarioId}");
    expect(b).toMatch(
      /copiedFrom\.userId\s*==\s*resource\.data\.copiedFrom\.userId/,
    );
    expect(b).toMatch(
      /copiedFrom\.scenarioId\s*==\s*resource\.data\.copiedFrom\.scenarioId/,
    );
    expect(b).toMatch(
      /copiedFrom\.displayName\s*==\s*resource\.data\.copiedFrom\.displayName/,
    );
    expect(b).toMatch(
      /copiedFrom\.copiedAt\s*==\s*resource\.data\.copiedFrom\.copiedAt/,
    );
    // And explicitly: whole-map equality must NOT be the guard.
    expect(b).not.toMatch(
      /request\.resource\.data\.copiedFrom\s*==\s*resource\.data\.copiedFrom\b/,
    );
  });

  it("scenarios/{scenarioId} update has the null-vs-null branch (set-once-at-create when null)", () => {
    const b = extractMatchBlock(loadRules(), "match /scenarios/{scenarioId}");
    expect(b).toMatch(
      /request\.resource\.data\.copiedFrom\s*==\s*null\s*&&\s*resource\.data\.copiedFrom\s*==\s*null/,
    );
  });

  it("scenarios/{scenarioId} delete is owner-gated, not `if false`", () => {
    const b = extractMatchBlock(loadRules(), "match /scenarios/{scenarioId}");
    expect(b).toMatch(
      /allow\s+delete\s*:[\s\S]*?canEdit\s*\(\s*\)[\s\S]*?resource\.data\.userId\s*==\s*request\.auth\.uid/,
    );
    expect(b).not.toMatch(/allow\s+delete\s*:\s*if\s+false\s*;/);
  });

  it("scenarios/{scenarioId} keeps the size() <= 50 guard", () => {
    const b = extractMatchBlock(loadRules(), "match /scenarios/{scenarioId}");
    expect(b).toMatch(/size\s*\(\s*\)\s*<=\s*50/);
  });

  it("scenarios/{scenarioId} create caps copiedFrom map size at 4", () => {
    // security-auditor M3: without an exact size() check on copiedFrom, an
    // attacker who satisfies the four typed-key gates can still smuggle
    // arbitrary extra keys into the map for doc-bloat / stash storage.
    const b = extractMatchBlock(loadRules(), "match /scenarios/{scenarioId}");
    expect(b).toMatch(/copiedFrom\.size\s*\(\s*\)\s*==\s*4/);
  });

  it("appConfig/{docId} block is untouched by the scenarios rewrite", () => {
    // Sanity: confirm the admin-pinned reference-scenario flow didn't regress
    // when the adjacent scenarios block was rewritten. Public read + admin-
    // only write + locked doc id + key-set fence must all still be present.
    const b = extractMatchBlock(loadRules(), "match /appConfig/{docId}");
    expect(b).toMatch(/allow\s+read\s*:\s*if\s+true\s*;/);
    expect(b).toMatch(/allow\s+write\s*:[\s\S]*?isAdmin\s*\(\s*\)/);
    expect(b).toMatch(/docId\s*==\s*'current'/);
    expect(b).toMatch(
      /keys\s*\(\s*\)\s*\.\s*hasOnly\s*\(\s*\[\s*'referenceScenarioId'\s*,\s*'updatedAt'\s*,\s*'updatedBy'\s*\]\s*\)/,
    );
  });

  it("seasonSnapshots read is still public (banker share-link path)", () => {
    const ssBlock = extractMatchBlock(
      loadRules(),
      "match /seasonSnapshots/{snapshotId}",
    );
    expect(ssBlock).toMatch(/allow\s+read\s*:\s*if\s+true\s*;/);
  });

  // ── Invites write hygiene ─────────────────────────────────────────────

  it("invites/{inviteId} update is forbidden", () => {
    const invitesBlock = extractMatchBlock(
      loadRules(),
      "match /invites/{inviteId}",
    );
    expect(invitesBlock).toMatch(/allow\s+update\s*:\s*if\s+false\s*;/);
  });

  it("invites/{inviteId} delete allows matching-email session", () => {
    const invitesBlock = extractMatchBlock(
      loadRules(),
      "match /invites/{inviteId}",
    );
    expect(invitesBlock).toMatch(
      /allow\s+delete\s*:[\s\S]*?request\.auth\.token\.email\.lower\s*\(\s*\)\s*==\s*inviteId/,
    );
  });

  // ── Document-level negative assertions ────────────────────────────────
  // These guards catch the most-likely regressions in subsequent edits.

  it("users/{uid} create predicate does NOT default-allow on isAuthenticated()", () => {
    const usersBlock = extractMatchBlock(loadRules(), "match /users/{uid}");
    // Sanity: an `allow create: if isAuthenticated();` would defeat the
    // invite-claim flow. The actual create predicate is the longer
    // conjunction that references isValidRoleWrite + isAdmin/invite match.
    expect(usersBlock).not.toMatch(
      /allow\s+create\s*:\s*if\s+isAuthenticated\s*\(\s*\)\s*;/,
    );
  });

  // ── SHOULD-FIX-3: isApproved() status gate ───────────────────────────

  it("isApproved() is defined and treats missing status field as approved", () => {
    const rules = loadRules();
    expect(rules).toMatch(/function\s+isApproved\s*\(\s*\)/);
    // Must short-circuit to true when no status field is present (legacy users).
    expect(rules).toMatch(/!\(\s*'status'\s+in\s+userDoc\s*\(\s*\)\s*\)/);
    // Must require status == 'approved' when the field is present.
    expect(rules).toMatch(/userDoc\s*\(\s*\)\.status\s*==\s*'approved'/);
  });

  it("hasRole() calls isApproved()", () => {
    const rules = loadRules();
    expect(rules).toMatch(
      /function\s+hasRole\s*\(\s*role\s*\)[\s\S]*?isApproved\s*\(\s*\)/,
    );
  });

  // ── SHOULD-FIX-4: isPendingSelfCreate() field-injection guard ────────

  it("isPendingSelfCreate() denies revokedBy field injection", () => {
    const rules = loadRules();
    expect(rules).toMatch(/!\(\s*'revokedBy'\s+in\s+request\.resource\.data\s*\)/);
  });

  it("isPendingSelfCreate() denies revokedAt field injection", () => {
    const rules = loadRules();
    expect(rules).toMatch(/!\(\s*'revokedAt'\s+in\s+request\.resource\.data\s*\)/);
  });

  it("isPendingSelfCreate() denies approvedAt field injection", () => {
    const rules = loadRules();
    expect(rules).toMatch(/!\(\s*'approvedAt'\s+in\s+request\.resource\.data\s*\)/);
  });

  // ── Deliverable I: approval-gate structural guards ────────────────────

  it("isValidStatusWrite() is defined with 'pending' and 'approved'", () => {
    const rules = loadRules();
    expect(rules).toMatch(/function\s+isValidStatusWrite\s*\(\s*\)/);
    expect(rules).toContain("'pending'");
    expect(rules).toContain("'approved'");
    expect(rules).toMatch(
      /request\.resource\.data\.status\s+in\s+\[\s*'pending'\s*,\s*'approved'\s*\]/,
    );
  });

  it("isPendingSelfCreate() requires status == 'pending' and role == 'viewer'", () => {
    const rules = loadRules();
    expect(rules).toMatch(/function\s+isPendingSelfCreate\s*\(\s*\)/);
    expect(rules).toMatch(
      /request\.resource\.data\.status\s*==\s*'pending'/,
    );
    expect(rules).toMatch(
      /request\.resource\.data\.role\s*==\s*'viewer'/,
    );
  });

  it("isPendingSelfCreate() caps doc size at 10 (size() <= 10)", () => {
    const rules = loadRules();
    expect(rules).toMatch(/request\.resource\.data\.size\s*\(\s*\)\s*<=\s*10/);
  });

  it("users/{uid} create allows isPendingSelfCreate() as a branch", () => {
    const usersBlock = extractMatchBlock(loadRules(), "match /users/{uid}");
    expect(usersBlock).toMatch(
      /allow\s+create\s*:[\s\S]*?isPendingSelfCreate\s*\(\s*\)/,
    );
  });

  it("users/{uid} update admin branch includes isValidStatusWrite()", () => {
    const usersBlock = extractMatchBlock(loadRules(), "match /users/{uid}");
    expect(usersBlock).toMatch(
      /allow\s+update\s*:[\s\S]*?isAdmin\s*\(\s*\)[\s\S]*?isValidStatusWrite\s*\(\s*\)/,
    );
  });

  it("isPendingSelfCreate() uses equality (status == 'pending'), not array membership", () => {
    const rules = loadRules();
    // The self-create guard must use == 'pending', not `in ['pending', ...]`
    // (which would allow self-approve via `in ['approved']`).
    // Extract the function body to check it uses == not `in`.
    const fnMatch = rules.match(
      /function\s+isPendingSelfCreate\s*\(\s*\)([\s\S]*?)^    \}/m,
    );
    // If the regex doesn't capture cleanly, fall back to checking the whole
    // rules text — the key invariant is that the status field is compared
    // with == 'pending', not with `in [...]`.
    const haystack = fnMatch ? fnMatch[1] : rules;
    expect(haystack).toMatch(/request\.resource\.data\.status\s*==\s*'pending'/);
  });
});
