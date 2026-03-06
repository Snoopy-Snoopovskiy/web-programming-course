import { describe, test, expect } from 'bun:test'
import { ScoringService } from './scoringService.js'

const scoring = new ScoringService()

describe('ScoringService.scoreMultipleSelect', () => {
  test('all correct answers selected → full score', () => {
    const result = scoring.scoreMultipleSelect(['A', 'B', 'C'], ['A', 'B', 'C'])
    expect(result).toBe(3)
  })

  test('no answers selected → score 0', () => {
    const result = scoring.scoreMultipleSelect(['A', 'B'], [])
    expect(result).toBe(0)
  })

  test('all wrong answers selected → score clamped to 0', () => {
    const result = scoring.scoreMultipleSelect(['A', 'B'], ['C', 'D'])
    expect(result).toBe(0)
  })

  test('partial correct selection → raw positive', () => {
    const result = scoring.scoreMultipleSelect(['A', 'B'], ['A', 'C'])
    expect(result).toBe(0.5)
  })

  test('more wrong than right → clamped to 0', () => {
    const result = scoring.scoreMultipleSelect(['A', 'B'], ['A', 'C', 'D', 'E'])
    expect(result).toBe(0)
  })

  test('single correct answer selected exactly → score 1', () => {
    const result = scoring.scoreMultipleSelect(['A'], ['A'])
    expect(result).toBe(1)
  })

  test('single correct answer not selected → score 0', () => {
    const result = scoring.scoreMultipleSelect(['A'], ['B'])
    expect(result).toBe(0)
  })

  test('duplicate student answers are each evaluated independently', () => {
    const result = scoring.scoreMultipleSelect(['A', 'B'], ['A', 'A'])
    expect(result).toBe(2)
  })

  test('empty correct answers definition → always 0', () => {
    const result = scoring.scoreMultipleSelect([], ['A', 'B'])
    expect(result).toBe(0)
  })

  test('exactly one correct out of many selected → net could be negative → 0', () => {
    const result = scoring.scoreMultipleSelect(['A'], ['A', 'B', 'C', 'D', 'E'])
    expect(result).toBe(0)
  })
})

describe('ScoringService.scoreSingleSelect', () => {
  test('correct answer → 1', () => {
    expect(scoring.scoreSingleSelect('B', 'B')).toBe(1)
  })

  test('wrong answer → 0', () => {
    expect(scoring.scoreSingleSelect('B', 'C')).toBe(0)
  })

  test('empty strings both → 1 (equal)', () => {
    expect(scoring.scoreSingleSelect('', '')).toBe(1)
  })

  test('case sensitive comparison', () => {
    expect(scoring.scoreSingleSelect('a', 'A')).toBe(0)
  })
})

describe('ScoringService.scoreEssay', () => {
  const rubric = [
    { criterion: 'clarity', maxPoints: 3 },
    { criterion: 'depth', maxPoints: 5 },
    { criterion: 'examples', maxPoints: 2 },
  ]

  test('full marks on all criteria → total max score', () => {
    const grades = [
      { criterion: 'clarity', points: 3 },
      { criterion: 'depth', points: 5 },
      { criterion: 'examples', points: 2 },
    ]
    expect(scoring.scoreEssay(grades, rubric)).toBe(10)
  })

  test('zero grades → 0', () => {
    const grades = [
      { criterion: 'clarity', points: 0 },
      { criterion: 'depth', points: 0 },
      { criterion: 'examples', points: 0 },
    ]
    expect(scoring.scoreEssay(grades, rubric)).toBe(0)
  })

  test('grades exceed maxPoints → clamped to maxPoints', () => {
    const grades = [
      { criterion: 'clarity', points: 10 },
      { criterion: 'depth', points: 10 },
      { criterion: 'examples', points: 10 },
    ]
    expect(scoring.scoreEssay(grades, rubric)).toBe(10)
  })

  test('negative grades → clamped to 0 per criterion', () => {
    const grades = [
      { criterion: 'clarity', points: -5 },
      { criterion: 'depth', points: 3 },
      { criterion: 'examples', points: 1 },
    ]
    expect(scoring.scoreEssay(grades, rubric)).toBe(4)
  })

  test('unknown criterion is ignored', () => {
    const grades = [
      { criterion: 'clarity', points: 2 },
      { criterion: 'unknown_crit', points: 99 },
    ]
    expect(scoring.scoreEssay(grades, rubric)).toBe(2)
  })

  test('empty grades array → 0', () => {
    expect(scoring.scoreEssay([], rubric)).toBe(0)
  })

  test('empty rubric → 0 regardless of grades', () => {
    const grades = [{ criterion: 'clarity', points: 3 }]
    expect(scoring.scoreEssay(grades, [])).toBe(0)
  })

  test('partial criteria graded → only those are counted', () => {
    const grades = [{ criterion: 'depth', points: 4 }]
    expect(scoring.scoreEssay(grades, rubric)).toBe(4)
  })

  test('maxEssayScore returns sum of all maxPoints', () => {
    expect(scoring.maxEssayScore(rubric)).toBe(10)
  })

  test('normaliseEssayScore returns ratio in [0,1]', () => {
    const grades = [
      { criterion: 'clarity', points: 3 },
      { criterion: 'depth', points: 2.5 },
      { criterion: 'examples', points: 2 },
    ]
    expect(scoring.normaliseEssayScore(grades, rubric)).toBeCloseTo(0.75)
  })

  test('normaliseEssayScore returns 0 for empty rubric', () => {
    expect(scoring.normaliseEssayScore([], [])).toBe(0)
  })
})
