export interface ScorableQuestion {
  id: string;
  correctAnswer: string;
  points: number;
}

export interface SubmittedAnswer {
  questionId: string;
  answer: string | string[];
}

export function scoreQuiz(questions: ScorableQuestion[], answers: SubmittedAnswer[]) {
  const answerByQuestion = new Map(answers.map(({ questionId, answer }) => [questionId, answer]));
  const totalPoints = questions.reduce((total, question) => total + question.points, 0);
  const pointsEarned = questions.reduce((total, question) => {
    const answer = answerByQuestion.get(question.id);
    if (answer === undefined) return total;
    const normalized = Array.isArray(answer) ? answer.join(",").trim().toLowerCase() : answer.trim().toLowerCase();
    return normalized === question.correctAnswer.trim().toLowerCase() ? total + question.points : total;
  }, 0);
  return {
    pointsEarned,
    totalPoints,
    score: totalPoints ? Math.round((pointsEarned / totalPoints) * 10_000) / 100 : 0
  };
}
