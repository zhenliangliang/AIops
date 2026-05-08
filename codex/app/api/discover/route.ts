import { NextResponse } from "next/server";
import type { DiscoverResponse, GalleryItem } from "@/lib/types";

export const dynamic = "force-dynamic";

const DEFAULT_QUERY = process.env.DEFAULT_SEARCH_QUERY || "gpt-image-2 OR gpt-image2";
const DEFAULT_NITTER = process.env.NITTER_BASE_URL || "https://nitter.net";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() || DEFAULT_QUERY;
  const limit = clamp(Number(url.searchParams.get("limit") || 18), 6, 36);
  const attempted: string[] = [];
  const token = process.env.X_BEARER_TOKEN?.trim();
  let xApiError: string | undefined;

  if (token) {
    try {
      attempted.push("X Recent Search API");
      const items = await fetchFromXApi(query, token, limit);
      return NextResponse.json<DiscoverResponse>({
        source: "x-api",
        query,
        items,
        message: items.length
          ? `已通过 X 官方 API 拉取 ${items.length} 条真实图片内容。`
          : "X API 可访问，但没有返回带图片的 gpt-image2 相关推文。可以换搜索词再试。",
        diagnostics: {
          hasBearerToken: true,
          attempted
        }
      });
    } catch (error) {
      xApiError = error instanceof Error ? error.message : "X API failed";
      attempted.push(xApiError);
    }
  }

  try {
    attempted.push(`Nitter mirror: ${DEFAULT_NITTER}`);
    const items = await fetchFromNitter(query, limit);
    return NextResponse.json<DiscoverResponse>({
      source: "nitter",
      query,
      items,
      message: `已通过公开镜像解析 ${items.length} 条真实图片内容。`,
      diagnostics: {
        hasBearerToken: Boolean(token),
        attempted
      }
    });
  } catch (error) {
    attempted.push(error instanceof Error ? error.message : "Mirror failed");
    const xWebReachable = await canReachXWeb(query);
    return NextResponse.json<DiscoverResponse>({
      source: "unavailable",
      query,
      items: [],
      message: xApiError
        ? `X 官方 API 已连接，但没有返回可用数据：${humanizeXApiError(xApiError)}`
        : xWebReachable
        ? "本机能访问 X 的网页外壳，但 X 搜索结果由登录态和前端接口加载，HTML 中没有可直接解析的图片/提示词。请配置 X_BEARER_TOKEN 后刷新。"
        : "本机当前无法稳定访问 X 或公开镜像。请检查网络，或配置 X_BEARER_TOKEN 使用官方 API。",
      diagnostics: {
        hasBearerToken: Boolean(token),
        xWebReachable,
        attempted
      }
    });
  }
}

async function fetchFromXApi(query: string, token: string, limit: number): Promise<GalleryItem[]> {
  const endpoint = new URL("https://api.twitter.com/2/tweets/search/recent");
  endpoint.searchParams.set("query", `(${query}) has:images -is:retweet`);
  endpoint.searchParams.set("max_results", String(Math.max(10, Math.min(limit, 100))));
  endpoint.searchParams.set("expansions", "attachments.media_keys,author_id");
  endpoint.searchParams.set("media.fields", "url,preview_image_url,type");
  endpoint.searchParams.set("tweet.fields", "created_at");
  endpoint.searchParams.set("user.fields", "name,username");

  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 300 }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`X API returned ${response.status}${body ? `: ${body.slice(0, 220)}` : ""}`);
  }

  const data = await response.json();
  const media = new Map<string, { url?: string; preview_image_url?: string; type?: string }>();
  for (const item of data.includes?.media || []) {
    media.set(item.media_key, item);
  }

  const users = new Map<string, { name?: string; username?: string }>();
  for (const user of data.includes?.users || []) {
    users.set(user.id, user);
  }

  const items: GalleryItem[] = [];
  for (const tweet of data.data || []) {
    const firstImageKey = tweet.attachments?.media_keys?.find((key: string) => {
      const mediaItem = media.get(key);
      return mediaItem?.type === "photo" && (mediaItem.url || mediaItem.preview_image_url);
    });
    if (!firstImageKey) continue;

    const user = users.get(tweet.author_id) || {};
    const image = media.get(firstImageKey);
    items.push({
      id: tweet.id,
      author: user.name || "X user",
      handle: user.username ? `@${user.username}` : "@unknown",
      prompt: extractPrompt(tweet.text || ""),
      imageUrl: image?.url || image?.preview_image_url || "",
      sourceUrl: user.username
        ? `https://x.com/${user.username}/status/${tweet.id}`
        : `https://x.com/i/web/status/${tweet.id}`,
      createdAt: formatDate(tweet.created_at),
      engine: detectEngine(tweet.text || "")
    });
  }

  return items.slice(0, limit);
}

