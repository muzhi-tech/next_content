import { NextRequest, NextResponse } from "next/server";
import { updateApiConfig, deleteApiConfig } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, apiUrl, apiKey, modelName, isDefault, type, isDefaultImage } = body;

    const config = await updateApiConfig(params.id, {
      name,
      apiUrl,
      apiKey,
      modelName,
      isDefault,
      type,
      isDefaultImage,
    });

    if (!config) {
      return NextResponse.json(
        { code: 404, msg: "配置不存在", data: null },
        { status: 404 }
      );
    }

    return NextResponse.json({ code: 0, msg: "更新配置成功", data: config });
  } catch (error) {
    console.error("Error updating API config:", error);
    return NextResponse.json(
      { code: 500, msg: "更新配置失败", data: null },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deleted = await deleteApiConfig(params.id);

    if (!deleted) {
      return NextResponse.json(
        { code: 404, msg: "配置不存在", data: null },
        { status: 404 }
      );
    }

    return NextResponse.json({ code: 0, msg: "删除成功", data: null });
  } catch (error) {
    console.error("Error deleting API config:", error);
    return NextResponse.json(
      { code: 500, msg: "删除配置失败", data: null },
      { status: 500 }
    );
  }
}
