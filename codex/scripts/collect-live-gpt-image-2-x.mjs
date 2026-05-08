#!/usr/bin/env node
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const liveDir = path.join(repoRoot, "public", "collected", "live-gpt-image-2");
const manifestPath = path.join(liveDir, "manifest.json");

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function relToPublic(absPath) {
  const publicRoot = path.join(repoRoot, "public") + path.sep;
  if (!absPath.startsWith(publicRoot)) return null;
  return "/" + toPosixPath(absPath.slice(publicRoot.length));
}

function sortImageFilenames(a, b) {
  const extract = (name) => {
    const match = name.match(/original-(\d+)\./i);
    return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
  };
  return extract(a) - extract(b) || a.localeCompare(b);
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listPostDirsById() {
  const entries = await readdir(liveDir, { withFileTypes: true });
  const byId = new Map();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    const match = name.match(/-(\d{10,})$/);
    if (!match) continue;
    const id = match[1];
    const dirs = byId.get(id) || [];
    dirs.push(path.join(liveDir, name));
    byId.set(id, dirs);
  }

  return byId;
}

async function pickNewestValidDir(dirPaths) {
  const candidates = [];
  for (const dirPath of dirPaths) {
    const files = await readdir(dirPath, { withFileTypes: true });
    const imageFiles = files
      .filter((f) => f.isFile() && /^original-\d+\.(jpg|jpeg|png|webp)$/i.test(f.name))
      .map((f) => f.name)
      .sort(sortImageFilenames);

    if (!imageFiles.length) continue;

    const promptPath = path.join(dirPath, "prompt.md");
    const promptOk = await fileExists(promptPath);
    const dirStat = await stat(dirPath);
    const newestMtimeMs = Math.max(
      dirStat.mtimeMs,
      ...(await Promise.all(imageFiles.map((n) => stat(path.join(dirPath, n)).then((s) => s.mtimeMs))))
    );

    candidates.push({
      dirPath,
      imageFiles,
      promptOk,
      newestMtimeMs
    });
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    if (b.newestMtimeMs !== a.newestMtimeMs) return b.newestMtimeMs - a.newestMtimeMs;
    if (a.promptOk !== b.promptOk) return a.promptOk ? -1 : 1;
    return a.dirPath.localeCompare(b.dirPath);
  });

  return candidates[0];
}

function buildPromptMarkdown(item) {
  const title = isNonEmptyString(item.title) ? item.title.trim() : item.prompt?.trim()?.slice(0, 80) || "GPT Image 2 prompt";
  const lines = [];

  lines.push(`# ${title}`);
  lines.push("");
  if (isNonEmptyString(item.sourceUrl)) lines.push(`Source: ${item.sourceUrl.trim()}`);
  if (isNonEmptyString(item.author) || isNonEmptyString(item.handle)) {
    const author = isNonEmptyString(item.author) ? item.author.trim() : "X user";
    const handle = isNonEmptyString(item.handle) ? item.handle.trim() : "@unknown";
    lines.push(`Author: ${author} ${handle}`);
  }
  if (isNonEmptyString(item.createdAt)) lines.push(`CreatedAt: ${item.createdAt.trim()}`);
  if (Array.isArray(item.directImageUrls) && item.directImageUrls.length) {
    const urls = item.directImageUrls.filter(isNonEmptyString);
    if (urls.length) {
      lines.push("");
      lines.push("DirectImageUrls:");
      for (const url of urls) lines.push(`- ${url.trim()}`);
    }
  }

  lines.push("");
  lines.push("## Prompt");
  lines.push("");
  lines.push(isNonEmptyString(item.prompt) ? item.prompt.trim() : "");
  lines.push("");

  return lines.join("\n");
}

