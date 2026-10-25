import assert from "node:assert/strict";
import test from "node:test";
import { Role } from "@prisma/client";
import { canRevealQuizAnswers, courseLevelFilter } from "./access.js";

test("students cannot select course materials from a different level", () => {
  assert.deepEqual(courseLevelFilter(Role.STUDENT, "Level 200", "Level 300"), { level: "Level 200" });
});

test("lecturers may use the requested level filter", () => {
  assert.deepEqual(courseLevelFilter(Role.LECTURER, "Level 200", "Level 300"), { level: "Level 300" });
});

test("learners cannot reveal answers while a quiz is published", () => {
  assert.equal(canRevealQuizAnswers(true, Role.STUDENT, "lecturer-id", "student-id"), false);
});

test("quiz answers become available after the quiz closes", () => {
  assert.equal(canRevealQuizAnswers(false, Role.STUDENT, "lecturer-id", "student-id"), true);
});
