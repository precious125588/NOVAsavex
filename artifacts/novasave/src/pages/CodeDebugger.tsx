import { useState, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Code2, Loader2, Upload, Copy, Check, Sparkles, ChevronDown, FileCode, Trash2, Zap } from "lucide-react";

const LANGUAGES = [
  "javascript", "typescript", "python", "java", "c", "cpp", "csharp", "go",
  "rust", "php", "ruby", "swift", "kotlin", "sql", "html", "css", "bash",
  "react", "vue", "nodejs", "dart", "r", "matlab",
];

const TASK_PRESETS = [
  { label: "Debug & Fix", prompt: "Find all bugs, errors, and issues in this code. Provide fixes with explanations." },
  { label: "Explain Code", prompt: "Explain what this code does in simple terms, step by step." },
  { label: "Optimize", prompt: "Suggest performance improvements and best practices for this code." },
  { label: "Add Comments", prompt: "Add detailed comments and documentation to this code." },
  { label: "Convert Language", prompt: "Convert this code to a more modern or efficient approach." },
  { label: "Find Vulnerabilities", prompt: "Find security vulnerabilities and suggest fixes." },
];

function CodeBlock({ code, language = "" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const lines = code.split("\n");
  return (
    <div className="relative rounded-xl overflow-hidden bg-[#0d1117] border border-white/10">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
        <span className="text-xs text-muted-foreground font-mono">{language || "output"}</span>
        <button onClick={copy} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div className="overflow-auto max-h-80">
        <pre className="p-4 text-sm font-mono text-green-300/90 leading-relaxed">
          {lines.map((line, i) => (
            <div key={i} className="flex">
              <span className="text-white/20 w-8 flex-shrink-0 text-right mr-4 select-none">{i + 1}</span>
              <span>{line}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

function ResultBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const parts = text.split(/(```[\s\S]*?```)/g);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={copy} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy result"}
        </button>
      </div>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const lines = part.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
          return <CodeBlock key={i} code={lines} />;
        }
        return (
          <div key={i} className="prose prose-invert max-w-none">
            {part.split("\n").map((line, li) => {
              if (line.startsWith("## ")) return <h2 key={li} className="text-base font-bold mt-4 mb-2 text-primary">{line.slice(3)}</h2>;
              if (line.startsWith("# ")) return <h1 key={li} className="text-lg font-bold mt-4 mb-2">{line.slice(2)}</h1>;
              if (line.startsWith("**") && line.endsWith("**")) return <p key={li} className="font-semibold text-sm mt-3 mb-1">{line.slice(2, -2)}</p>;
              if (line.startsWith("• ") || line.startsWith("- ")) return <p key={li} className="text-sm pl-3 text-muted-foreground">• {line.slice(2)}</p>;
              if (!line.trim()) return <div key={li} className="h-2" />;
              return <p key={li} className="text-sm leading-relaxed">{line}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

export default function CodeDebugger() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [task, setTask] = useState(TASK_PRESETS[0].prompt);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [filename, setFilename] = useState("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const langMap: Record<string, string> = {
      js: "javascript", ts: "typescript", py: "python", java: "java",
      c: "c", cpp: "cpp", cs: "csharp", go: "go", rs: "rust",
      php: "php", rb: "ruby", swift: "swift", kt: "kotlin",
      sql: "sql", html: "html", css: "css", sh: "bash", bash: "bash",
      jsx: "react", tsx: "react", vue: "vue",
    };
    if (langMap[ext]) setLanguage(langMap[ext]);
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = ev => setCode(ev.target?.result as string || "");
    reader.readAsText(file);
  };

  const handleDebug = async () => {
    if (!code.trim()) { toast({ title: "Please paste or upload code first", variant: "destructive" }); return; }
    setLoading(true);
    setResult("");
    try {
      const resp = await fetch("/api/tools/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, question: task }),
      });
      const data = await resp.json() as { result?: string; error?: string };
      if (data.result) {
        setResult(data.result);
      } else {
        toast({ title: "Debug failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Debug failed", description: "Network error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const clear = () => { setCode(""); setResult(""); setFilename(""); if (fileRef.current) fileRef.current.value = ""; };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center neon-glow">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold">AI Code Debugger</h1>
          </div>
          <p className="text-muted-foreground">Paste or upload code — AI will debug, explain, and improve it</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 items-start">
          {/* Input section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Your Code</span>
                {filename && <Badge variant="outline" className="text-xs">{filename}</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  className="text-xs bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-foreground"
                >
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={clear} title="Clear">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="relative">
              <textarea
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder={`Paste your ${language} code here...\n\nExample:\nfunction greet(name) {\n  console.log("Hello" + name)\n  return name\n}`}
                className="w-full h-80 bg-[#0d1117] border border-white/10 rounded-xl p-4 text-sm font-mono text-green-300/90 focus:outline-none focus:border-primary/50 resize-none leading-relaxed"
                spellCheck={false}
              />
              <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                {code.length} chars · {code.split("\n").length} lines
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
                <Upload className="w-3.5 h-3.5" />Upload File
              </Button>
              <input ref={fileRef} type="file" accept=".js,.ts,.py,.java,.c,.cpp,.cs,.go,.rs,.php,.rb,.swift,.kt,.sql,.html,.css,.sh,.bash,.jsx,.tsx,.vue,.txt" className="hidden" onChange={handleFile} />
            </div>
          </div>

          {/* Config & result section */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400" />What to do?</p>
              <div className="grid grid-cols-2 gap-1.5">
                {TASK_PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => setTask(preset.prompt)}
                    className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                      task === preset.prompt
                        ? "bg-primary/20 border-primary/50 text-primary"
                        : "border-white/10 text-muted-foreground hover:border-white/30 hover:text-foreground"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <textarea
                value={task}
                onChange={e => setTask(e.target.value)}
                className="mt-2 w-full h-16 bg-black/30 border border-white/10 rounded-lg p-2 text-xs resize-none focus:outline-none focus:border-primary/50"
                placeholder="Or write a custom task..."
              />
            </div>

            <Button onClick={handleDebug} className="w-full h-11 gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700" disabled={loading || !code.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? "Analyzing..." : "Debug with AI"}
            </Button>
          </div>
        </div>

        {loading && (
          <div className="glass-card rounded-2xl p-8 flex items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <div>
              <p className="font-medium">Analyzing your code...</p>
              <p className="text-sm text-muted-foreground">AI is reviewing your code for bugs and improvements</p>
            </div>
          </div>
        )}

        {result && !loading && (
          <div className="glass-card rounded-2xl p-5 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="font-semibold">AI Analysis Result</span>
              <Badge variant="outline" className="text-xs ml-auto">{language}</Badge>
            </div>
            <ResultBlock text={result} />
          </div>
        )}
      </div>
    </Layout>
  );
}
