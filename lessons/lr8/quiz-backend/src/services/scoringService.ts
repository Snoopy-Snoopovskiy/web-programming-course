export interface EssayGrade {
  criterion: string;
  points: number;
}

export interface RubricItem {
  criterion: string;
  maxPoints: number;
}

export class ScoringService {
  scoreMultipleSelect(correctAnswers: string[], studentAnswers: string[]): number {
    let score = 0;
    for (const answer of studentAnswers) {
      if (correctAnswers.includes(answer)) {
        score += 1;
      } else {
        score -= 0.5;
      }
    }
    return Math.max(0, score);
  }

  scoreEssay(grades: EssayGrade[], rubric: RubricItem[]): number {
    let total = 0;
    for (const grade of grades) {
      const rubricItem = rubric.find((r) => r.criterion === grade.criterion);
      if (!rubricItem) continue;
      const capped = Math.min(grade.points, rubricItem.maxPoints);
      total += Math.max(0, capped);
    }
    return total;
  }

  maxEssayScore(rubric: RubricItem[]): number {
    return rubric.reduce((sum, item) => sum + item.maxPoints, 0);
  }
}

export const scoringService = new ScoringService();