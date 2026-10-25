import assert from "node:assert/strict";
import test from "node:test";
import { scoreQuiz } from "./quiz-scoring.js";

test("scores correct answers case-insensitively and ignores unanswered questions", () => {
  const result = scoreQuiz(
    [
      { id: "airway", correctAnswer: "Assess airway", points: 2 },
      { id: "sbar", correctAnswer: "SBAR", points: 1 },
      { id: "safety", correctAnswer: "true", points: 1 }
    ],
    [
      { questionId: "airway", answer: "  assess AIRWAY " },
      { questionId: "sbar", answer: "sbar" }
    ]
  );

  assert.deepEqual(result, { pointsEarned: 3, totalPoints: 4, score: 75 });
});

test("returns zero percent for a quiz with no questions", () => {
  assert.deepEqual(scoreQuiz([], []), { pointsEarned: 0, totalPoints: 0, score: 0 });
});
