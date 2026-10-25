import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { Role } from "@prisma/client";
import { requireVerifiedCohort } from "./cohort.js";

test("unverified students are denied cohort resources", () => {
  let status = 200;
  let responseBody: unknown;
  let continued = false;
  const req = { user: { role: Role.STUDENT, cohortVerified: false } } as Request;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(body: unknown) {
      responseBody = body;
      return this;
    }
  } as unknown as Response;

  requireVerifiedCohort(req, res, () => { continued = true; });

  assert.equal(status, 403);
  assert.deepEqual(responseBody, {
    error: "Your department and study level are awaiting administrator verification."
  });
  assert.equal(continued, false);
});

test("verified students can access cohort resources", () => {
  let continued = false;
  const req = { user: { role: Role.STUDENT, cohortVerified: true } } as Request;
  const res = {} as Response;
  requireVerifiedCohort(req, res, () => { continued = true; });
  assert.equal(continued, true);
});
