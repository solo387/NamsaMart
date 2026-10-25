import assert from "node:assert/strict";
import test from "node:test";
import { loginSchema, profileSchema, registerSchema } from "./index.js";

test("student registration validates the department and safe password length", () => {
  const registration = registerSchema.safeParse({
    name: "Ama Owusu",
    email: "ama@example.edu",
    password: "StudyNamsa!2026",
    department: "NURSING",
    level: "Level 300"
  });

  assert.equal(registration.success, true);
});

test("registration never accepts a caller-selected privileged role", () => {
  const registration = registerSchema.safeParse({
    name: "Ama Owusu",
    email: "ama@example.edu",
    password: "StudyNamsa!2026",
    department: "NURSING",
    level: "Level 300",
    role: "ADMIN"
  });

  assert.equal(registration.success, true);
  if (registration.success) assert.equal("role" in registration.data, false);
});

test("login rejects malformed email addresses", () => {
  assert.equal(loginSchema.safeParse({ email: "not-an-email", password: "secret" }).success, false);
});

test("profile edits cannot change department or study level", () => {
  assert.deepEqual(
    profileSchema.parse({ name: "Abena Owusu", department: "MIDWIFERY", level: "Level 400" }),
    { name: "Abena Owusu" }
  );
});
