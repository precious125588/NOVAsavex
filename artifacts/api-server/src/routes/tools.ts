import { Router, Request, Response } from "express";
import crypto from "crypto";
import { logger } from "../lib/logger.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import zlib from "zlib";
import { promisify } from "util";

const router = Router();

const DAVID = "https://apis.davidcyril.name.ng";
const PREX = "https://apis.prexzyvilla.site";

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const UPLOAD_DIR = "/tmp/novasave-tools";
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".txt";
    cb(null, `${Date.now()}_${crypto.randomBytes(4).toString("hex")}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

async function fetchJson(url: string, timeoutMs = 30000, body?: unknown): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const opts: RequestInit = {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json", "Content-Type": "application/json" },
    };
    if (body) { opts.method = "POST"; opts.body = JSON.stringify(body); }
    const resp = await fetch(url, opts);
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`API ${resp.status}`);
    return await resp.json() as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

function safeStr(v: unknown): string { return typeof v === "string" ? v : ""; }
function safeRec(v: unknown): Record<string, unknown> { return (v && typeof v === "object" && !Array.isArray(v)) ? v as Record<string, unknown> : {}; }

// ──────────────── CODE DEBUGGER ────────────────
router.post("/tools/debug", async (req: Request, res: Response) => {
  const { code, language = "javascript", question = "Debug and explain this code" } = req.body as { code?: string; language?: string; question?: string };
  if (!code || code.trim().length < 3) { res.status(400).json({ error: "Code is required" }); return; }

  const prompt = `You are an expert ${language} developer and debugger. Analyze the following ${language} code.

TASK: ${question}

CODE:
\`\`\`${language}
${code.slice(0, 10000)}
\`\`\`

Provide:
1. **Bugs Found**: List any bugs, errors, or issues
2. **Fixes**: Corrected code
3. **Explanation**: What the code does and how it works
4. **Improvements**: Suggestions to make the code better

Respond in a clear, structured format.`;

  const aiEndpoints = [
    `${DAVID}/ai/chat`,
    `${DAVID}/ai/gpt`,
    `${PREX}/ai/chat`,
    `${DAVID}/chatgpt`,
    `${PREX}/chatgpt`,
  ];

  for (const endpoint of aiEndpoints) {
    try {
      const data = await fetchJson(endpoint, 40000, { prompt, message: prompt, content: prompt, text: prompt });
      const reply = safeStr(data.response) || safeStr(data.result) || safeStr(data.answer) || safeStr(data.message) || safeStr(data.text) || safeStr(safeRec(data.data).response) || safeStr(safeRec(data.data).message);
      if (reply && reply.length > 20) {
        res.json({ result: reply, language, endpoint });
        return;
      }
    } catch (err) {
      logger.warn({ err, endpoint }, "AI debug endpoint failed");
    }
  }

  // Fallback: basic static analysis
  const lines = code.split("\n");
  const issues: string[] = [];
  if (code.includes("console.log")) issues.push("Remove console.log statements before production");
  if (code.includes("var ")) issues.push("Consider using let/const instead of var");
  if (code.includes("==") && !code.includes("===")) issues.push("Use === instead of == for strict equality");
  if (code.match(/TODO|FIXME|HACK/g)) issues.push("Found TODO/FIXME comments that need attention");
  if (!code.includes("try") && (code.includes("fetch") || code.includes("async"))) issues.push("Consider adding try/catch for async operations");

  res.json({
    result: `Code Analysis (${language}):\n\nLines: ${lines.length}\nCharacters: ${code.length}\n\n${issues.length > 0 ? "Issues Found:\n" + issues.map(i => `• ${i}`).join("\n") : "• No obvious issues detected"}\n\nNote: AI-powered analysis is temporarily unavailable. Please try again later.`,
    language,
    fallback: true,
  });
});

