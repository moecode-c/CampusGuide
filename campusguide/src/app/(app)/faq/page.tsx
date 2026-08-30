"use client";

import * as React from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronLeft, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  FAQ_TOPICS,
  questionsFor,
  searchFaqs,
  topicById,
  type Faq,
  type FaqTopic,
  type FaqTopicId,
} from "@/lib/faq";

/**
 * A topic picker rather than one long list.
 *
 * Twelve stacked accordions made every question look equally (un)important and
 * buried the one you came for. Choosing a topic first cuts what you read to
 * two or three answers, and search still cuts across all of them for the times
 * you don't know which topic your question belongs to.
 */

function TopicCard({ topic, count, onPick }: { topic: FaqTopic; count: number; onPick: () => void }) {
  const Icon = topic.icon;

  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "group flex flex-col items-center justify-center gap-4 rounded-2xl border border-foreground/15 bg-panel px-5 py-9 text-center",
        "transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/50 hover:bg-panel/80 hover:shadow-xl hover:shadow-primary/10",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
      )}
    >
      <span className="grid h-20 w-20 place-items-center">
        {topic.image ? (
          // Set `image` on the topic in lib/faq.ts to use your own artwork.
          <Image
            src={topic.image}
            alt=""
            width={80}
            height={80}
            className="h-20 w-20 object-contain"
          />
        ) : (
          <Icon
            className="h-12 w-12 text-primary transition-transform duration-200 group-hover:scale-110"
            strokeWidth={1.5}
          />
        )}
      </span>

      <span className="space-y-1">
        <span className="block text-sm font-extrabold uppercase tracking-wide underline-offset-4 group-hover:underline">
          {topic.label}
        </span>
        <span className="block text-xs text-foreground/60">{topic.blurb}</span>
        <span className="block pt-1 text-[11px] font-semibold text-primary/80">
          {count} answer{count === 1 ? "" : "s"}
        </span>
      </span>
    </button>
  );
}

function FaqRow({
  item,
  defaultOpen,
  showTopic,
}: {
  item: Faq;
  defaultOpen: boolean;
  showTopic?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-foreground/10 bg-panel">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block text-sm font-extrabold">{item.question}</span>
          {showTopic ? (
            <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-wide text-primary/80">
              {topicById(item.topic)?.label}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-foreground/50 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {/* whitespace-pre-line so the paragraph breaks and bullet lines written
          into the answer text render, instead of collapsing into one block. */}
      {open ? (
        <p className="whitespace-pre-line border-t border-foreground/10 px-4 py-4 text-sm leading-relaxed text-foreground/80">
          {item.answer}
        </p>
      ) : null}
    </div>
  );
}

export default function FaqPage() {
  const [q, setQ] = React.useState("");
  const [topicId, setTopicId] = React.useState<FaqTopicId | null>(null);

  const searching = q.trim().length > 0;
  const results = React.useMemo(() => searchFaqs(q), [q]);
  const topic = topicId ? topicById(topicId) : null;
  const topicQuestions = topicId ? questionsFor(topicId) : [];

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">FAQ</h1>
      <p className="text-sm text-foreground/70">The questions MIU students ask most often.</p>

      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
        <Input
          className="h-12 pl-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search every question…"
          aria-label="Search the FAQ"
        />
      </div>

      {/* Search wins over the topic drill-down: if you typed something, you want
          matches from everywhere, not just the topic you happened to open. */}
      {searching ? (
        <section className="mt-6">
          <p className="mb-3 text-sm font-semibold text-foreground/70">
            {results.length} result{results.length === 1 ? "" : "s"} for “{q.trim()}”
          </p>

          {results.length === 0 ? (
            <div className="rounded-2xl border border-foreground/10 bg-panel px-5 py-12 text-center">
              <p className="text-sm font-semibold">Nothing matched that.</p>
              <p className="mt-1 text-sm text-foreground/60">
                Try a different word, or browse the topics below.
              </p>
              <button
                type="button"
                onClick={() => setQ("")}
                className="mt-4 text-sm font-bold text-primary underline-offset-4 hover:underline"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((item) => (
                // Open by default: a search hit is something you want to read,
                // not something you want to click again.
                <FaqRow key={item.question} item={item} defaultOpen showTopic />
              ))}
            </div>
          )}
        </section>
      ) : topic ? (
        <section className="mt-6">
          <button
            type="button"
            onClick={() => setTopicId(null)}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-foreground/70 hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            All topics
          </button>

          <div className="mb-4 flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/10">
              {topic.image ? (
                <Image
                  src={topic.image}
                  alt=""
                  width={56}
                  height={56}
                  className="h-10 w-10 object-contain"
                />
              ) : (
                <topic.icon className="h-7 w-7 text-primary" strokeWidth={1.5} />
              )}
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-extrabold tracking-tight">{topic.label}</h2>
              <p className="text-sm text-foreground/60">{topic.blurb}</p>
            </div>
          </div>

          <div className="space-y-2">
            {topicQuestions.map((item) => (
              <FaqRow key={item.question} item={item} defaultOpen={false} />
            ))}
          </div>
        </section>
      ) : (
        <section className="mt-6">
          <h2 className="mb-4 text-center text-lg font-extrabold uppercase tracking-[0.12em] text-foreground/80 sm:tracking-[0.2em]">
            Topics
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FAQ_TOPICS.map((t) => (
              <TopicCard
                key={t.id}
                topic={t}
                count={questionsFor(t.id).length}
                onPick={() => setTopicId(t.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
