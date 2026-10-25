import assert from "node:assert/strict";
import test from "node:test";
import { Role } from "@prisma/client";
import { canAccessCourse, canRevealQuizAnswers, courseLevelFilter } from "./access.js";

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

test("students cannot join a class for another level", () => {
  assert.equal(canAccessCourse(Role.STUDENT, "NURSING", "Level 200", "NURSING", "Level 300"), false);
});

test("lecturers can access classes in their department across levels", () => {
  assert.equal(canAccessCourse(Role.LECTURER, "NURSING", "Level 200", "NURSING", "Level 300"), true);
});

test("administrators can access classes across departments", () => {
  assert.equal(canAccessCourse(Role.ADMIN, "NURSING", "Level 200", "MIDWIFERY", "Level 300"), true);
});
