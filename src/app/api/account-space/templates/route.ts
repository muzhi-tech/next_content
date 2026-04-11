import { NextRequest } from "next/server";
import { getTemplates, createTemplate } from "@/lib/db";
import { apiHandler, success, error } from "@/lib/api-handler";

export const GET = apiHandler(async () => {
  const templates = await getTemplates();
  return success(templates);
});

export const POST = apiHandler(async (request: NextRequest) => {
  const body = await request.json();
  const { name, titleTemplate, contentTemplate, coverPromptTemplate } = body;

  if (!name || !titleTemplate || !contentTemplate) {
    return error("缺少必填字段", 400);
  }

  const template = await createTemplate({
    name,
    titleTemplate,
    contentTemplate,
    coverPromptTemplate,
  });

  return success(template);
});
