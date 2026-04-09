import { NextRequest, NextResponse } from "next/server";
import { deleteCategory } from "@/lib/db";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deleted = await deleteCategory(params.id);
    if (!deleted) {
      return NextResponse.json(
        { code: 404, msg: "分类不存在" },
        { status: 404 }
      );
    }
    return NextResponse.json({ code: 0, msg: "deleted" });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { code: 500, msg: "删除分类失败" },
      { status: 500 }
    );
  }
}