router.post("/tools/debug-file", upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
  try {
    const code = fs.readFileSync(req.file.path, "utf-8");
    const language = req.body.language || path.extname(req.file.originalname).replace(".", "") || "text";
    fs.unlinkSync(req.file.path);
    req.body.code = code;
    req.body.language = language;
    // Re-use the same logic
    const prompt = `Debug and explain this ${language} code:\n\n\`\`\`${language}\n${code.slice(0, 10000)}\n\`\`\``;
    const aiEndpoints = [`${DAVID}/ai/chat`, `${DAVID}/ai/gpt`, `${PREX}/ai/chat`];
    for (const endpoint of aiEndpoints) {
      try {
        const data = await fetchJson(endpoint, 40000, { prompt, message: prompt });
        const reply = safeStr(data.response) || safeStr(data.result) || safeStr(data.answer) || safeStr(data.message);
        if (reply && reply.length > 20) { res.json({ result: reply, language, filename: req.file.originalname }); return; }
      } catch { /* try next */ }
    }
    res.json({ result: `Code analyzed: ${code.split("\n").length} lines in ${language}. AI analysis unavailable.`, language });
  } catch (err) {
    logger.error({ err }, "Debug file failed");
    res.status(500).json({ error: "Failed to process code file" });
  }
});

// ──────────────── TEXT TO PDF ────────────────
router.post("/tools/text-to-pdf", async (req: Request, res: Response) => {
  const { text, title = "Document", font = "Arial", fontSize = 14 } = req.body as { text?: string; title?: string; font?: string; fontSize?: number };
  if (!text || text.trim().length < 1) { res.status(400).json({ error: "Text content is required" }); return; }

  const safeTitle = title.replace(/[<>&"]/g, "").slice(0, 100);
  const safeText = text.replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
  const lines = safeText.split("\n");
  const htmlContent = lines.map(l => l.trim() ? `<p>${l}</p>` : "<br/>").join("");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${safeTitle}</title>
<style>
  body { font-family: '${font}', Arial, sans-serif; font-size: ${fontSize}px; margin: 40px; color: #1a1a1a; line-height: 1.6; }
  h1 { color: #333; border-bottom: 2px solid #7c3aed; padding-bottom: 10px; }
  p { margin: 8px 0; }
</style>
</head>
<body>
<h1>${safeTitle}</h1>
<div class="content">${htmlContent}</div>
<footer style="margin-top:40px;padding-top:10px;border-top:1px solid #eee;font-size:11px;color:#999">Generated by NOVAsavex — built by 𝑷𝑹𝑬𝑪𝑰𝑶𝑼𝑺 x</footer>
</body>
</html>`;

  const outputId = `pdf_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const htmlPath = path.join(UPLOAD_DIR, `${outputId}.html`);
  fs.writeFileSync(htmlPath, html, "utf-8");

  // Try AI PDF generation service
  const aiEndpoints = [
    `${DAVID}/tools/text-to-pdf`,
    `${DAVID}/convert/text-to-pdf`,
    `${PREX}/tools/pdf`,
  ];

  for (const endpoint of aiEndpoints) {
    try {
      const data = await fetchJson(endpoint, 20000, { text, title, html });
      const pdfUrl = safeStr(data.url) || safeStr(data.pdf) || safeStr(data.download);
      if (pdfUrl) {
        fs.unlinkSync(htmlPath);
        res.json({ pdfUrl, title }); return;
      }
    } catch { /* try next */ }
  }

  // Return HTML as download fallback (browsers can print to PDF)
  res.json({
    htmlUrl: `/api/tools/download-file?file=${outputId}.html`,
    htmlContent: html,
    title,
    message: "HTML file ready — open in browser and use Print → Save as PDF",
    tip: "Press Ctrl+P (Cmd+P on Mac) → Save as PDF",
  });
});

// ──────────────── ZIP / UNZIP ────────────────
router.post("/tools/compress", upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
  const inputPath = req.file.path;
  const outputPath = `${inputPath}.gz`;
  try {
    const input = fs.readFileSync(inputPath);
    const compressed = await gzip(input);
    fs.writeFileSync(outputPath, compressed);
    fs.unlinkSync(inputPath);
    const stat = fs.statSync(outputPath);
    const outputId = path.basename(outputPath);
    res.json({
      outputFile: outputId,
      originalName: req.file.originalname,
      compressedName: `${req.file.originalname}.gz`,
      originalSize: input.length,
      compressedSize: stat.size,
      ratio: Math.round((1 - stat.size / input.length) * 100),
      downloadPath: `/api/tools/download-file?file=${encodeURIComponent(outputId)}&name=${encodeURIComponent(req.file.originalname + ".gz")}`,
    });
    setTimeout(() => { try { fs.unlinkSync(outputPath); } catch { /* ignore */ } }, 60 * 60 * 1000);
  } catch (err) {
    logger.error({ err }, "Compress failed");
    try { fs.unlinkSync(inputPath); } catch { /* ignore */ }
    res.status(500).json({ error: "Compression failed" });
  }
});

router.post("/tools/decompress", upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
  const inputPath = req.file.path;
  const origName = req.file.originalname;
  const outputName = origName.endsWith(".gz") ? origName.slice(0, -3) : `${origName}.decompressed`;
  const ext = path.extname(outputName) || ".txt";
  const outputPath = path.join(UPLOAD_DIR, `${Date.now()}_decompressed${ext}`);
  try {
    const input = fs.readFileSync(inputPath);
    const decompressed = await gunzip(input);
    fs.writeFileSync(outputPath, decompressed);
    fs.unlinkSync(inputPath);
    const stat = fs.statSync(outputPath);
    const outputId = path.basename(outputPath);
    res.json({
      outputFile: outputId,
      decompressedName: outputName,
      compressedSize: input.length,
      decompressedSize: stat.size,
      downloadPath: `/api/tools/download-file?file=${encodeURIComponent(outputId)}&name=${encodeURIComponent(outputName)}`,
    });
    setTimeout(() => { try { fs.unlinkSync(outputPath); } catch { /* ignore */ } }, 60 * 60 * 1000);
  } catch (err) {
    logger.error({ err }, "Decompress failed");
    try { fs.unlinkSync(inputPath); } catch { /* ignore */ }
    res.status(500).json({ error: "Decompression failed. Ensure file is gzip-compressed." });
  }
});

// ──────────────── ENCRYPT / DECRYPT ────────────────
router.post("/tools/encrypt", async (req: Request, res: Response) => {
  const { text, key, algorithm = "aes-256-gcm" } = req.body as { text?: string; key?: string; algorithm?: string };
  if (!text) { res.status(400).json({ error: "Text to encrypt is required" }); return; }
  if (!key || key.length < 8) { res.status(400).json({ error: "Encryption key must be at least 8 characters" }); return; }

  try {
    const keyBuffer = crypto.scryptSync(key, "novasavex-salt", 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", keyBuffer, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = (cipher as import("crypto").CipherGCM).getAuthTag().toString("hex");
    const result = `${iv.toString("hex")}:${authTag}:${encrypted}`;
    res.json({ encrypted: result, algorithm: "aes-256-gcm", length: result.length });
  } catch (err) {
    logger.error({ err }, "Encrypt failed");
    res.status(500).json({ error: "Encryption failed" });
  }
});

router.post("/tools/decrypt", async (req: Request, res: Response) => {
  const { encrypted, key } = req.body as { encrypted?: string; key?: string };
  if (!encrypted) { res.status(400).json({ error: "Encrypted text is required" }); return; }
  if (!key || key.length < 8) { res.status(400).json({ error: "Decryption key must be at least 8 characters" }); return; }

  try {
    const parts = encrypted.split(":");
    if (parts.length !== 3) { res.status(400).json({ error: "Invalid encrypted format. Encrypt text first using NOVAsavex." }); return; }
    const [ivHex, authTagHex, encryptedHex] = parts;
    const keyBuffer = crypto.scryptSync(key, "novasavex-salt", 32);
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuffer, iv);
    (decipher as import("crypto").DecipherGCM).setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    res.json({ decrypted, success: true });
  } catch (err) {
    logger.error({ err }, "Decrypt failed");
    res.status(400).json({ error: "Decryption failed. Wrong key or corrupted data." });
  }
});

// ──────────────── TRENDING CONTENT ────────────────
router.get("/tools/trending", async (req: Request, res: Response) => {
  const type = (req.query.type as string) || "all";
  const endpoints: Record<string, string[]> = {
    movies: [`${DAVID}/trending/movies`, `${DAVID}/movies/trending`, `${PREX}/trending/movies`],
    songs: [`${DAVID}/trending/songs`, `${DAVID}/music/trending`, `${PREX}/trending/songs`],
    videos: [`${DAVID}/trending/videos`, `${PREX}/trending/videos`, `${DAVID}/trending/tiktok`],
    all: [`${DAVID}/trending`, `${PREX}/trending`, `${DAVID}/trending/all`],
  };

  const eps = endpoints[type] || endpoints.all;
  for (const endpoint of eps) {
    try {
      const data = await fetchJson(endpoint);
      if (data && (data.data || data.result || data.trending || data.movies || data.songs || data.videos)) {
        res.json(data);
        return;
      }
    } catch { /* try next */ }
  }
  res.json({ data: [], message: `Trending ${type} data unavailable` });
});

// ──────────────── SCRAPE CODE STRUCTURE ────────────────
router.post("/tools/scrape-structure", async (req: Request, res: Response) => {
  const { url } = req.body as { url?: string };
  if (!url) { res.status(400).json({ error: "URL required" }); return; }

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) { res.status(400).json({ error: "Invalid URL" }); return; }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NOVAsavex/1.0)" },
    });
    clearTimeout(timer);

    if (!resp.ok) { res.status(400).json({ error: `Failed to fetch: ${resp.status}` }); return; }
    const html = await resp.text();

    // Extract structure
    const title = html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1] || "";
    const metaDesc = html.match(/name="description"\s+content="([^"]+)"/i)?.[1] || "";
    const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/gi)].map(m => m[1]).filter(Boolean);
    const styles = [...html.matchAll(/<link[^>]*href="([^"]+\.css[^"]*?)"/gi)].map(m => m[1]).filter(Boolean);
    const images = [...html.matchAll(/<img[^>]*src="([^"]+)"/gi)].map(m => m[1]).slice(0, 20);
    const links = [...html.matchAll(/<a[^>]*href="([^"#][^"]*?)"/gi)].map(m => m[1]).slice(0, 20);
    const headings = [...html.matchAll(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi)].map(m => m[1].replace(/<[^>]+>/g, "")).filter(Boolean).slice(0, 10);
    const forms = [...html.matchAll(/<form[^>]*>/gi)].length;
    const iframes = [...html.matchAll(/<iframe[^>]*src="([^"]+)"/gi)].map(m => m[1]);

    // Detect technologies
    const technologies: string[] = [];
    if (html.includes("react")) technologies.push("React");
    if (html.includes("vue")) technologies.push("Vue.js");
    if (html.includes("angular")) technologies.push("Angular");
    if (html.includes("jquery")) technologies.push("jQuery");
    if (html.includes("tailwind")) technologies.push("Tailwind CSS");
    if (html.includes("bootstrap")) technologies.push("Bootstrap");
    if (html.includes("next")) technologies.push("Next.js");
    if (html.includes("wordpress")) technologies.push("WordPress");

    res.json({
      url,
      title: title.replace(/&[a-z]+;/g, ""),
      description: metaDesc,
      htmlSize: html.length,
      structure: {
        scripts: scripts.slice(0, 10),
        styles: styles.slice(0, 10),
        images: images.slice(0, 10),
        links: links.slice(0, 10),
        headings,
        forms,
        iframes: iframes.slice(0, 5),
      },
      technologies,
      rawHtmlPreview: html.slice(0, 2000),
    });
  } catch (err) {
    logger.error({ err }, "Scrape structure failed");
    res.status(500).json({ error: "Failed to scrape URL. It may be blocked or unreachable." });
  }
});

