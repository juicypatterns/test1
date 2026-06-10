"use client";

import { useState, useRef } from "react";

const CHANNELS = [
  { id: "twitter", label: "Twitter/X", icon: "𝕏" },
  { id: "linkedin", label: "LinkedIn", icon: "in" },
  { id: "instagram", label: "Instagram", icon: "📷" },
  { id: "facebook", label: "Facebook", icon: "f" },
  { id: "blog", label: "Blog Post", icon: "📝" },
  { id: "youtube", label: "YouTube", icon: "▶" },
  { id: "short-form", label: "TikTok/Reels", icon: "📱" },
  { id: "email", label: "Email Campaign", icon: "✉" },
];

type Step = "strategy" | "content" | "email";

interface StepData {
  status: "idle" | "loading" | "done" | "error";
  content: string;
}

export default function Home() {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [goals, setGoals] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [steps, setSteps] = useState<Record<Step, StepData>>({
    strategy: { status: "idle", content: "" },
    content: { status: "idle", content: "" },
    email: { status: "idle", content: "" },
  });
  const [activeTab, setActiveTab] = useState<Step>("strategy");
  const abortRef = useRef<AbortController | null>(null);

  const toggleChannel = (id: string) => {
    setSelectedChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedChannels(CHANNELS.map((c) => c.id));
  };

  const handleGenerate = async () => {
    if (!topic || selectedChannels.length === 0) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setGenerating(true);
    setSteps({
      strategy: { status: "idle", content: "" },
      content: { status: "idle", content: "" },
      email: { status: "idle", content: "" },
    });

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          channels: selectedChannels,
          audience,
          tone,
          goals,
        }),
        signal: abortRef.current.signal,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response stream");

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.status === "complete") continue;

          setSteps((prev) => ({
            ...prev,
            [data.step]: {
              status: data.status,
              content:
                data.status === "done" || data.status === "error"
                  ? data.content
                  : prev[data.step as Step].content,
            },
          }));

          if (data.status === "done") {
            setActiveTab(data.step);
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        setSteps((prev) => ({
          ...prev,
          strategy: { status: "error", content: error.message },
        }));
      }
    } finally {
      setGenerating(false);
    }
  };

  const stepLabels: Record<Step, string> = {
    strategy: "Strategy",
    content: "Content",
    email: "Email Campaign",
  };

  const hasResults = Object.values(steps).some((s) => s.status === "done");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto max-w-6xl flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-sm font-bold">
            C
          </div>
          <h1 className="text-lg font-semibold">Content Generation Agent</h1>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col lg:flex-row gap-8">
        {/* Left panel - Form */}
        <div className="w-full lg:w-[420px] shrink-0 space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Topic / Content Brief *
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. How AI is transforming content marketing in 2026"
                rows={3}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Target Audience
              </label>
              <input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g. Marketing managers at B2B SaaS companies"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Tone
                </label>
                <input
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  placeholder="e.g. Professional, witty"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Goals
                </label>
                <input
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  placeholder="e.g. Drive signups"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-zinc-300">
                  Channels *
                </label>
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-violet-400 hover:text-violet-300"
                >
                  Select all
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {CHANNELS.map((channel) => {
                  const selected = selectedChannels.includes(channel.id);
                  return (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => toggleChannel(channel.id)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        selected
                          ? "border-violet-500 bg-violet-500/10 text-violet-300"
                          : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                      }`}
                    >
                      <span className="text-base">{channel.icon}</span>
                      {channel.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || !topic || selectedChannels.length === 0}
              className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Generating...
                </span>
              ) : (
                "Generate Content"
              )}
            </button>
          </div>
        </div>

        {/* Right panel - Output */}
        <div className="flex-1 min-w-0">
          {!hasResults && !generating ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-zinc-800 p-12">
              <div className="text-center space-y-2">
                <p className="text-3xl">*</p>
                <p className="text-zinc-400 text-sm">
                  Fill in your content brief and select channels to generate
                  your content package.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
              {/* Tabs */}
              <div className="flex border-b border-zinc-800">
                {(Object.keys(stepLabels) as Step[]).map((step) => {
                  const data = steps[step];
                  if (data.status === "idle") return null;
                  return (
                    <button
                      key={step}
                      onClick={() => setActiveTab(step)}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === step
                          ? "border-violet-500 text-violet-300"
                          : "border-transparent text-zinc-400 hover:text-zinc-300"
                      }`}
                    >
                      {data.status === "loading" && (
                        <svg
                          className="h-3.5 w-3.5 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                      )}
                      {data.status === "done" && (
                        <span className="text-green-400">ok</span>
                      )}
                      {data.status === "error" && (
                        <span className="text-red-400">err</span>
                      )}
                      {stepLabels[step]}
                    </button>
                  );
                })}
              </div>

              {/* Content */}
              <div className="p-6">
                {steps[activeTab].status === "loading" && (
                  <div className="flex items-center gap-3 text-zinc-400">
                    <svg
                      className="h-5 w-5 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Generating {stepLabels[activeTab].toLowerCase()}...
                  </div>
                )}

                {steps[activeTab].status === "error" && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-300 text-sm">
                    {steps[activeTab].content}
                  </div>
                )}

                {steps[activeTab].status === "done" && (
                  <div className="relative">
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(
                          steps[activeTab].content
                        )
                      }
                      className="absolute right-0 top-0 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      Copy
                    </button>
                    <div className="prose prose-invert prose-sm max-w-none pr-20 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_p]:text-zinc-300 [&_li]:text-zinc-300 [&_strong]:text-zinc-100">
                      <div
                        dangerouslySetInnerHTML={{
                          __html: markdownToHtml(steps[activeTab].content),
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function markdownToHtml(md: string): string {
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*<\/li>)/, "<ul>$1</ul>")
    .replace(/^(?!<[hulo])(.*\S.*)$/gm, "<p>$1</p>")
    .replace(/\n{2,}/g, "")
    .replace(/<\/ul>\s*<ul>/g, "");
}
