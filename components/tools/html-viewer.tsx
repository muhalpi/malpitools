"use client";

import { useMemo, useState, type UIEvent } from "react";
import { Check, Code2, Copy, Download, Eye, Play, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadText } from "@/lib/download";
import { cn } from "@/lib/utils";

type HtmlStats = {
  elements: number;
  links: number;
  images: number;
  scripts: number;
  stylesheets: number;
  headings: { level: string; text: string }[];
  title: string;
};

type HighlightPart = {
  className?: string;
  text: string;
};

type HighlightLine = {
  depth: number;
  parts: HighlightPart[];
};

const SAMPLE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Preview Document</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.5; }
    main { max-width: 680px; margin: auto; }
    code { background: #f2f2f2; padding: 0.1rem 0.3rem; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>Hello HTML</h1>
    <p>Edit the source and preview the result in a sandboxed iframe.</p>
    <p><a href="https://example.com">Example link</a></p>
  </main>
</body>
</html>`;

function stripTags(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function countMatches(source: string, pattern: RegExp): number {
  return Array.from(source.matchAll(pattern)).length;
}

function indentDepth(line: string): number {
  const indentation = line.match(/^\s*/)?.[0] ?? "";
  const spaces = indentation.replace(/\t/g, "  ").length;
  return Math.floor(spaces / 2);
}

function ensureHighlightParts(parts: HighlightPart[]): HighlightPart[] {
  return parts.length > 0 ? parts : [{ className: "text-slate-50", text: "\u00a0" }];
}

function highlightTagToken(token: string): HighlightPart[] {
  const parts: HighlightPart[] = [];
  const matcher =
    /(<!--[\s\S]*?-->|<!doctype\b|<\/?|\/?>|[a-z][\w:-]*(?=[\s>/])|[a-z_:][\w:.-]*(?=\=)|"[^"]*"|'[^']*'|=)/gi;
  let cursor = 0;

  for (const match of token.matchAll(matcher)) {
    const index = match.index ?? 0;
    const text = match[0];

    if (index > cursor) parts.push({ text: token.slice(cursor, index) });

    if (text.startsWith("<!--")) {
      parts.push({ className: "text-slate-500", text });
    } else if (text === "<" || text === "</" || text === ">" || text === "/>") {
      parts.push({ className: "text-sky-400", text });
    } else if (text === "=") {
      parts.push({ className: "text-slate-300", text });
    } else if (text.startsWith("\"") || text.startsWith("'")) {
      parts.push({ className: "text-orange-300", text });
    } else if (text.toLowerCase().startsWith("<!doctype")) {
      parts.push({ className: "text-sky-400", text });
    } else if (/^[a-z][\w:-]*$/i.test(text)) {
      parts.push({ className: "text-cyan-300", text });
    } else {
      parts.push({ text });
    }

    cursor = index + text.length;
  }

  if (cursor < token.length) {
    parts.push({ className: "text-slate-50", text: token.slice(cursor) });
  }
  return parts;
}

function highlightHtmlLine(line: string): HighlightPart[] {
  const parts: HighlightPart[] = [];
  const tagMatcher = /(<!--[\s\S]*?-->|<!doctype[^>]*>|<\/?[a-z][^>]*>)/gi;
  let cursor = 0;

  for (const match of line.matchAll(tagMatcher)) {
    const index = match.index ?? 0;
    const token = match[0];

    if (index > cursor) parts.push({ className: "text-slate-50", text: line.slice(cursor, index) });
    parts.push(...highlightTagToken(token));
    cursor = index + token.length;
  }

  if (cursor < line.length) parts.push({ className: "text-slate-50", text: line.slice(cursor) });
  return ensureHighlightParts(parts);
}

function isCssProperty(line: string, tokenEnd: number): boolean {
  const next = line.slice(tokenEnd).match(/^\s*:/);
  if (!next) return false;

  const before = line.slice(0, tokenEnd);
  const lastBoundary = Math.max(
    before.lastIndexOf("{"),
    before.lastIndexOf(";"),
    before.lastIndexOf("}")
  );
  const currentSegment = before.slice(lastBoundary + 1);

  return !/[.#][\w-]+/.test(currentSegment);
}

function isCssValue(line: string, tokenStart: number): boolean {
  const before = line.slice(0, tokenStart);
  return before.lastIndexOf(":") > Math.max(before.lastIndexOf(";"), before.lastIndexOf("{"));
}

function highlightCssLine(line: string): HighlightPart[] {
  const parts: HighlightPart[] = [];
  const matcher =
    /(\/\*[\s\S]*?\*\/|#[0-9a-f]{3,8}\b|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|@[a-z-]+|[{}:;,()]|-?\d*\.?\d+(?:px|rem|em|vh|vw|vmin|vmax|%|s|ms|deg)?\b|(?:[.#])?(?:--)?[_a-z][\w-]*(?:\([^)]*\))?)/gi;
  let cursor = 0;

  for (const match of line.matchAll(matcher)) {
    const index = match.index ?? 0;
    const text = match[0];

    if (index > cursor) {
      parts.push({ className: "text-slate-50", text: line.slice(cursor, index) });
    }

    if (text.startsWith("/*")) {
      parts.push({ className: "text-slate-500", text });
    } else if (text.startsWith("\"") || text.startsWith("'")) {
      parts.push({ className: "text-yellow-300", text });
    } else if (text.startsWith("#")) {
      parts.push({ className: "text-orange-300", text });
    } else if (/^@[a-z-]+$/i.test(text)) {
      parts.push({ className: "text-yellow-300", text });
    } else if (/^[{}:;,()]$/.test(text)) {
      parts.push({ className: "text-slate-200", text });
    } else if (/^-?\d/.test(text)) {
      parts.push({ className: "text-lime-300", text });
    } else if (isCssProperty(line, index + text.length)) {
      parts.push({ className: "text-cyan-300", text });
    } else if (text.startsWith(".") || text.startsWith("#")) {
      parts.push({ className: "text-yellow-300", text });
    } else if (text.startsWith("--")) {
      parts.push({ className: "text-violet-300", text });
    } else if (text.includes("(")) {
      parts.push({ className: "text-cyan-300", text });
    } else if (isCssValue(line, index)) {
      parts.push({ className: "text-orange-300", text });
    } else {
      parts.push({ className: "text-yellow-300", text });
    }

    cursor = index + text.length;
  }

  if (cursor < line.length) {
    parts.push({ className: "text-slate-50", text: line.slice(cursor) });
  }

  return ensureHighlightParts(parts);
}

function highlightCode(source: string): HighlightLine[] {
  let inStyle = false;

  return source.split("\n").map((line) => {
    const lowerLine = line.toLowerCase();
    const depth = indentDepth(line);
    let parts: HighlightPart[] = [];

    if (inStyle) {
      const closeIndex = lowerLine.indexOf("</style");

      if (closeIndex === -1) {
        return { depth, parts: highlightCssLine(line) };
      }

      parts = [
        ...highlightCssLine(line.slice(0, closeIndex)),
        ...highlightHtmlLine(line.slice(closeIndex)),
      ];
      inStyle = false;
      return { depth, parts: ensureHighlightParts(parts) };
    }

    const openIndex = lowerLine.indexOf("<style");
    if (openIndex === -1) {
      return { depth, parts: highlightHtmlLine(line) };
    }

    const openEnd = line.indexOf(">", openIndex);
    if (openEnd === -1) {
      return { depth, parts: highlightHtmlLine(line) };
    }

    const beforeAndOpen = line.slice(0, openEnd + 1);
    const afterOpen = line.slice(openEnd + 1);
    const closeIndex = afterOpen.toLowerCase().indexOf("</style");

    parts.push(...highlightHtmlLine(beforeAndOpen));

    if (closeIndex === -1) {
      parts.push(...highlightCssLine(afterOpen));
      inStyle = true;
    } else {
      parts.push(...highlightCssLine(afterOpen.slice(0, closeIndex)));
      parts.push(...highlightHtmlLine(afterOpen.slice(closeIndex)));
    }

    return { depth, parts: ensureHighlightParts(parts) };
  });
}

function analyzeHtml(source: string): HtmlStats {
  const headings = Array.from(source.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)).map(
    (match) => ({
      level: `h${match[1]}`,
      text: stripTags(match[2] ?? "") || "(empty heading)",
    })
  );
  const titleMatch = source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);

  return {
    elements: countMatches(source, /<\s*[a-z][\w:-]*(?:\s|>|\/)/gi),
    links: countMatches(source, /<a\b[^>]*\bhref\s*=/gi),
    images: countMatches(source, /<img\b/gi),
    scripts: countMatches(source, /<script\b/gi),
    stylesheets: countMatches(source, /<link\b(?=[^>]*\brel\s*=\s*["'][^"']*\bstylesheet\b)/gi),
    headings,
    title: titleMatch ? stripTags(titleMatch[1] ?? "") || "Untitled" : "Untitled",
  };
}

export function HtmlViewerTool() {
  const [draftHtml, setDraftHtml] = useState(SAMPLE_HTML);
  const [previewHtml, setPreviewHtml] = useState(SAMPLE_HTML);
  const [copied, setCopied] = useState(false);
  const stats = useMemo(() => analyzeHtml(draftHtml), [draftHtml]);
  const previewStats = useMemo(() => analyzeHtml(previewHtml), [previewHtml]);
  const isStale = draftHtml !== previewHtml;

  const copyHtml = async () => {
    await navigator.clipboard.writeText(draftHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadHtml = () => {
    downloadText(draftHtml, "preview.html", "text/html;charset=utf-8");
  };

  const runPreview = () => {
    setPreviewHtml(draftHtml);
  };

  const resetSample = () => {
    setDraftHtml(SAMPLE_HTML);
    setPreviewHtml(SAMPLE_HTML);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{stats.elements} elements</Badge>
          <Badge variant="outline">{stats.links} links</Badge>
          <Badge variant="outline">{stats.images} images</Badge>
          {stats.scripts > 0 && <Badge variant="outline">{stats.scripts} scripts blocked</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copyHtml}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="outline" size="sm" onClick={downloadHtml}>
            <Download className="size-4" />
            Download
          </Button>
          <Button variant="ghost" size="sm" onClick={resetSample}>
            <RotateCcw className="size-4" />
            Sample
          </Button>
        </div>
      </div>

      <Tabs defaultValue="split" className="space-y-4">
        <TabsList>
          <TabsTrigger value="split">
            <Eye className="size-4" />
            Split
          </TabsTrigger>
          <TabsTrigger value="source">
            <Code2 className="size-4" />
            Source
          </TabsTrigger>
          <TabsTrigger value="outline">Outline</TabsTrigger>
        </TabsList>

        <TabsContent value="split">
          <div className="grid gap-4 lg:grid-cols-2">
            <EditorPanel
              html={draftHtml}
              isStale={isStale}
              onChange={setDraftHtml}
              onRun={runPreview}
            />
            <PreviewPanel html={previewHtml} isStale={isStale} title={previewStats.title} />
          </div>
        </TabsContent>

        <TabsContent value="source">
          <EditorPanel
            html={draftHtml}
            isStale={isStale}
            onChange={setDraftHtml}
            onRun={runPreview}
            tall
          />
        </TabsContent>

        <TabsContent value="outline">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Document outline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Stat label="Title" value={stats.title} />
                <Stat label="Elements" value={`${stats.elements}`} />
                <Stat label="Links" value={`${stats.links}`} />
                <Stat label="Images" value={`${stats.images}`} />
                <Stat label="Stylesheets" value={`${stats.stylesheets}`} />
              </div>

              <div className="rounded-lg border bg-background">
                {stats.headings.length > 0 ? (
                  <div className="divide-y">
                    {stats.headings.map((heading, index) => (
                      <div key={`${heading.level}-${index}`} className="flex items-center gap-3 p-3 text-sm">
                        <span className="w-9 rounded bg-muted px-2 py-1 text-center font-mono text-xs text-muted-foreground">
                          {heading.level}
                        </span>
                        <span className="min-w-0 break-words">{heading.text}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="p-6 text-sm text-muted-foreground">No headings found.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EditorPanel({
  html,
  isStale,
  onChange,
  onRun,
  tall = false,
}: {
  html: string;
  isStale: boolean;
  onChange: (value: string) => void;
  onRun: () => void;
  tall?: boolean;
}) {
  const characterCount = html.length.toLocaleString();
  const [editorScrollTop, setEditorScrollTop] = useState(0);
  const highlightedLines = useMemo(() => highlightCode(html), [html]);
  const handleEditorScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    event.currentTarget.scrollLeft = 0;
    setEditorScrollTop(event.currentTarget.scrollTop);
  };

  return (
    <Card className="overflow-hidden rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b py-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Code2 className="size-4 text-primary" />
          HTML Code
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{characterCount} chars</span>
          {isStale && (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              Stale
            </Badge>
          )}
          <Button size="sm" onClick={onRun}>
            <Play className="size-4 fill-current" />
            Run
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Label htmlFor="html-source" className="sr-only">
          HTML source
        </Label>
        <div className={cn("relative overflow-hidden bg-[#1f1f1f]", tall ? "h-[680px]" : "h-[560px]")}>
          <pre
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 overflow-hidden px-7 py-7 font-mono text-[13px] leading-6"
          >
            <code
              className="block whitespace-pre-wrap text-slate-50 [overflow-wrap:anywhere]"
              style={{
                transform: `translateY(${-editorScrollTop}px)`,
              }}
            >
              {highlightedLines.map((line, lineIndex) => {
                return (
                  <span key={lineIndex} className="relative block min-h-6 whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {Array.from({ length: line.depth }, (_, depthIndex) => (
                      <span
                        key={depthIndex}
                        className="absolute inset-y-0 border-l border-slate-600/45"
                        style={{ left: `${depthIndex * 2 + 0.85}ch` }}
                      />
                    ))}
                    {line.parts.map((part, partIndex) => (
                      <span key={`${partIndex}-${part.text}`} className={part.className ?? "text-slate-50"}>
                        {part.text}
                      </span>
                    ))}
                  </span>
                );
              })}
            </code>
          </pre>
          <textarea
            id="html-source"
            value={html}
            onChange={(event) => onChange(event.target.value)}
            onScroll={handleEditorScroll}
            spellCheck={false}
            className="relative z-10 h-full w-full resize-none overflow-y-auto overflow-x-hidden whitespace-pre-wrap border-0 bg-transparent px-7 py-7 font-mono text-[13px] leading-6 text-transparent caret-orange-400 outline-none selection:bg-orange-500/30 [overflow-wrap:anywhere] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ tabSize: 2 }}
            wrap="soft"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function PreviewPanel({ html, isStale, title }: { html: string; isStale: boolean; title: string }) {
  return (
    <Card className="overflow-hidden rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b py-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Play className="size-4 text-primary" />
          Output
        </CardTitle>
        <div className="flex items-center gap-2">
          {isStale && (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              Stale
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <iframe
          title={`HTML preview: ${title}`}
          srcDoc={html}
          sandbox=""
          referrerPolicy="no-referrer"
          className="h-[560px] w-full border-0 bg-white"
        />
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-medium" title={value}>
        {value}
      </p>
    </div>
  );
}
