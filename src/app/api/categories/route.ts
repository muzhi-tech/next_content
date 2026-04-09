import { NextRequest, NextResponse } from "next/server";
import { getCategories, createCategory } from "@/lib/db";

export async function GET() {
  try {
    const categories = await getCategories();
    return NextResponse.json({ code: 0, data: categories });
  } catch (error) {
    console.error("Error getting categories:", error);
    return NextResponse.json(
      { code: 500, msg: "获取分类失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { code: 400, msg: "缺少分类名称" },
        { status: 400 }
      );
    }

    const category = await createCategory(name);
    return NextResponse.json({ code: 0, data: category });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { code: 500, msg: "创建分类失败" },
      { status: 500 }
    );
  }
}
