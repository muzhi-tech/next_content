import { NextRequest, NextResponse } from "next/server";
import { getCategories, updateCategorySchedule, getScheduledCategories } from "@/lib/db";

export async function GET() {
  try {
    const scheduled = await getScheduledCategories();
    return NextResponse.json({ code: 0, data: scheduled });
  } catch (err) {
    return NextResponse.json({ code: 500, msg: "获取调度配置失败" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.categoryId) {
      return NextResponse.json({ code: 400, msg: "缺少 categoryId" }, { status: 400 });
    }

    const updated = await updateCategorySchedule(body.categoryId, {
      scheduleEnabled: body.scheduleEnabled,
      scheduleInterval: body.scheduleInterval,
      autoIngest: body.autoIngest,
      ingestTopN: body.ingestTopN,
    });

    if (!updated) {
      return NextResponse.json({ code: 404, msg: "分类不存在" }, { status: 404 });
    }

    // Reload in-memory schedules (fire-and-forget, do not block response)
    import("@/lib/scheduler").then(({ reloadSchedules }) => {
      reloadSchedules().catch((err) => {
        console.error("[schedule/route] reloadSchedules error:", err);
      });
    });

    return NextResponse.json({ code: 0, data: updated });
  } catch (err) {
    return NextResponse.json({ code: 500, msg: "更新调度配置失败" }, { status: 500 });
  }
}
