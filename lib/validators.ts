/**
 * Zod schemas for every mutation. Server Actions parse their input with these
 * before talking to the database, so bad input never reaches Postgres.
 * (The database has its own CHECK constraints too — defence in depth.)
 */
import { z } from "zod";
import { ROLES } from "@/lib/permissions";

const id = z.uuid({ error: "Invalid id" });
const title = (max: number) =>
  z
    .string()
    .trim()
    .min(1, { error: "Title can't be empty" })
    .max(max, { error: `Title must be ${max} characters or less` });
const position = z.number().finite();
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Use a YYYY-MM-DD date" })
  .nullable();
const role = z.enum(ROLES, { error: "Role must be owner, member or viewer" });

// ---- auth -------------------------------------------------------------------
export const signInSchema = z.object({
  email: z.email({ error: "Enter a valid email" }).trim().toLowerCase(),
  password: z.string().min(1, { error: "Enter your password" }),
});

export const signUpSchema = z.object({
  fullName: z.string().trim().min(1, { error: "Enter your name" }).max(80),
  email: z.email({ error: "Enter a valid email" }).trim().toLowerCase(),
  password: z.string().min(8, { error: "Password must be at least 8 characters" }).max(72),
});

// ---- boards -----------------------------------------------------------------
export const createBoardSchema = z.object({
  title: title(100),
  description: z.string().trim().max(1000).optional().default(""),
});

export const updateBoardSchema = z.object({
  boardId: id,
  title: title(100).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
});

export const boardIdSchema = z.object({ boardId: id });

// ---- lists ------------------------------------------------------------------
export const createListSchema = z.object({
  id,
  boardId: id,
  title: title(100),
  position,
});

export const renameListSchema = z.object({ listId: id, title: title(100) });

export const moveListSchema = z.object({
  listId: id,
  boardId: id,
  position,
  rebalance: z.boolean().default(false),
});

export const deleteListSchema = z.object({ listId: id });

// ---- cards ------------------------------------------------------------------
export const createCardSchema = z.object({
  id,
  listId: id,
  boardId: id,
  title: title(200),
  position,
});

export const updateCardSchema = z.object({
  cardId: id,
  title: title(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  dueDate: isoDate.optional(),
  labels: z.array(z.string().trim().min(1).max(24)).max(10).optional(),
});

export const moveCardSchema = z.object({
  cardId: id,
  toListId: id,
  position,
  rebalance: z.boolean().default(false),
});

export const deleteCardSchema = z.object({ cardId: id });

// ---- members ----------------------------------------------------------------
export const inviteMemberSchema = z.object({
  boardId: id,
  email: z.email({ error: "Enter a valid email" }).trim().toLowerCase(),
  role,
});

export const changeRoleSchema = z.object({ boardId: id, userId: id, role });
export const removeMemberSchema = z.object({ boardId: id, userId: id });

/** First Zod error message, for showing in a toast. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}
