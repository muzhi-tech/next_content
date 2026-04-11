import { NextRequest } from "next/server";
import { getPersonas, createPersona } from "@/lib/db";
import { apiHandler, success, error } from "@/lib/api-handler";

export const GET = apiHandler(async () => {
  const personas = await getPersonas();
  return success(personas);
});

export const POST = apiHandler(async (request: NextRequest) => {
  const body = await request.json();
  const { name, description, avatar, systemPrompt } = body;

  if (!name || !systemPrompt) {
    return error("缺少必填字段", 400);
  }

  const persona = await createPersona({
    name,
    description: description || "",
    avatar,
    systemPrompt,
  });

  return success(persona);
});
