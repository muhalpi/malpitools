import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calculator, ExternalLink, FileText, Scale, Star } from "lucide-react";
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
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: `${APP_NAME} - privacy-first browser tools`,
  description:
    "A modified fork of delphitools with small, low stakes and low effort tools. No logins, no registration, no data collection.",
};

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
              src="/malpitools-icon.png"
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
              No logins, no registration, no data collection. The tools run
              locally in your browser, so your files and inputs stay on your
              device.
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

      {/* Another project links */}
      <section className="mt-16">
        <h2 className="mb-4 text-2xl font-bold text-foreground">
          Another project links
        </h2>
        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
          A couple of other small projects maintained by {FORK_MAINTAINER_NAME}.
        </p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <a
            href="https://buatcv-ats.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="group block"
          >
            <div className="relative h-full min-h-64 overflow-hidden rounded-lg border border-[#1d5d51] bg-[#123632] p-6 text-[#f7f1df] transition-all hover:shadow-[var(--notion-soft-shadow)]">
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-[0.08]"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, #f7f1df 1px, transparent 1px), linear-gradient(180deg, #f7f1df 1px, transparent 1px)",
                  backgroundSize: "34px 34px",
                }}
              />
              <div
                aria-hidden="true"
                className="absolute right-6 top-6 h-36 w-28 rotate-3 rounded-md border border-[#f7f1df]/25 bg-[#f7f1df] p-3 shadow-2xl transition-transform group-hover:rotate-1"
              >
                <div className="mb-3 h-3 w-16 rounded-full bg-[#123632]" />
                <div className="space-y-2">
                  <span className="block h-1.5 rounded-full bg-[#123632]/70" />
                  <span className="block h-1.5 w-4/5 rounded-full bg-[#123632]/35" />
                  <span className="block h-1.5 rounded-full bg-[#123632]/35" />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-1.5">
                  <span className="h-7 rounded bg-[#e9b949]" />
                  <span className="h-7 rounded bg-[#1d5d51]" />
                  <span className="h-7 rounded bg-[#d95d39]" />
                  <span className="h-7 rounded bg-[#123632]/20" />
                </div>
              </div>
              <div className="relative flex min-h-52 max-w-md flex-col justify-between gap-8 pr-28 sm:pr-36">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-[#e9b949] text-[#123632]">
                    <FileText className="size-5" aria-hidden="true" />
                  </div>
                  <ExternalLink
                    className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-hidden="true"
                  />
                </div>
                <div className="space-y-3">
                  <div className="text-[10px] font-semibold uppercase text-[#e9b949]">
                    ATS CV Builder
                  </div>
                  <h3 className="text-3xl font-bold leading-none text-[#f7f1df]">
                    BuatCV
                  </h3>
                  <p className="text-sm leading-relaxed text-[#f7f1df]/70">
                    Build, save, and download a professional ATS-friendly CV with a local-first workflow.
                  </p>
                </div>
              </div>
            </div>
          </a>

          <a
            href="https://hitung-pajak.alpi-muh.workers.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="group block"
          >
            <div className="relative h-full min-h-64 overflow-hidden rounded-lg border border-[#62372f] bg-[#261817] p-6 text-[#fff7ed] transition-all hover:shadow-[var(--notion-soft-shadow)]">
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-[0.1]"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 1px 1px, #fff7ed 1px, transparent 0)",
                  backgroundSize: "20px 20px",
                }}
              />
              <div
                aria-hidden="true"
                className="absolute right-6 top-6 grid w-28 grid-cols-3 gap-2 rounded-lg border border-[#ffb14a]/35 bg-[#381f1a] p-3 shadow-2xl transition-transform group-hover:-translate-y-1"
              >
                {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((key) => (
                  <span
                    key={key}
                    className="flex aspect-square items-center justify-center rounded bg-[#fff7ed]/10 text-xs font-semibold text-[#fff7ed]/70"
                  >
                    {key}
                  </span>
                ))}
                <span className="col-span-2 h-8 rounded bg-[#ffb14a]" />
                <span className="h-8 rounded bg-[#8bc34a]" />
              </div>
              <div className="relative flex min-h-52 max-w-md flex-col justify-between gap-8 pr-28 sm:pr-36">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-[#8bc34a] text-[#261817]">
                    <Calculator className="size-5" aria-hidden="true" />
                  </div>
                  <ExternalLink
                    className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-hidden="true"
                  />
                </div>
                <div className="space-y-3">
                  <div className="text-[10px] font-semibold uppercase text-[#ffb14a]">
                    Indonesian Tax Calculator
                  </div>
                  <h3 className="text-3xl font-bold leading-none text-[#fff7ed]">
                    Hitung Pajak
                  </h3>
                  <p className="text-sm leading-relaxed text-[#fff7ed]/70">
                    A focused calculator for checking Indonesian tax numbers without extra clutter.
                  </p>
                </div>
              </div>
            </div>
          </a>

          <a
            href="https://syariah.malpi.my.id/"
            target="_blank"
            rel="noopener noreferrer"
            className="group block"
          >
            <div className="relative h-full min-h-64 overflow-hidden rounded-lg border border-[#2e655a] bg-[#071f1b] p-6 text-[#f8f3df] transition-all hover:shadow-[var(--notion-soft-shadow)]">
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-[0.12]"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, #e2c56a 1px, transparent 1px), linear-gradient(45deg, #2e655a 1px, transparent 1px)",
                  backgroundSize: "26px 26px",
                }}
              />
              <div
                aria-hidden="true"
                className="absolute -right-8 top-7 size-36 rounded-full border border-[#e2c56a]/35 bg-[#0f342e] transition-transform duration-500 group-hover:rotate-6 group-hover:scale-105"
              >
                <span className="absolute left-8 top-8 size-7 rounded-full bg-[#e2c56a]" />
                <span className="absolute left-4 top-20 size-5 rounded-full bg-[#f8f3df]/50" />
                <span className="absolute left-16 top-20 size-5 rounded-full bg-[#f8f3df]/50" />
                <span className="absolute left-11 top-14 h-8 w-px bg-[#e2c56a]/60" />
                <span className="absolute left-6 top-20 h-px w-16 bg-[#e2c56a]/60" />
              </div>
              <div
                aria-hidden="true"
                className="absolute right-10 top-10 grid w-28 gap-2 rounded-md border border-[#e2c56a]/40 bg-[#f8f3df] p-3 shadow-2xl transition-transform duration-300 group-hover:-translate-y-1 group-hover:-rotate-2"
              >
                <span className="h-2 w-16 rounded-full bg-[#071f1b]" />
                <span className="h-1.5 rounded-full bg-[#071f1b]/35" />
                <span className="h-1.5 w-4/5 rounded-full bg-[#071f1b]/35" />
                <div className="grid grid-cols-3 gap-1 pt-3 text-center text-[10px] font-bold text-[#071f1b]">
                  <span className="rounded-sm bg-[#e2c56a] py-2">1/2</span>
                  <span className="rounded-sm bg-[#2e655a]/35 py-2">1/4</span>
                  <span className="rounded-sm bg-[#d86f45]/85 py-2">1/8</span>
                </div>
              </div>
              <div
                aria-hidden="true"
                className="absolute bottom-5 right-10 flex gap-1.5 transition-transform duration-300 group-hover:translate-x-1"
              >
                {["waris", "faraid", "ahli waris"].map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-[#e2c56a]/35 bg-[#071f1b]/80 px-2 py-1 text-[10px] font-semibold uppercase text-[#e2c56a]"
                  >
                    {label}
                  </span>
                ))}
              </div>
              <div className="relative flex min-h-52 max-w-md flex-col justify-start gap-6 pr-32 sm:pr-36">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-[#e2c56a] text-[#071f1b] transition-transform duration-300 group-hover:rotate-3">
                    <Scale className="size-5" aria-hidden="true" />
                  </div>
                  <ExternalLink
                    className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </div>
                <div className="space-y-3">
                  <div className="text-[10px] font-semibold uppercase text-[#e2c56a]">
                    Faraid Calculator
                  </div>
                  <h3 className="text-3xl font-bold leading-none text-[#f8f3df]">
                    Hitung Syariah
                  </h3>
                  <p className="hidden text-sm leading-relaxed text-[#f8f3df]/70 sm:block">
                    Calculate faraid inheritance shares clearly.
                  </p>
                </div>
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