function parsePromptMarkdown(markdown) {
  if (!isNonEmptyString(markdown)) return null;
  const lines = markdown.split(/\r?\n/);

  let title = null;
  let sourceUrl = null;
  let author = null;
  let handle = null;
  let createdAt = null;
  const directImageUrls = [];

  let inDirectUrls = false;
  let inPrompt = false;
  const promptLines = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.startsWith("# ") && !title) title = line.slice(2).trim();
    if (line.startsWith("Source: ")) sourceUrl = line.slice("Source: ".length).trim();
    if (line.startsWith("Author: ")) {
      const rest = line.slice("Author: ".length).trim();
      const parts = rest.split(/\s+/);
      if (parts.length >= 2) {
        handle = parts[parts.length - 1];
        author = parts.slice(0, -1).join(" ");
      } else {
        author = rest;
      }
    }
    if (line.startsWith("CreatedAt: ")) createdAt = line.slice("CreatedAt: ".length).trim();

    if (line === "DirectImageUrls:") {
      inDirectUrls = true;
      inPrompt = false;
      continue;
    }
    if (line === "## Prompt") {
      inPrompt = true;
      inDirectUrls = false;
      continue;
    }

    if (inDirectUrls) {
      const match = line.match(/^- (.+)$/);
      if (match) directImageUrls.push(match[1].trim());
      continue;
    }

    if (inPrompt) {
      promptLines.push(rawLine);
    }
  }

  const prompt = promptLines.join("\n").trim();
  return {
    title: isNonEmptyString(title) ? title : undefined,
    sourceUrl: isNonEmptyString(sourceUrl) ? sourceUrl : undefined,
    author: isNonEmptyString(author) ? author : undefined,
    handle: isNonEmptyString(handle) ? handle : undefined,
    createdAt: isNonEmptyString(createdAt) ? createdAt : undefined,
    directImageUrls: directImageUrls.filter(isNonEmptyString).length ? directImageUrls.filter(isNonEmptyString) : undefined,
    prompt: isNonEmptyString(prompt) ? prompt : undefined
  };
}

async function main() {
  const existingManifestText = (await fileExists(manifestPath)) ? await readFile(manifestPath, "utf8") : "[]";
  const existingManifest = safeJsonParse(existingManifestText);
  const existingItems = Array.isArray(existingManifest) ? existingManifest : [];

  const byId = new Map();
  for (const item of existingItems) {
    if (!item || !isNonEmptyString(item.id)) continue;
    byId.set(String(item.id), item);
  }

  const postDirsById = await listPostDirsById();

  const nextItems = [];
  let promptFilesWritten = 0;

  const allIds = new Set([...byId.keys(), ...postDirsById.keys()]);

  for (const id of allIds) {
    const item = byId.get(id) || null;
    const dirs = postDirsById.get(id) || [];
    if (!dirs.length) continue;

    const picked = await pickNewestValidDir(dirs);
    if (!picked) continue;

    const relImages = picked.imageFiles
      .map((name) => relToPublic(path.join(picked.dirPath, name)))
      .filter(Boolean);
    if (!relImages.length) continue;

    const promptPath = path.join(picked.dirPath, "prompt.md");
    const existingPrompt = (await fileExists(promptPath)) ? await readFile(promptPath, "utf8") : null;
    const parsedFromPrompt = existingPrompt ? parsePromptMarkdown(existingPrompt) : null;

    const baseItem =
      item ||
      ({
        id,
        style: "live-gpt-image-2",
        styleLabel: "最新24h",
        author: parsedFromPrompt?.author || "X user",
        handle: parsedFromPrompt?.handle || "@unknown",
        prompt: parsedFromPrompt?.prompt || "",
        imageUrl: relImages[0],
        sourceUrl: parsedFromPrompt?.sourceUrl || "https://x.com/search?q=gpt-image-2",
        createdAt: parsedFromPrompt?.createdAt,
        directImageUrls: parsedFromPrompt?.directImageUrls,
        title: parsedFromPrompt?.title,
        engine: /gpt-?image-?2/i.test(parsedFromPrompt?.prompt || parsedFromPrompt?.title || "") ? "gpt-image-2" : "unknown"
      });

    const promptMd = buildPromptMarkdown(baseItem);
    if (existingPrompt !== promptMd) {
      await writeFile(promptPath, promptMd, "utf8");
      promptFilesWritten += 1;
    }

    const nextItem = {
      ...baseItem,
      id,
      imageUrl: relImages[0],
      images: relImages
    };

    nextItems.push(nextItem);
  }

  // Sort newest-first when createdAt is parseable; otherwise keep stable by id desc.
  nextItems.sort((a, b) => {
    const ad = isNonEmptyString(a.createdAt) ? Date.parse(a.createdAt) : Number.NaN;
    const bd = isNonEmptyString(b.createdAt) ? Date.parse(b.createdAt) : Number.NaN;
    if (!Number.isNaN(ad) && !Number.isNaN(bd) && bd !== ad) return bd - ad;
    return String(b.id).localeCompare(String(a.id));
  });

  if (!nextItems.length) {
    process.stdout.write(
      `No valid local post folders found; preserving existing manifest. prompt.md updated: ${promptFilesWritten}\n`
    );
    return;
  }

  const nextManifestText = JSON.stringify(nextItems, null, 2) + "\n";
  if (nextManifestText !== existingManifestText) {
    await writeFile(manifestPath, nextManifestText, "utf8");
  }

  const imageCount = nextItems.reduce((sum, item) => sum + (Array.isArray(item.images) ? item.images.length : 0), 0);
  process.stdout.write(
    `Saved ${nextItems.length} posts, ${imageCount} images. prompt.md updated: ${promptFilesWritten}\n`
  );
}

await main();
