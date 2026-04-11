/**
 * 账号空间操作 — Persona / Style / KnowledgeBase / WxTemplate + buildAIContext
 */

import type { Persona, Style, KnowledgeBase, WxTemplate } from "../types";
import { generateId } from "../utils";
import { getDB } from "./shared";

// ============ Persona ============

export async function getPersonas(): Promise<Persona[]> {
  const db = getDB();
  return db.prepare("SELECT * FROM personas").all() as Persona[];
}

export async function getPersona(id: string): Promise<Persona | null> {
  const db = getDB();
  return (db.prepare("SELECT * FROM personas WHERE id = ?").get(id) as Persona) || null;
}

export async function createPersona(data: {
  name: string; description: string; avatar?: string; systemPrompt: string;
}): Promise<Persona> {
  const db = getDB();
  const id = generateId();
  const now = Date.now();
  db.prepare(
    "INSERT INTO personas (id, name, description, avatar, systemPrompt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, data.name, data.description, data.avatar || '', data.systemPrompt, now, now);
  return { id, name: data.name, description: data.description, avatar: data.avatar, systemPrompt: data.systemPrompt, createdAt: now, updatedAt: now };
}

export async function updatePersona(
  id: string, data: Partial<{ name: string; description: string; avatar: string; systemPrompt: string }>
): Promise<Persona | null> {
  const db = getDB();
  const existing = db.prepare("SELECT * FROM personas WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!existing) return null;
  const updatedAt = Date.now();
  const name = data.name !== undefined ? data.name : (existing.name as string);
  const description = data.description !== undefined ? data.description : (existing.description as string);
  const avatar = data.avatar !== undefined ? data.avatar : (existing.avatar as string);
  const systemPrompt = data.systemPrompt !== undefined ? data.systemPrompt : (existing.systemPrompt as string);
  db.prepare("UPDATE personas SET name=?, description=?, avatar=?, systemPrompt=?, updatedAt=? WHERE id=?")
    .run(name, description, avatar, systemPrompt, updatedAt, id);
  return { id, name, description, avatar, systemPrompt, createdAt: existing.createdAt as number, updatedAt };
}

export async function deletePersona(id: string): Promise<boolean> {
  const db = getDB();
  return db.prepare("DELETE FROM personas WHERE id = ?").run(id).changes > 0;
}

// ============ Style ============

export async function getStyles(): Promise<Style[]> {
  const db = getDB();
  return db.prepare("SELECT * FROM styles").all() as Style[];
}

export async function getStyle(id: string): Promise<Style | null> {
  const db = getDB();
  return (db.prepare("SELECT * FROM styles WHERE id = ?").get(id) as Style) || null;
}

export async function createStyle(data: { name: string; icon: string; systemPrompt: string }): Promise<Style> {
  const db = getDB();
  const id = generateId();
  const now = Date.now();
  db.prepare("INSERT INTO styles (id, name, icon, systemPrompt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, data.name, data.icon, data.systemPrompt, now, now);
  return { id, name: data.name, icon: data.icon, systemPrompt: data.systemPrompt, createdAt: now, updatedAt: now };
}

export async function updateStyle(
  id: string, data: Partial<{ name: string; icon: string; systemPrompt: string }>
): Promise<Style | null> {
  const db = getDB();
  const existing = db.prepare("SELECT * FROM styles WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!existing) return null;
  const updatedAt = Date.now();
  const name = data.name !== undefined ? data.name : (existing.name as string);
  const icon = data.icon !== undefined ? data.icon : (existing.icon as string);
  const systemPrompt = data.systemPrompt !== undefined ? data.systemPrompt : (existing.systemPrompt as string);
  db.prepare("UPDATE styles SET name=?, icon=?, systemPrompt=?, updatedAt=? WHERE id=?")
    .run(name, icon, systemPrompt, updatedAt, id);
  return { id, name, icon, systemPrompt, createdAt: existing.createdAt as number, updatedAt };
}

export async function deleteStyle(id: string): Promise<boolean> {
  const db = getDB();
  return db.prepare("DELETE FROM styles WHERE id = ?").run(id).changes > 0;
}

// ============ KnowledgeBase ============

export async function getKnowledgeBases(): Promise<KnowledgeBase[]> {
  const db = getDB();
  return db.prepare("SELECT * FROM knowledge_bases").all() as KnowledgeBase[];
}

export async function getKnowledgeBase(id: string): Promise<KnowledgeBase | null> {
  const db = getDB();
  return (db.prepare("SELECT * FROM knowledge_bases WHERE id = ?").get(id) as KnowledgeBase) || null;
}

export async function createKnowledgeBase(data: { name: string; description: string; content: string }): Promise<KnowledgeBase> {
  const db = getDB();
  const id = generateId();
  const now = Date.now();
  db.prepare("INSERT INTO knowledge_bases (id, name, description, content, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, data.name, data.description, data.content, now, now);
  return { id, name: data.name, description: data.description, content: data.content, createdAt: now, updatedAt: now };
}

export async function updateKnowledgeBase(
  id: string, data: Partial<{ name: string; description: string; content: string }>
): Promise<KnowledgeBase | null> {
  const db = getDB();
  const existing = db.prepare("SELECT * FROM knowledge_bases WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!existing) return null;
  const updatedAt = Date.now();
  const name = data.name !== undefined ? data.name : (existing.name as string);
  const description = data.description !== undefined ? data.description : (existing.description as string);
  const content = data.content !== undefined ? data.content : (existing.content as string);
  db.prepare("UPDATE knowledge_bases SET name=?, description=?, content=?, updatedAt=? WHERE id=?")
    .run(name, description, content, updatedAt, id);
  return { id, name, description, content, createdAt: existing.createdAt as number, updatedAt };
}

export async function deleteKnowledgeBase(id: string): Promise<boolean> {
  const db = getDB();
  return db.prepare("DELETE FROM knowledge_bases WHERE id = ?").run(id).changes > 0;
}

// ============ WxTemplate ============

export async function getTemplates(): Promise<WxTemplate[]> {
  const db = getDB();
  return db.prepare("SELECT * FROM templates").all() as WxTemplate[];
}

export async function getTemplate(id: string): Promise<WxTemplate | null> {
  const db = getDB();
  return (db.prepare("SELECT * FROM templates WHERE id = ?").get(id) as WxTemplate) || null;
}

export async function createTemplate(data: {
  name: string; titleTemplate: string; contentTemplate: string; coverPromptTemplate?: string;
}): Promise<WxTemplate> {
  const db = getDB();
  const id = generateId();
  const now = Date.now();
  db.prepare(
    "INSERT INTO templates (id, name, titleTemplate, contentTemplate, coverPromptTemplate, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, data.name, data.titleTemplate, data.contentTemplate, data.coverPromptTemplate || '', now, now);
  return { id, name: data.name, titleTemplate: data.titleTemplate, contentTemplate: data.contentTemplate, coverPromptTemplate: data.coverPromptTemplate, createdAt: now, updatedAt: now };
}

export async function updateTemplate(
  id: string, data: Partial<{ name: string; titleTemplate: string; contentTemplate: string; coverPromptTemplate: string }>
): Promise<WxTemplate | null> {
  const db = getDB();
  const existing = db.prepare("SELECT * FROM templates WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!existing) return null;
  const updatedAt = Date.now();
  const name = data.name !== undefined ? data.name : (existing.name as string);
  const titleTemplate = data.titleTemplate !== undefined ? data.titleTemplate : (existing.titleTemplate as string);
  const contentTemplate = data.contentTemplate !== undefined ? data.contentTemplate : (existing.contentTemplate as string);
  const coverPromptTemplate = data.coverPromptTemplate !== undefined ? data.coverPromptTemplate : (existing.coverPromptTemplate as string);
  db.prepare("UPDATE templates SET name=?, titleTemplate=?, contentTemplate=?, coverPromptTemplate=?, updatedAt=? WHERE id=?")
    .run(name, titleTemplate, contentTemplate, coverPromptTemplate, updatedAt, id);
  return { id, name, titleTemplate, contentTemplate, coverPromptTemplate, createdAt: existing.createdAt as number, updatedAt };
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const db = getDB();
  return db.prepare("DELETE FROM templates WHERE id = ?").run(id).changes > 0;
}

// ============ AI Context Builder ============

export async function buildAIContext(params: {
  personaId?: string;
  styleId?: string;
  knowledgeIds?: string[];
  templateId?: string;
}): Promise<{
  systemPrompt: string;
  contextData: {
    persona?: Persona;
    style?: Style;
    knowledgeBases: KnowledgeBase[];
    template?: WxTemplate;
  };
}> {
  const { personaId, styleId, knowledgeIds, templateId } = params;

  const [persona, style, knowledgeBases, template] = await Promise.all([
    personaId ? getPersona(personaId) : Promise.resolve(null),
    styleId ? getStyle(styleId) : Promise.resolve(null),
    knowledgeIds?.length ? Promise.all(knowledgeIds.map((id) => getKnowledgeBase(id))) : Promise.resolve([]),
    templateId ? getTemplate(templateId) : Promise.resolve(null),
  ]);

  const systemPromptParts: string[] = [];

  if (persona) {
    systemPromptParts.push(`【人设】\n${persona.systemPrompt}`);
  }
  if (style) {
    systemPromptParts.push(`【风格】\n${style.systemPrompt}`);
  }
  if (knowledgeBases.length > 0) {
    const validKnowledgeBases = knowledgeBases.filter((kb): kb is KnowledgeBase => kb !== null);
    if (validKnowledgeBases.length > 0) {
      const knowledgeContent = validKnowledgeBases.map((kb) => `【${kb.name}】\n${kb.content}`).join("\n\n");
      systemPromptParts.push(`【知识库】\n${knowledgeContent}`);
    }
  }
  if (template) {
    systemPromptParts.push(`【内容模板】\n标题模板：${template.titleTemplate}\n内容模板：${template.contentTemplate}`);
  }

  return {
    systemPrompt: systemPromptParts.join("\n\n"),
    contextData: {
      persona: persona || undefined,
      style: style || undefined,
      knowledgeBases: knowledgeBases.filter((kb): kb is KnowledgeBase => kb !== null),
      template: template || undefined,
    },
  };
}
