import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Star, ExternalLink } from "lucide-react";
import { toolCategories, featuredTools } from "@/lib/tools";
import {
  APP_MADE_BY_NAME,
  APP_NAME,
  APP_SOURCE_LABEL,
  APP_SOURCE_URL,
  FORK_MAINTAINER_NAME,
  ORIGINAL_AUTHOR_NAME,
  ORIGINAL_AUTHOR_URL,
  ORIGINAL_CONTRIBUTORS,
  ORIGINAL_PROJECT_NAME,
  ORIGINAL_SOURCE_LABEL,
  ORIGINAL_SOURCE_URL,
} from "@/lib/branding";
import { DownloadCard } from "@/components/download-card";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: `${APP_NAME} - privacy-first browser tools`,
  description:
    "A modified fork of delphitools with small, low stakes and low effort tools. No logins, no registration, no data collection.",
};

/** Letters of the TAXIWAY wordmark, pre-keyed so duplicate letters keep stable identities. */
const TAXIWAY_TILES = "TAXIWAY".split("").map((ch, i) => ({ ch, id: `tile-${i}` }));

export default function Home() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[var(--notion-night)] px-4 py-12 text-white md:px-8 lg:px-10">
        <div className="pointer-events-none absolute right-6 top-8 hidden grid-cols-3 gap-3 opacity-90 md:grid">
          <span className="size-12 rotate-6 rounded-xl bg-[var(--notion-purple)]" />
          <span className="mt-8 size-10 -rotate-6 rounded-lg bg-[var(--notion-sky)]" />
          <span className="size-14 rotate-3 rounded-xl bg-[var(--notion-pink)]" />
          <span className="ml-8 size-10 -rotate-3 rounded-lg bg-[var(--notion-orange)]" />
          <span className="size-12 rotate-6 rounded-xl bg-[var(--notion-teal)]" />
          <span className="mt-7 size-9 rounded-lg bg-[var(--notion-green)]" />
        </div>
        <div className="relative mx-auto max-w-7xl">
          <div className="mb-8 flex items-center gap-3">
            <img
              src="/malpitools-icon.svg"
              alt=""
              width={48}
              height={48}
              className="size-12 rounded-xl border border-white/20 bg-white"
            />
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
              No logins. No tracking.
            </span>
          </div>
          <h1 className="max-w-3xl text-5xl font-bold leading-none md:text-6xl">
            {APP_NAME}
          </h1>
          <div className="mt-6 max-w-2xl space-y-3 text-base leading-7 text-white/80">
            <p className="text-lg text-white">
              A collection of small, low stakes and low effort tools.
            </p>
            <p>
              No logins, no registration, no data collection. I can&apos;t believe
              I have to say that. Long live the handmade web.
            </p>
            <p>
              Made by {APP_MADE_BY_NAME}. Based on{" "}
              <a className="underline decoration-white/40 underline-offset-4 hover:decoration-white" href={ORIGINAL_SOURCE_URL} target="_blank" rel="noopener noreferrer">
                {ORIGINAL_PROJECT_NAME}<span className="sr-only"> (opens in new tab)</span>
              </a>{" "}
              by{" "}
              <a className="underline decoration-white/40 underline-offset-4 hover:decoration-white" href={ORIGINAL_AUTHOR_URL} target="_blank" rel="noopener noreferrer">
                {ORIGINAL_AUTHOR_NAME}<span className="sr-only"> (opens in new tab)</span>
              </a>
              .
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="#greatest-hits"
              className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[#005bab] dark:hover:bg-primary/90"
            >
              Browse tools
            </Link>
            <a
              href={APP_SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-medium text-black transition-colors hover:bg-white/90"
            >
              Fork source<span className="sr-only"> (opens in new tab)</span>
            </a>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 lg:px-10">

      {/* Greatest Hits */}
      <section id="greatest-hits" className="mb-12 scroll-mt-20">
        <div className="flex items-center gap-2 mb-4">
          <Star className="size-5 text-primary fill-primary" aria-hidden="true" />
          <h2 className="text-2xl font-bold text-foreground">
            Greatest Hits
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featuredTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link key={tool.id} href={tool.href} className="block h-full">
                <Card className="group h-full transition-all hover:border-primary/35 hover:shadow-[var(--notion-soft-shadow)]">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-primary/10">
                        <Icon className="size-5 text-primary" />
                      </div>
                      <ArrowRight className="size-4 text-primary opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-base mt-3 flex items-center gap-2">
                      {tool.name}
                      {tool.beta && (
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-muted-foreground">Beta</Badge>
                      )}
                      {tool.new && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/50 text-primary">New</Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {tool.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <DownloadCard />

      {/* Tool Categories */}
      <div className="space-y-10">
        {toolCategories.map((category) => (
          <section key={category.id}>
            <h2 className="mb-4 text-2xl font-bold text-foreground">
              {category.name}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {category.tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link key={tool.id} href={tool.href} className="block h-full">
                    <Card className="group h-full transition-all hover:border-primary/35 hover:shadow-[var(--notion-soft-shadow)]">
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                          <div className="flex size-10 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-primary/10">
                            <Icon className="size-5 text-muted-foreground transition-colors group-hover:text-primary" />
                          </div>
                          <ArrowRight className="size-4 text-primary opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                        </div>
                        <CardTitle className="text-base mt-3 flex items-center gap-2">
                          {tool.name}
                          {tool.beta && (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-muted-foreground">Beta</Badge>
                          )}
                          {tool.new && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/50 text-primary">New</Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {tool.description}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Original project links */}
      <section className="mt-16">
        <h2 className="mb-4 text-2xl font-bold text-foreground">
          Original project links
        </h2>
        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
          Preserved links from the original {ORIGINAL_PROJECT_NAME} project by {ORIGINAL_AUTHOR_NAME}.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <a
            href="https://rmv.fyi/projects/taxiway"
            target="_blank"
            rel="noopener noreferrer"
            className="group block"
          >
            <div
              className="relative h-full overflow-hidden rounded-xl border transition-all hover:shadow-[var(--notion-soft-shadow)]"
              style={{
                background: 'linear-gradient(145deg, #0d0c0a 0%, #14130f 100%)',
                borderColor: '#2a2520',
              }}
            >
              <div
                className="absolute inset-0 opacity-[0.06]"
                style={{
                  backgroundImage: 'repeating-linear-gradient(90deg, #5b8fa8 0px, #5b8fa8 1px, transparent 1px, transparent 80px), repeating-linear-gradient(0deg, #5b8fa8 0px, #5b8fa8 1px, transparent 1px, transparent 80px)',
                }}
              />
              <div className="relative p-6 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div
                    className="text-[10px] uppercase"
                    style={{ color: '#9e7322', fontFamily: "var(--font-mono)" }}
                  >
                    PDF Preflight
                  </div>
                  <ExternalLink
                    className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: '#d4952a' }}
                  />
                </div>
                <div
                  className="inline-flex gap-[5px] p-[8px_10px] rounded-lg"
                  style={{ background: '#161513' }}
                >
                  {TAXIWAY_TILES.map((tile) => (
                    <div
                      key={tile.id}
                      className="relative flex flex-col gap-[1px] overflow-hidden"
                      style={{ width: 34, height: 46 }}
                    >
                      <div
                        className="relative flex-1 flex items-end justify-center overflow-hidden"
                        style={{
                          borderRadius: '4px 4px 1px 1px',
                          background: 'linear-gradient(180deg, #2a2825 0%, #252420 100%)',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                        }}
                      >
                        <span className="taxiway-glyph" style={{ top: '100%' }}>
                          {tile.ch}
                        </span>
                      </div>
                      <div
                        className="relative flex-1 flex items-start justify-center overflow-hidden"
                        style={{
                          borderRadius: '1px 1px 4px 4px',
                          background: 'linear-gradient(180deg, #222120 0%, #1f1e1b 100%)',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
                        }}
                      >
                        <span className="taxiway-glyph" style={{ top: '0%' }}>
                          {tile.ch}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <p
                  className="text-sm leading-relaxed"
                  style={{
                    color: '#e8dcc8',
                    opacity: 0.4,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  Your PDFs, cleared for takeoff.
                </p>
              </div>
            </div>
          </a>

          <a
            href="https://rmv.fyi/projects/cassini"
            target="_blank"
            rel="noopener noreferrer"
            className="group block"
          >
            <div
              className="relative h-full overflow-hidden rounded-xl border transition-all hover:shadow-[var(--notion-soft-shadow)]"
              style={{
                background: 'linear-gradient(145deg, #2d2d33 0%, #272730 100%)',
                borderColor: '#42424c',
              }}
            >
              <div
                className="absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage: 'repeating-linear-gradient(90deg, #e8e4dc 0px, #e8e4dc 1px, transparent 1px, transparent 60px)',
                }}
              />
              <div className="relative p-6 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div
                    className="text-[10px] uppercase"
                    style={{ color: '#8a9a68', fontFamily: "var(--font-mono)" }}
                  >
                    Drawing App
                  </div>
                  <ExternalLink
                    className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: '#e8e4dc' }}
                  />
                </div>
                <div>
                  <h3
                    className="text-3xl leading-none"
                    style={{
                      fontFamily: "'Instrument Serif', Georgia, serif",
                      color: '#e8e4dc',
                    }}
                  >
                    Cassini
                  </h3>
                  <span
                    className="mt-1 inline-block text-[10px] uppercase"
                    style={{
                      color: '#c4523a',
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    ECS-1
                  </span>
                </div>
                <p
                  className="text-sm leading-relaxed"
                  style={{
                    color: '#e8e4dc',
                    opacity: 0.5,
                    fontFamily: "'Instrument Serif', Georgia, serif",
                    fontStyle: 'italic',
                  }}
                >
                  Create with limits.
                </p>
              </div>
            </div>
          </a>

          <a
            href="https://1337suite.is-hella.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="group block"
          >
            <div
              className="relative h-full overflow-hidden rounded-xl border transition-all hover:shadow-[var(--notion-soft-shadow)]"
              style={{
                background: 'linear-gradient(145deg, #0d0d0d 0%, #1a1a2e 100%)',
                borderColor: '#2a2a3e',
              }}
            >
              <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                  backgroundImage: 'repeating-linear-gradient(0deg, #00ff41 0px, #00ff41 1px, transparent 1px, transparent 40px)',
                }}
              />
              <div className="relative p-6 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div
                    className="text-[10px] uppercase"
                    style={{ color: '#7b68ee', fontFamily: "var(--font-mono)" }}
                  >
                    Unicode &amp; Text Tools
                  </div>
                  <ExternalLink
                    className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: '#00ff41' }}
                  />
                </div>
                <div>
                  <h3
                    className="text-sm leading-none"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: '#e0e0e0',
                      opacity: 0.7,
                    }}
                  >
                    Eleonor Rose&apos;s
                  </h3>
                  <span
                    className="text-2xl font-bold mt-1 inline-block"
                    style={{
                      color: '#00ff41',
                      fontFamily: "var(--font-mono)",
                      textShadow: '0 0 7px #00ff41, 0 0 20px rgba(0, 255, 65, 0.4)',
                    }}
                  >
                    [1337 SUITE]
                  </span>
                </div>
                <p
                  className="text-sm leading-relaxed"
                  style={{
                    color: '#00ff41',
                    opacity: 0.4,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  7ext, transf0rmed.
                </p>
              </div>
            </div>
          </a>
        </div>
      </section>

      {/* About Section */}
      <div className="mt-16 pt-8 border-t">
        <div className="max-w-2xl space-y-6">
          <h2 className="text-2xl font-bold text-foreground">About</h2>

          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              {APP_NAME} is a modified fork of {ORIGINAL_PROJECT_NAME}, a collection of small, focused utilities that respect your privacy
              and work entirely in your browser. No data leaves your machine, no accounts required,
              no tracking. Just tools that do what they say.
            </p>
            <p>
              This fork preserves attribution to the original author and contributors while adding changes maintained by {FORK_MAINTAINER_NAME}.
            </p>
            <p>
              The original project asks that, if you would like to donate, please donate to{" "}
              <a className="underline hover:text-primary" href="https://donate.wikimedia.org" target="_blank" rel="noopener noreferrer">
                Wikipedia<span className="sr-only"> (opens in new tab)</span>
              </a>{" "}
              or the{" "}
              <a className="underline hover:text-primary" href="https://www.eff.org/donate" target="_blank" rel="noopener noreferrer">
                EFF<span className="sr-only"> (opens in new tab)</span>
              </a>{" "}
              instead.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <div className="space-y-2">
              <h3 className="font-medium text-foreground">Made by</h3>
              <p className="text-muted-foreground">{APP_MADE_BY_NAME}</p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-foreground">Fork maintainer</h3>
              <p className="text-muted-foreground">
                <a
                  href="https://github.com/muhalpi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  {FORK_MAINTAINER_NAME}<span className="sr-only"> (opens in new tab)</span>
                </a>
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-foreground">Based on</h3>
              <p className="text-muted-foreground">
                <a
                  href={ORIGINAL_SOURCE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  {ORIGINAL_PROJECT_NAME} by {ORIGINAL_AUTHOR_NAME}<span className="sr-only"> (opens in new tab)</span>
                </a>
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-foreground">Original source</h3>
              <p className="text-muted-foreground">
                <a
                  href={ORIGINAL_SOURCE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  {ORIGINAL_SOURCE_LABEL}<span className="sr-only"> (opens in new tab)</span>
                </a>
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-foreground">This fork source</h3>
              <p className="text-muted-foreground">
                <a
                  href={APP_SOURCE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  {APP_SOURCE_LABEL}<span className="sr-only"> (opens in new tab)</span>
                </a>
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-foreground text-sm">Original contributors</h3>
            <div className="flex flex-wrap gap-1.5">
              {ORIGINAL_CONTRIBUTORS.map((person) => (
                <a
                  key={person.name}
                  href={person.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border bg-card px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {person.name}<span className="sr-only"> (opens in new tab)</span>
                </a>
              ))}
            </div>
            <p className="text-xs text-muted-foreground/60 pt-1">
              <a
                href="https://rmv.fyi/notes/i-hope-you-don-t-use-generative-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-muted-foreground transition-colors"
              >
                Original behind-the-scenes note<span className="sr-only"> (opens in new tab)</span>
              </a>
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-foreground text-sm">Additional contributors</h3>
            <p className="text-sm text-muted-foreground">{FORK_MAINTAINER_NAME}</p>
          </div>

          <div className="pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground/60">
              Built with Next.js, Tailwind CSS, and shadcn/ui. All processing happens locally in your browser.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
