import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { cleanCode, cleanEmail, codeLooksComplete, emailProblem, isPinAccount, passwordProblem } from "./account";
import { fitWithin } from "./avatar";

describe("account helpers", () => {
  it("tidies an email address", () => {
    expect(cleanEmail("  Josiah@Example.COM ")).toBe("josiah@example.com");
  });

  it("accepts a normal address and rejects a malformed one", () => {
    expect(emailProblem("someone@example.com")).toBeNull();
    expect(emailProblem("someone@example")).not.toBeNull();
    expect(emailProblem("not an email")).not.toBeNull();
  });

  it("does not let anyone register on the made-up domain used by username-and-PIN accounts", () => {
    expect(isPinAccount("otrasane@sommyart.app")).toBe(true);
    expect(isPinAccount("Someone@Sommyart.App")).toBe(true);
    expect(isPinAccount("someone@gmail.com")).toBe(false);
    expect(isPinAccount(null)).toBe(false);
    expect(emailProblem("victim@sommyart.app")).not.toBeNull();
  });

  it("requires a password of 8 to 72 characters", () => {
    expect(passwordProblem("short")).not.toBeNull();
    expect(passwordProblem("12345678")).toBeNull();
    expect(passwordProblem("x".repeat(73))).not.toBeNull();
  });

  it("keeps only the digits of a pasted code", () => {
    expect(cleanCode(" 123 456 ")).toBe("123456");
    expect(cleanCode("12-34-56-78")).toBe("12345678");
    expect(codeLooksComplete("12345")).toBe(false);
    expect(codeLooksComplete("123456")).toBe(true);
  });
});

describe("profile photo sizing", () => {
  it("shrinks large photos and keeps their shape", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 512, height: 384 });
    expect(fitWithin(1000, 2000)).toEqual({ width: 256, height: 512 });
  });

  it("leaves small photos alone", () => {
    expect(fitWithin(300, 200)).toEqual({ width: 300, height: 200 });
  });
});
