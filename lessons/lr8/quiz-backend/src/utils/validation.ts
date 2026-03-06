import { z } from 'zod'

export const githubCallbackSchema = z.object({
  code: z.string().min(1, 'GitHub authorization code is required'),
})

export type GithubCallbackInput = z.infer<typeof githubCallbackSchema>

export const createSessionSchema = z.object({
  categoryId: z.string().cuid('Invalid category ID').optional(),
})

export type CreateSessionInput = z.infer<typeof createSessionSchema>

const userAnswerSchema = z.union([
  z.string().min(1, 'Answer must not be empty'),
  z.array(z.string().min(1)).min(1, 'At least one option must be selected'),
])

export const answerSchema = z.object({
  questionId: z.string().cuid('Invalid question ID'),
  userAnswer: userAnswerSchema,
})

export type AnswerInput = z.infer<typeof answerSchema>

export const essayGradeItemSchema = z.object({
  criterion: z.string().min(1, 'Criterion name is required'),
  points: z.number().finite('Points must be a finite number'),
})

export const gradeSchema = z.object({
  grades: z
    .array(essayGradeItemSchema)
    .min(1, 'At least one grade criterion is required'),
  comment: z.string().max(2000).optional(),
})

export type GradeInput = z.infer<typeof gradeSchema>

const questionTypeSchema = z.enum(['single-select', 'multiple-select', 'essay'])

const questionBaseSchema = z.object({
  text: z
    .string()
    .min(3, 'Question text must be at least 3 characters')
    .max(2000),
  type: questionTypeSchema,
  categoryId: z.string().cuid('Invalid category ID'),
  correctAnswer: z
    .array(z.string().min(1))
    .min(1, 'At least one correct answer is required')
    .optional()
    .nullable(),
  points: z
    .number()
    .int('Points must be an integer')
    .min(1, 'Points must be at least 1')
    .default(1),
})

export const questionSchema = questionBaseSchema
  .refine(
    data => {
      if (data.type !== 'essay') {
        return (
          Array.isArray(data.correctAnswer) && data.correctAnswer.length > 0
        )
      }
      return true
    },
    {
      message:
        'correctAnswer is required for single-select and multiple-select questions',
      path: ['correctAnswer'],
    },
  )
  .refine(
    data => {
      if (data.type === 'single-select') {
        return (
          Array.isArray(data.correctAnswer) && data.correctAnswer.length === 1
        )
      }
      return true
    },
    {
      message: 'single-select questions must have exactly one correct answer',
      path: ['correctAnswer'],
    },
  )

export type QuestionInput = z.infer<typeof questionSchema>

export const updateQuestionSchema = questionBaseSchema
  .partial()
  .refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  })

export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>

export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase-kebab-case'),
})

export type CategoryInput = z.infer<typeof categorySchema>

export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform(v => (v ? Math.max(1, parseInt(v, 10)) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform(v => {
      const n = v ? parseInt(v, 10) : 20
      return Math.min(100, Math.max(1, n))
    })
    .pipe(z.number().int().min(1).max(100)),
})

export type PaginationInput = z.infer<typeof paginationSchema>

export function toPrismaPage(pagination: PaginationInput): {
  skip: number
  take: number
} {
  return {
    skip: (pagination.page - 1) * pagination.limit,
    take: pagination.limit,
  }
}
