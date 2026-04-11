/**
 * 报告操作
 */

import type { Report } from "../types";
import { getDB, rowToReport } from "./shared";

export async function getReports(categoryId?: string): Promise<Report[]> {
  const db = getDB();
  if (categoryId) {
    return db.prepare("SELECT * FROM reports WHERE categoryId = ?").all(categoryId).map((r) => rowToReport(r as Record<string, unknown>));
  }
  return db.prepare("SELECT * FROM reports").all().map((r) => rowToReport(r as Record<string, unknown>));
}

export async function addReport(report: Report): Promise<Report> {
  const db = getDB();
  db.prepare(
    "INSERT INTO reports (id, categoryId, createdAt, summary, topics) VALUES (?, ?, ?, ?, ?)"
  ).run(report.id, report.categoryId, report.createdAt, report.summary, JSON.stringify(report.topics));
  return report;
}

export async function getReportById(id: string): Promise<Report | null> {
  const db = getDB();
  const row = db.prepare("SELECT * FROM reports WHERE id = ?").get(id);
  return row ? rowToReport(row as Record<string, unknown>) : null;
}