// ──────────────── GITHUB PUSH ────────────────
router.post("/tools/github-push", async (req: Request, res: Response) => {
  const { repoUrl, token, branch = "main", message = "Update via NOVAsavex", files } = req.body as {
    repoUrl?: string;
    token?: string;
    branch?: string;
    message?: string;
    files?: Array<{ path: string; content: string }>;
  };

  if (!repoUrl) { res.status(400).json({ error: "GitHub repository URL required" }); return; }
  if (!token) { res.status(400).json({ error: "GitHub personal access token required" }); return; }
  if (!files || !Array.isArray(files) || files.length === 0) {
    res.status(400).json({ error: "At least one file is required" });
    return;
  }

  try {
    const repoMatch = repoUrl.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\s|$|\/)/);
    if (!repoMatch) { res.status(400).json({ error: "Invalid GitHub repo URL. Format: https://github.com/owner/repo" }); return; }
    const owner = repoMatch[1];
    const repo = repoMatch[2];

    const headers = {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "NOVAsavex/1.0",
    };

    // Get or create branch ref
    let sha: string | undefined;
    try {
      const refResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`, { headers });
      if (refResp.ok) {
        const refData = await refResp.json() as { object?: { sha?: string } };
        sha = refData?.object?.sha;
      }
    } catch { /* new branch */ }

    // Push each file
    const results: Array<{ path: string; success: boolean; sha?: string; error?: string }> = [];
    for (const file of files.slice(0, 10)) {
      if (!file.path || !file.content) continue;
      const contentB64 = Buffer.from(file.content, "utf-8").toString("base64");

      // Check if file exists to get its SHA
      let existingSha: string | undefined;
      try {
        const existResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${branch}`, { headers });
        if (existResp.ok) {
          const existData = await existResp.json() as { sha?: string };
          existingSha = existData.sha;
        }
      } catch { /* new file */ }

      try {
        const putResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            message: `${message} — ${file.path}`,
            content: contentB64,
            branch,
            ...(existingSha ? { sha: existingSha } : {}),
          }),
        });
        const putData = await putResp.json() as { content?: { sha?: string } };
        if (putResp.ok) {
          results.push({ path: file.path, success: true, sha: putData.content?.sha });
        } else {
          results.push({ path: file.path, success: false, error: JSON.stringify(putData) });
        }
      } catch (err) {
        results.push({ path: file.path, success: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    const successful = results.filter(r => r.success).length;
    res.json({
      success: successful > 0,
      message: `${successful}/${files.length} files pushed to ${owner}/${repo}@${branch}`,
      repoUrl: `https://github.com/${owner}/${repo}`,
      results,
    });
  } catch (err) {
    logger.error({ err }, "GitHub push failed");
    res.status(500).json({ error: "GitHub push failed. Check token permissions and repo URL." });
  }
});

// ──────────────── DOWNLOAD TOOL FILES ────────────────
router.get("/tools/download-file", (req: Request, res: Response) => {
  const file = req.query.file as string;
  const name = (req.query.name as string) || file;
  if (!file || file.includes("..") || file.includes("/")) { res.status(400).json({ error: "Invalid file name" }); return; }
  const filePath = path.join(UPLOAD_DIR, file);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "File not found or expired" }); return; }
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(name)}"`);
  res.setHeader("Cache-Control", "no-store");
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
  stream.on("error", () => { if (!res.headersSent) res.status(500).end(); });
});

export { router as toolsRouter };
