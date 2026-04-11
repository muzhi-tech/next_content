import { NextRequest } from "next/server";
import { getStyles, createStyle } from "@/lib/db";
import { apiHandler, success, error } from "@/lib/api-handler";

export const GET = apiHandler(async () => {
  const styles = await getStyles();
  return success(styles);
});

export const POST = apiHandler(async (request: NextRequest) => {
  const body = await request.json();
  const { name, icon, systemPrompt } = body;

  if (!name || !icon || !systemPrompt) {
    return error("缺少必填字段", 400);
  }

  const style = await createStyle({ name, icon, systemPrompt });
  return success(style);
});
