/**
 * 管道运行（PipelineRun）数据库操作
 */

import type { PipelineRun, PipelineStepResult } from "../types";
import { getDB, rowToPipelineRun } from "./shared";

export async function getPipelineRun(id: string): Promise<PipelineRun | null> {
  const db = getDB();
  const row = db.prepare("SELECT * FROM pipeline_runs WHERE id = ?").get(id);
  return row ? rowToPipelineRun(row as Record<string, unknown>) : null;
}

export async function createPipelineRun(run: PipelineRun): Promise<PipelineRun> {
  const db = getDB();
  db.prepare(
    "INSERT INTO pipeline_runs (id, categoryId, status, steps, currentStepIndex, result, error, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(run.id, run.categoryId, run.status, JSON.stringify(run.steps), run.currentStepIndex, run.result || null, run.error || null, run.createdAt, run.updatedAt);
  return run;
}

export async function updatePipelineStep(
  id: string, stepIndex: number, update: Partial<PipelineStepResult>
): Promise<PipelineRun | null> {
  const db = getDB();
  const row = db.prepare("SELECT * FROM pipeline_runs WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  const steps = JSON.parse((row.steps as string) || '[]');
  if (stepIndex < 0 || stepIndex >= steps.length) return null;
  steps[stepIndex] = { ...steps[stepIndex], ...update };
  const updatedAt = new Date().toISOString();
  db.prepare("UPDATE pipeline_runs SET steps = ?, updatedAt = ? WHERE id = ?")
    .run(JSON.stringify(steps), updatedAt, id);
  return rowToPipelineRun({ ...row, steps, updatedAt });
}

export async function updatePipelineStatus(
  id: string, status: PipelineRun['status'], result?: string, error?: string
): Promise<PipelineRun | null> {
  const db = getDB();
  const row = db.prepare("SELECT * FROM pipeline_runs WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  const updatedAt = new Date().toISOString();
  const resultVal = result !== undefined ? result : (row.result as string | null);
  const errorVal = error !== undefined ? error : (row.error as string | null);
  db.prepare("UPDATE pipeline_runs SET status = ?, result = ?, error = ?, updatedAt = ? WHERE id = ?")
    .run(status, resultVal, errorVal, updatedAt, id);
  return rowToPipelineRun({ ...row, status, result: resultVal, error: errorVal, updatedAt });
}

export async function updatePipelineRun(id: string, updates: Partial<PipelineRun>): Promise<PipelineRun | null> {
  const db = getDB();
  const row = db.prepare("SELECT * FROM pipeline_runs WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;

  const steps = updates.steps !== undefined ? JSON.stringify(updates.steps) : (row.steps as string);
  const currentStepIndex = updates.currentStepIndex !== undefined ? updates.currentStepIndex : (row.currentStepIndex as number);
  const status = updates.status !== undefined ? updates.status : (row.status as string);
  const result = updates.result !== undefined ? updates.result : (row.result as string | null);
  const error = updates.error !== undefined ? updates.error : (row.error as string | null);
  const updatedAt = new Date().toISOString();

  db.prepare("UPDATE pipeline_runs SET steps=?, currentStepIndex=?, status=?, result=?, error=?, updatedAt=? WHERE id=?")
    .run(steps, currentStepIndex, status, result, error, updatedAt, id);

  return rowToPipelineRun({ ...row, steps: JSON.parse(steps), currentStepIndex, status, result, error, updatedAt });
}

export async function listPipelineRuns(options?: {
  categoryId?: string; limit?: number;
}): Promise<PipelineRun[]> {
  const db = getDB();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options?.categoryId) {
    conditions.push("categoryId = ?");
    params.push(options.categoryId);
  }

  const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
  const limit = options?.limit ? "LIMIT ?" : "";
  if (options?.limit) params.push(options.limit);

  return db.prepare(
    `SELECT * FROM pipeline_runs ${where} ORDER BY createdAt DESC ${limit}`
  ).all(...params).map((r) => rowToPipelineRun(r as Record<string, unknown>));
}

export async function deleteOldPipelineRuns(keepCount: number): Promise<number> {
  const db = getDB();
  const total = (db.prepare("SELECT COUNT(*) as count FROM pipeline_runs").get() as { count: number }).count;
  if (total <= keepCount) return 0;
  const toDelete = total - keepCount;
  db.prepare(
    `DELETE FROM pipeline_runs WHERE id NOT IN (
      SELECT id FROM pipeline_runs ORDER BY createdAt DESC LIMIT ?
    )`
  ).run(keepCount);
  return toDelete;
}
