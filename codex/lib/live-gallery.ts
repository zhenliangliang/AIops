import { readFile } from "node:fs/promises";
import path from "node:path";
import { collectedItems } from "@/lib/collected-gallery";
import type { DiscoverResponse, GalleryItem } from "@/lib/types";

export const liveGalleryDir = path.join(
  process.cwd(),
  "public",
  "collected",
  "live-gpt-image-2"
);

export const liveManifestPath = path.join(liveGalleryDir, "manifest.json");

export async function readLiveGallery(): Promise<DiscoverResponse | null> {
  try {
    const items = JSON.parse(await readFile(liveManifestPath, "utf8")) as GalleryItem[];
    if (!Array.isArray(items) || !items.length) return null;

    return {
      source: "x-web",
      query: "GPT Image 2 prompt latest local manifest",
      items,
      message: `展示最新后台更新结果：${items.length} 条帖子，${countImages(items)} 张原图。`
    };
  } catch {
    return null;
  }
}

export async function readCombinedGallery(): Promise<DiscoverResponse> {
  const liveGallery = await readLiveGallery();
  const merged = mergeGalleryItems([...(liveGallery?.items || []), ...collectedItems]);
  const liveCount = liveGallery?.items.length || 0;
  const historicalCount = merged.length - liveCount;

  return {
    source: "local",
    query: "GPT Image 2 local combined gallery",
    items: merged,
    message: liveGallery
      ? `展示本地合并图库：最新后台 ${liveCount} 条，历史分类 ${historicalCount} 条，共 ${countImages(merged)} 张原图。`
      : `展示历史分类图库：${historicalCount} 条，共 ${countImages(merged)} 张原图。`
  };
}

export function countImages(items: GalleryItem[]) {
  return items.reduce((sum, item) => sum + (item.images?.length || 1), 0);
}

function mergeGalleryItems(items: GalleryItem[]) {
  const seen = new Set<string>();
  const merged: GalleryItem[] = [];

  for (const item of items) {
    const key = item.sourceUrl || item.id;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}
