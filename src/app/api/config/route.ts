import { NextRequest, NextResponse } from "next/server";
import { getApiConfigs, createApiConfig, getDefaultApiConfig } from "@/lib/db";

export async function GET() {
  try {
    const configs = await getApiConfigs();
    const defaultConfig = await getDefaultApiConfig();
    return NextResponse.json({ code: 0, msg: "获取配置成功", data: { configs, defaultConfig } });
  } catch (error) {
    console.error("Error getting API configs:", error);
    return NextResponse.json(
      { code: 500, msg: "获取配置失败", data: null },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, apiUrl, apiKey, modelName, isDefault, type, isDefaultImage } = body;

    if (!name || !apiUrl || !apiKey || !modelName) {
      return NextResponse.json(
        { code: 400, msg: "缺少必要参数", data: null },
        { status: 400 }
      );
    }

    const config = await createApiConfig({ name, apiUrl, apiKey, modelName, isDefault, type, isDefaultImage });
    return NextResponse.json({ code: 0, msg: "创建配置成功", data: config });
  } catch (error) {
    console.error("Error creating API config:", error);
    return NextResponse.json(
      { code: 500, msg: "创建配置失败", data: null },
      { status: 500 }
    );
  }
}
