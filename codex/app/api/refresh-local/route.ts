import { NextResponse } from "next/server";
import { readCombinedGallery } from "@/lib/live-gallery";
import type { DiscoverResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const gallery = await readCombinedGallery();

  return NextResponse.json<DiscoverResponse>({
    ...gallery,
    message: `${gallery.message} 网站刷新只读取本地数据，X 抓取由 Codex 每小时后台任务完成。`
  });
}
