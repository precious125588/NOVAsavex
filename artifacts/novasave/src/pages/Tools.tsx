import { useState, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Wrench, Lock, Unlock, FileArchive, FileText, Github, Globe,
  Upload, Download, Loader2, Copy, Check, Eye, EyeOff, KeyRound, Code2,
  ChevronRight, ArrowRight,
} from "lucide-react";

type ToolSection = "encrypt" | "zip" | "pdf" | "github" | "scrape";

function Section({ title, icon: Icon, color, children, id, active, onClick }: {
  title: string; icon: React.ElementType; color: string; children: React.ReactNode;
  id: ToolSection; active: ToolSection; onClick: (id: ToolSection) => void;
}) {
  const isActive = active === id;
  return (
    <div className={`glass-card rounded-2xl overflow-hidden border transition-all ${isActive ? "border-primary/30" : "border-white/8"}`}>
      <button
        onClick={() => onClick(isActive ? ("" as ToolSection) : id)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-all"
      >
        <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">{title}</p>
        </div>
        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isActive ? "rotate-90" : ""}`} />
      </button>
      {isActive && <div className="px-4 pb-4 pt-1 border-t border-white/8 space-y-3">{children}</div>}
    </div>
  );
}

function EncryptSection() {
  const { toast } = useToast();
  const [mode, setMode] = useState<"encrypt" | "decrypt">("encrypt");
  const [text, setText] = useState("");
  const [key, setKey] = useState("");
  const [result, setResult] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGithub, setShowGithub] = useState(false);
  const [ghRepo, setGhRepo] = useState("");
  const [ghToken, setGhToken] = useState("");
  const [ghPath, setGhPath] = useState("encrypted/output.txt");
  const [ghPushing, setGhPushing] = useState(false);

  const handle = async () => {
    if (!text) { toast({ title: "Text required", variant: "destructive" }); return; }
    if (key.length < 8) { toast({ title: "Key must be 8+ characters", variant: "destructive" }); return; }
    setLoading(true);
    setShowGithub(false);
    try {
      const resp = await fetch(`/api/tools/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "encrypt" ? { text, key } : { encrypted: text, key }),
      });
      const data = await resp.json() as { encrypted?: string; decrypted?: string; error?: string };
      if (data.encrypted) { setResult(data.encrypted); }
      else if (data.decrypted) { setResult(data.decrypted); }
      else toast({ title: "Failed", description: data.error, variant: "destructive" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copy = () => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const pushToGithub = async () => {
    if (!ghRepo || !ghToken || !ghPath || !result) {
      toast({ title: "Repo URL, token, file path and encrypted result are required", variant: "destructive" });
      return;
    }
    setGhPushing(true);
    try {
      const resp = await fetch("/api/tools/github-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl: ghRepo,
          token: ghToken,
          branch: "main",
          message: "Add encrypted file via NOVAsavex",
          files: [{ path: ghPath, content: result }],
        }),
      });
      const data = await resp.json() as { success?: boolean; message?: string; repoUrl?: string; error?: string };
      if (data.success) {
        toast({ title: "Pushed to GitHub!", description: data.message });
      } else {
        toast({ title: "Push failed", description: data.error || data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "GitHub push failed", variant: "destructive" });
    } finally {
      setGhPushing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1 bg-black/20 rounded-lg p-1 w-fit">
        <button onClick={() => { setMode("encrypt"); setResult(""); setShowGithub(false); }} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${mode === "encrypt" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>
          <Lock className="w-3.5 h-3.5 inline mr-1" />Encrypt
        </button>
        <button onClick={() => { setMode("decrypt"); setResult(""); setShowGithub(false); }} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${mode === "decrypt" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>
          <Unlock className="w-3.5 h-3.5 inline mr-1" />Decrypt
        </button>
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder={mode === "encrypt" ? "Text to encrypt..." : "Paste encrypted text..."} className="w-full h-24 bg-black/30 border border-white/10 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-primary/50 font-mono" />
      <div className="relative">
        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input type={showKey ? "text" : "password"} value={key} onChange={e => setKey(e.target.value)} placeholder="Secret key (min 8 chars)" className="pl-10 pr-10 h-10 font-mono" />
        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowKey(!showKey)}>
          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      <Button onClick={handle} className="w-full h-10 gap-2" disabled={loading || !text || key.length < 8}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === "encrypt" ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        {mode === "encrypt" ? "Encrypt" : "Decrypt"}
      </Button>
      {result && (
        <>
          <div className="relative">
            <div className="bg-black/40 rounded-xl p-3 pr-10 font-mono text-xs break-all max-h-28 overflow-y-auto text-green-300/90">{result}</div>
            <button onClick={copy} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          {mode === "encrypt" && (
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 gap-2 border-gray-600/40 text-gray-300 hover:bg-gray-700/20"
                onClick={() => setShowGithub(v => !v)}
              >
                <Github className="w-3.5 h-3.5" />
                {showGithub ? "Hide GitHub Push" : "Push Encrypted File to GitHub"}
                <ArrowRight className={`w-3 h-3 ml-auto transition-transform ${showGithub ? "rotate-90" : ""}`} />
              </Button>
              {showGithub && (
                <div className="bg-black/30 rounded-xl p-3 space-y-2 border border-gray-600/20">
                  <Input value={ghRepo} onChange={e => setGhRepo(e.target.value)} placeholder="https://github.com/user/repo" className="h-9 text-xs" />
                  <Input type="password" value={ghToken} onChange={e => setGhToken(e.target.value)} placeholder="GitHub Token (ghp_...)" className="h-9 text-xs font-mono" />
                  <Input value={ghPath} onChange={e => setGhPath(e.target.value)} placeholder="File path in repo (e.g. secrets/data.txt)" className="h-9 text-xs font-mono" />
                  <Button onClick={pushToGithub} size="sm" className="w-full h-8 gap-2 bg-gray-800 hover:bg-gray-700" disabled={ghPushing}>
                    {ghPushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Github className="w-3.5 h-3.5" />}
                    {ghPushing ? "Pushing..." : "Push to GitHub"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ZipSection() {
  const { toast } = useToast();
  const compressRef = useRef<HTMLInputElement>(null);
  const decompressRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState<"compress" | "decompress" | null>(null);
  const [compressResult, setCompressResult] = useState<{ ratio: number; compressedSize: number; downloadPath: string; compressedName: string } | null>(null);
  const [decompressResult, setDecompressResult] = useState<{ decompressedSize: number; downloadPath: string; decompressedName: string } | null>(null);

  const handleCompress = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setLoading("compress"); setCompressResult(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const resp = await fetch("/api/tools/compress", { method: "POST", body: formData });
      const data = await resp.json() as typeof compressResult & { error?: string };
      if (!resp.ok) throw new Error(data.error || "Failed");
      setCompressResult(data);
      toast({ title: `Compressed! ${data.ratio}% smaller` });
    } catch (err) {
      toast({ title: "Compression failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally { setLoading(null); if (compressRef.current) compressRef.current.value = ""; }
  };

  const handleDecompress = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setLoading("decompress"); setDecompressResult(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const resp = await fetch("/api/tools/decompress", { method: "POST", body: formData });
      const data = await resp.json() as typeof decompressResult & { error?: string };
      if (!resp.ok) throw new Error(data.error || "Failed");
      setDecompressResult(data);
      toast({ title: "Decompressed!" });
    } catch (err) {
      toast({ title: "Decompression failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally { setLoading(null); if (decompressRef.current) decompressRef.current.value = ""; }
  };

  const formatBytes = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-3">
        <p className="text-sm font-medium flex items-center gap-2"><FileArchive className="w-4 h-4 text-blue-400" />Compress (GZip)</p>
        <div onClick={() => compressRef.current?.click()} className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors">
          {loading === "compress" ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /> : <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />}
          <p className="text-sm text-muted-foreground">{loading === "compress" ? "Compressing..." : "Click to compress any file"}</p>
        </div>
        <input ref={compressRef} type="file" className="hidden" onChange={handleCompress} />
        {compressResult && (
          <div className="bg-black/30 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-400">{compressResult.ratio}% smaller</span>
              <span className="text-muted-foreground">{formatBytes(compressResult.compressedSize)}</span>
            </div>
            <a href={compressResult.downloadPath}>
              <Button size="sm" className="w-full h-8 gap-1"><Download className="w-3 h-3" />Download .gz</Button>
            </a>
          </div>
        )}
      </div>
      <div className="space-y-3">
        <p className="text-sm font-medium flex items-center gap-2"><FileArchive className="w-4 h-4 text-amber-400" />Decompress (.gz)</p>
        <div onClick={() => decompressRef.current?.click()} className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center cursor-pointer hover:border-amber-500/50 transition-colors">
          {loading === "decompress" ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-400" /> : <FileArchive className="w-6 h-6 mx-auto text-muted-foreground mb-2" />}
          <p className="text-sm text-muted-foreground">{loading === "decompress" ? "Decompressing..." : "Upload .gz file"}</p>
        </div>
        <input ref={decompressRef} type="file" accept=".gz" className="hidden" onChange={handleDecompress} />
        {decompressResult && (
          <div className="bg-black/30 rounded-lg p-3 space-y-2">
            <p className="text-sm text-green-400">{formatBytes(decompressResult.decompressedSize)} decompressed</p>
            <a href={decompressResult.downloadPath}>
              <Button size="sm" className="w-full h-8 gap-1"><Download className="w-3 h-3" />Download file</Button>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function PdfSection() {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [title, setTitle] = useState("My Document");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ htmlUrl?: string; htmlContent?: string; message?: string } | null>(null);

  const handleGenerate = async () => {
    if (!text.trim()) { toast({ title: "Text required", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const resp = await fetch("/api/tools/text-to-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, title }),
      });
      const data = await resp.json() as typeof result & { error?: string };
      if (!resp.ok) throw new Error(data?.error || "Failed");
      setResult(data);
      toast({ title: "Document generated!" });
    } catch (err) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openAndPrint = () => {
    if (!result?.htmlContent) return;
    const win = window.open("", "_blank");
    if (win) { win.document.write(result.htmlContent); win.document.close(); win.print(); }
  };

  return (
    <div className="space-y-3">
      <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Document title" className="h-10" />
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Paste your text content here..." className="w-full h-40 bg-black/30 border border-white/10 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-primary/50" />
      <div className="flex gap-2">
        <Button onClick={handleGenerate} className="flex-1 h-10 gap-2" disabled={loading || !text.trim()}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Generate Document
        </Button>
        {result?.htmlContent && (
          <Button variant="outline" className="h-10 gap-1" onClick={openAndPrint}>
            <Download className="w-4 h-4" />Print/Save PDF
          </Button>
        )}
      </div>
      {result?.message && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
          <p className="text-sm text-blue-300">{result.message}</p>
          {result.htmlUrl && <a href={result.htmlUrl} className="text-xs text-blue-400 underline mt-1 block">Download HTML file</a>}
        </div>
      )}
    </div>
  );
}

function GithubSection() {
  const { toast } = useToast();
  const [repoUrl, setRepoUrl] = useState("");
  const [token, setToken] = useState("");
  const [branch, setBranch] = useState("main");
  const [message, setMessage] = useState("Update via NOVAsavex");
  const [filePath, setFilePath] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; message?: string; repoUrl?: string; results?: Array<{ path: string; success: boolean }> } | null>(null);

  const handlePush = async () => {
    if (!repoUrl || !token || !filePath || !fileContent) {
      toast({ title: "All fields required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch("/api/tools/github-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl, token, branch, message, files: [{ path: filePath, content: fileContent }] }),
      });
      const data = await resp.json() as typeof result & { error?: string };
      if (!resp.ok) throw new Error(data?.error || "Failed");
      setResult(data);
      if (data?.success) toast({ title: "Pushed successfully!", description: data.message || "" });
      else toast({ title: "Push failed", description: data.message || "", variant: "destructive" });
    } catch (err) {
      toast({ title: "GitHub push failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Input value={repoUrl} onChange={e => setRepoUrl(e.target.value)} placeholder="https://github.com/username/repo" className="h-10" />
      <div className="relative">
        <Input type={showToken ? "text" : "password"} value={token} onChange={e => setToken(e.target.value)} placeholder="GitHub Personal Access Token (ghp_...)" className="h-10 pr-10 font-mono text-xs" />
        <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input value={branch} onChange={e => setBranch(e.target.value)} placeholder="Branch (main)" className="h-10" />
        <Input value={message} onChange={e => setMessage(e.target.value)} placeholder="Commit message" className="h-10" />
      </div>
      <Input value={filePath} onChange={e => setFilePath(e.target.value)} placeholder="File path (e.g. src/index.js)" className="h-10 font-mono text-xs" />
      <textarea value={fileContent} onChange={e => setFileContent(e.target.value)} placeholder="File content..." className="w-full h-28 bg-black/30 border border-white/10 rounded-xl p-3 text-sm font-mono resize-none focus:outline-none focus:border-primary/50" />
      <Button onClick={handlePush} className="w-full h-10 gap-2" disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
        Push to GitHub
      </Button>
      {result && (
        <div className={`rounded-lg p-3 text-sm ${result.success ? "bg-green-900/20 border border-green-500/30" : "bg-red-900/20 border border-red-500/30"}`}>
          <p className={result.success ? "text-green-300" : "text-red-300"}>{result.message}</p>
          {result.repoUrl && <a href={result.repoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 underline mt-1 block">{result.repoUrl}</a>}
        </div>
      )}
    </div>
  );
}

function ScrapeSection() {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const handleScrape = async () => {
    if (!url.trim()) { toast({ title: "URL required", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const resp = await fetch("/api/tools/scrape-structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await resp.json() as Record<string, unknown> & { error?: string };
      if (!resp.ok) throw new Error(data.error || "Failed");
      setResult(data);
    } catch (err) {
      toast({ title: "Scrape failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" className="flex-1 h-10" />
        <Button onClick={handleScrape} className="h-10 gap-1" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
          Scrape
        </Button>
      </div>
      {result && (
        <div className="space-y-3">
          <div className="bg-black/30 rounded-xl p-3 space-y-2">
            <p className="font-medium text-sm">{String(result.title || "")}</p>
            <p className="text-xs text-muted-foreground">{String(result.description || "")}</p>
            {Array.isArray(result.technologies) && result.technologies.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {result.technologies.map((t: unknown, i: number) => <Badge key={i} variant="outline" className="text-[10px]">{String(t)}</Badge>)}
              </div>
            )}
          </div>
          {result.structure && typeof result.structure === "object" && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(result.structure as Record<string, unknown[]>).map(([k, v]) => (
                <div key={k} className="bg-black/20 rounded-lg p-2">
                  <p className="font-medium capitalize mb-1">{k}</p>
                  <p className="text-muted-foreground">{Array.isArray(v) ? (v as unknown[]).length : String(v)} found</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Tools() {
  const [active, setActive] = useState<ToolSection>("" as ToolSection);

  const toggleSection = (id: ToolSection) => setActive(prev => prev === id ? "" as ToolSection : id);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-gray-700 flex items-center justify-center neon-glow">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Tools</h1>
          </div>
          <p className="text-muted-foreground">Encrypt data, compress files, generate PDFs, push to GitHub and more</p>
        </div>

        <div className="space-y-3">
          <Section title="Encrypt & Decrypt" icon={Lock} color="bg-gradient-to-br from-purple-600 to-violet-700" id="encrypt" active={active} onClick={toggleSection}>
            <EncryptSection />
          </Section>

          <Section title="Compress & Decompress Files" icon={FileArchive} color="bg-gradient-to-br from-blue-600 to-cyan-700" id="zip" active={active} onClick={toggleSection}>
            <ZipSection />
          </Section>

          <Section title="Text to PDF Document" icon={FileText} color="bg-gradient-to-br from-rose-600 to-pink-700" id="pdf" active={active} onClick={toggleSection}>
            <PdfSection />
          </Section>

          <Section title="GitHub Push (SSH/Token)" icon={Github} color="bg-gradient-to-br from-gray-600 to-slate-700" id="github" active={active} onClick={toggleSection}>
            <GithubSection />
          </Section>

          <Section title="Scrape Code Structure" icon={Globe} color="bg-gradient-to-br from-emerald-600 to-green-700" id="scrape" active={active} onClick={toggleSection}>
            <ScrapeSection />
          </Section>
        </div>
      </div>
    </Layout>
  );
}
