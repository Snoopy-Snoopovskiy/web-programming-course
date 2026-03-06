export interface EssayGrade {
  criterion: string
  points: number
}

export interface RubricItem {
  criterion: string
  maxPoints: number
}

export class ScoringService {
  /**
   * @param correctAnswers  Array of option IDs / values that are correct.
   * @param studentAnswers  Array of option IDs / values the student chose.
   * @returns               Score in range [0, correctAnswers.length].
   */
  scoreMultipleSelect(
    correctAnswers: string[],
    studentAnswers: string[],
  ): number {
    if (correctAnswers.length === 0) return 0

    const correctSet = new Set(correctAnswers)
    let raw = 0

    for (const answer of studentAnswers) {
      if (correctSet.has(answer)) {
        raw += 1
      } else {
        raw -= 0.5
      }
    }

    return Math.max(0, raw)
  }

  scoreSingleSelect(correctAnswer: string, studentAnswer: string): number {
    return correctAnswer === studentAnswer ? 1 : 0
  }

  /**
   * @param grades   Array of { criterion, points } from the grader.
   * @param rubric   Array of { criterion, maxPoints } defining the marking scheme.
   * @returns        Total score (sum of clamped criterion scores).
   */
  scoreEssay(grades: EssayGrade[], rubric: RubricItem[]): number {
    const rubricMap = new Map<string, number>(
      rubric.map(r => [r.criterion, r.maxPoints]),
    )

    let total = 0

    for (const grade of grades) {
      const max = rubricMap.get(grade.criterion)
      if (max === undefined) {
        continue
      }
      const clamped = Math.max(0, Math.min(grade.points, max))
      total += clamped
    }

    return total
  }

  maxEssayScore(rubric: RubricItem[]): number {
    return rubric.reduce((sum, r) => sum + r.maxPoints, 0)
  }

  normaliseEssayScore(grades: EssayGrade[], rubric: RubricItem[]): number {
    const max = this.maxEssayScore(rubric)
    if (max === 0) return 0
    return this.scoreEssay(grades, rubric) / max
  }
}

export const scoringService = new ScoringService()
