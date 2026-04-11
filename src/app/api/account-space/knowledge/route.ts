import { NextRequest } from "next/server";
import { getKnowledgeBases, createKnowledgeBase } from "@/lib/db";
import { apiHandler, success, error } from "@/lib/api-handler";

export const GET = apiHandler(async () => {
  const knowledgeBases = await getKnowledgeBases();
  return success(knowledgeBases);
});

export const POST = apiHandler(async (request: NextRequest) => {
  const body = await request.json();
  const { name, description, content } = body;

  if (!name || !content) {
    return error("缺少必填字段", 400);
  }

  const knowledgeBase = await createKnowledgeBase({
    name,
    description: description || "",
    content,
  });

  return success(knowledgeBase);
});
