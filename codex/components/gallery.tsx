"use client";

import {
  Check,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Library,
  RefreshCw,
  Search,
  Sparkles,
  Wand2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DiscoverResponse, GalleryItem } from "@/lib/types";

type Props = {
  initialData: DiscoverResponse;
};

const PAGE_SIZE = 10;

export function Gallery({ initialData }: Props) {
  const [data, setData] = useState<DiscoverResponse>(initialData);
  const [keyword, setKeyword] = useState("");
  const [style, setStyle] = useState("all");
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const styles = useMemo(() => {
    const grouped = new Map<string, { label: string; count: number }>();
    for (const item of data.items) {
      const id = item.style || item.id;
      const current = grouped.get(id);
      grouped.set(id, {
        label: current?.label || item.styleLabel || item.title || item.style || item.id,
        count: (current?.count || 0) + getImages(item).length
      });
    }
    return Array.from(grouped, ([id, value]) => ({ id, ...value }));
  }, [data.items]);

  const filteredItems = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return data.items.filter((item) => {
      const matchesStyle = style === "all" || item.style === style || item.id === style;
      const haystack = [item.title, item.styleLabel, item.prompt, item.author, item.handle]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesStyle && (!term || haystack.includes(term));
    });
  }, [data.items, keyword, style]);

  const imageCards = useMemo(() => {
    return filteredItems.flatMap((item) => {
      const images = getImages(item);
      return images.map((image, index) => ({
        key: `${item.id}-${index}`,
        image,
        index,
        total: images.length,
        item
      }));
    });
  }, [filteredItems]);

  const pageCount = Math.max(1, Math.ceil(imageCards.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageCards = imageCards.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const imageCount = data.items.reduce((count, item) => count + getImages(item).length, 0);

  useEffect(() => {
    setPage(1);
  }, [keyword, style, data.items]);

  async function refreshLocal() {
    setRefreshing(true);
    setRefreshWarning(null);
    try {
      const response = await fetch("/api/refresh-local");
      const nextData = (await response.json()) as DiscoverResponse;

      if (!response.ok || !nextData.items.length) {
        setRefreshWarning(
          nextData.message ||
            "应用内刷新暂不可用，当前仍显示已经下载到本地的最新数据。"
        );
        return;
      }

      setData(nextData);
      setStyle("all");
      setPage(1);
    } catch (error) {
      setRefreshWarning(
        `应用内刷新暂不可用，当前仍显示已经下载到本地的数据：${error instanceof Error ? error.message : "未知错误"}`
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function copyPrompt(item: GalleryItem) {
    await navigator.clipboard.writeText(item.prompt);
    setCopiedId(item.id);
    window.setTimeout(() => setCopiedId(null), 1400);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <Wand2 size={22} />
          </div>
          <div>
            <h1>GPT Image 2 Prompt Gallery</h1>
            <p>本地原图与提示词素材库</p>
          </div>
        </div>
        <div className="status" title="网站只读取本地数据，X 抓取由 Codex 定时任务完成">
          <span className="pulse" />
          <span>{sourceLabel(data.source)}</span>
        </div>
      </header>

      <section className="toolbar" aria-label="搜索和筛选">
        <label className="field search-field">
          <Search size={18} aria-hidden="true" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="筛选风格、作者、提示词"
          />
        </label>
        <button className="primary-button" onClick={refreshLocal} disabled={refreshing} title="从本地 manifest 重新读取最新数据">
          <RefreshCw size={17} aria-hidden="true" />
          {refreshing ? "读取中" : "读取本地最新"}
        </button>
      </section>

      <section className="stats" aria-label="统计">
        <div className="stat">
          <span>条目</span>
          <strong>{data.items.length}</strong>
        </div>
        <div className="stat">
          <span>原图</span>
          <strong>{imageCount}</strong>
        </div>
        <div className="stat">
          <span>当前筛选</span>
          <strong>{imageCards.length}</strong>
        </div>
      </section>

      {data.message ? <div className="notice">{data.message}</div> : null}
      {refreshWarning ? <div className="notice warning">{refreshWarning}</div> : null}

      <div className="workspace">
        <aside className="style-list" aria-label="风格列表">
          <button
            className={style === "all" ? "style-option active" : "style-option"}
            onClick={() => setStyle("all")}
          >
            <Library size={16} aria-hidden="true" />
            <span>全部风格</span>
            <strong>{imageCount}</strong>
          </button>
          {styles.map(({ id, label, count }) => (
            <button
              className={style === id ? "style-option active" : "style-option"}
              key={id}
              onClick={() => setStyle(id)}
            >
              <ImageIcon size={16} aria-hidden="true" />
              <span>{label}</span>
              <strong>{count}</strong>
            </button>
          ))}
        </aside>

        {pageCards.length ? (
          <>
            <section className="gallery" aria-label="图片和提示词列表">
              {pageCards.map(({ key, image, index, total, item }) => (
                <article className="card" key={key}>
                  <div className="image-stage">
                    <img src={image} alt={item.title || item.prompt} loading="lazy" />
                    <span className="badge">
                      <Sparkles size={13} aria-hidden="true" />
                      {item.styleLabel || item.engine}
                    </span>
                    {item.createdAt ? <span className="badge time">{item.createdAt}</span> : null}
                  </div>

                  <div className="card-body">
                    <div className="card-heading">
                      <div>
                        <h2>{item.title || item.styleLabel || "Untitled prompt"}</h2>
                        <p>
                          {item.author} {item.handle}
                          {item.createdAt ? ` · ${item.createdAt}` : ""}
                          {total > 1 ? ` · 第 ${index + 1}/${total} 张` : ""}
                        </p>
                      </div>
                      <a className="icon-link" href={item.sourceUrl} target="_blank" rel="noreferrer" title="打开来源">
                        <ExternalLink size={17} aria-hidden="true" />
                      </a>
                    </div>
                    <div className="prompt-block">
                      <span className="prompt-label">提示词</span>
                      <p className="prompt">{item.prompt}</p>
                    </div>
                    <button className="copy-button" onClick={() => copyPrompt(item)}>
                      {copiedId === item.id ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                      {copiedId === item.id ? "已复制" : "复制提示词"}
                    </button>
                  </div>
                </article>
              ))}
            </section>
            <nav className="pagination" aria-label="分页">
              <button
                className="page-button"
                disabled={currentPage === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                上一页
              </button>
              <span>
                第 {currentPage} / {pageCount} 页 · 每页 {PAGE_SIZE} 张
              </span>
              <button
                className="page-button"
                disabled={currentPage === pageCount}
                onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
              >
                下一页
              </button>
            </nav>
          </>
        ) : (
          <section className="empty">
            <div>
              <strong>没有匹配结果</strong>
              <span>换一个筛选词或切回全部风格。</span>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function getImages(item: GalleryItem) {
  return item.images?.length ? item.images : [item.imageUrl];
}

function sourceLabel(source: DiscoverResponse["source"]) {
  if (source === "local") return "本地合并图库";
  if (source === "x-web") return "X 网页端更新";
  if (source === "x-api") return "X 官方 API";
  if (source === "nitter") return "公共镜像解析";
  if (source === "unavailable") return "暂不可抓取";
  return "待检测";
}