async function fetchFromNitter(query: string, limit: number): Promise<GalleryItem[]> {
  const base = DEFAULT_NITTER.replace(/\/$/, "");
  const searchUrl = `${base}/search?f=tweets&q=${encodeURIComponent(query)}`;
  const response = await fetch(searchUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; GPTImage2Gallery/1.0; +https://vercel.app)"
    },
    next: { revalidate: 300 }
  });

  if (!response.ok) {
    throw new Error(`Mirror returned ${response.status}`);
  }

  const html = await response.text();
  const cards = html.match(/<div class="timeline-item[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g) || [];
  const items: GalleryItem[] = [];

  for (const card of cards) {
    const image = firstMatch(card, /<img[^>]+src="([^"]+)"[^>]*class="[^"]*(?:attachment|still-image|media)[^"]*"/i)
      || firstMatch(card, /<img[^>]+class="[^"]*(?:attachment|still-image|media)[^"]*"[^>]+src="([^"]+)"/i);
    const text = decodeHtml(stripTags(firstMatch(card, /<div class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || ""));
    if (!image || !/gpt-?image-?2/i.test(text)) continue;

    const href = firstMatch(card, /<a class="tweet-link" href="([^"]+)"/i) || "";
    const fullname = decodeHtml(stripTags(firstMatch(card, /<a class="fullname"[^>]*>([\s\S]*?)<\/a>/i) || "X user"));
    const username = decodeHtml(stripTags(firstMatch(card, /<a class="username"[^>]*>([\s\S]*?)<\/a>/i) || "@unknown"));

    items.push({
      id: href || `${items.length}-${text.slice(0, 20)}`,
      author: fullname.trim() || "X user",
      handle: username.trim() || "@unknown",
      prompt: extractPrompt(text),
      imageUrl: absolutize(image, base),
      sourceUrl: href ? `https://x.com${href}` : "https://x.com/search?q=gpt-image-2",
      createdAt: decodeHtml(stripTags(firstMatch(card, /<span class="tweet-date"[^>]*>([\s\S]*?)<\/span>/i) || "")),
      engine: detectEngine(text)
    });

    if (items.length >= limit) break;
  }

  if (!items.length) {
    throw new Error("No public image posts found from the configured mirror");
  }

  return items;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function firstMatch(input: string, regex: RegExp) {
  return regex.exec(input)?.[1];
}

function stripTags(input: string) {
  return input.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
}

function decodeHtml(input: string) {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function absolutize(url: string, base: string) {
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

function cleanPrompt(text: string) {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 520);
}

function extractPrompt(text: string) {
  const cleaned = cleanPrompt(text);
  const promptMatch = /(?:prompt|提示词)\s*[:：]\s*([\s\S]+)/i.exec(cleaned);
  return (promptMatch?.[1] || cleaned).slice(0, 520);
}

function detectEngine(text: string): GalleryItem["engine"] {
  return /gpt-?image-?2/i.test(text) ? "gpt-image-2" : "unknown";
}

function formatDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

async function canReachXWeb(query: string) {
  try {
    const url = `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
      },
      signal: AbortSignal.timeout(8000)
    });
    const html = await response.text();
    return response.ok && /X \(formerly Twitter\)|api\.x\.com|react-native-stylesheet/i.test(html);
  } catch {
    return false;
  }
}

function humanizeXApiError(error: string) {
  if (/CreditsDepleted|credits/i.test(error)) {
    return "当前 X 开发者账号 API credits 已用完或未开通可用额度。";
  }
  if (/401|Unauthorized/i.test(error)) {
    return "Bearer Token 无效或已被吊销。";
  }
  if (/403|Forbidden/i.test(error)) {
    return "Bearer Token 有效，但没有 Recent Search 权限。";
  }
  if (/429|Too Many Requests/i.test(error)) {
    return "请求频率超过 X API 限制。";
  }
  return error;
}
