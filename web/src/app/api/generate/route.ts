import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const CONTENT_STRATEGIST_PROMPT = `You are a content strategist. Given the topic and target channels, create a content strategy that includes:
- Content angle and key messages
- Target audience definition
- Content pillars and hooks for each channel
- Tone, goals, and call-to-action

Return your strategy as a structured markdown document.`;

const CONTENT_WRITER_PROMPT = `You are a skilled content writer. Based on the provided content strategy, create publish-ready content for the requested channels. Adapt your voice for each platform while keeping the core message unified.

For each channel you write for, produce:
- **Twitter/X**: A main tweet + 3-5 thread tweets
- **LinkedIn**: Professional post (150-300 words)
- **Instagram**: Caption with hashtag suggestions
- **Facebook**: Conversational, engagement-focused post
- **Blog**: Full post (800-1500 words) with headline, subheadings, intro, body, conclusion, CTA, and SEO meta description
- **YouTube**: Script outline (hook, intro, main points, CTA, outro)
- **Short-form video**: Script for TikTok/Reels (15-60 seconds)

Only write for the channels that are requested.`;

const EMAIL_MARKETER_PROMPT = `You are an email marketing expert. Based on the provided content strategy and written content, create an email campaign that includes:
- Email subject lines (2 A/B variants)
- Email body copy aligned with the content strategy
- Clear CTAs that drive traffic to the blog/video content
- A brief note on suggested send timing

Return the email campaign as structured markdown.`;

type Step = "strategy" | "content" | "email";

interface GenerateRequest {
  topic: string;
  channels: string[];
  audience?: string;
  tone?: string;
  goals?: string;
}

async function generateStep(
  client: Anthropic,
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

export async function POST(request: NextRequest) {
  const body: GenerateRequest = await request.json();
  const { topic, channels, audience, tone, goals } = body;

  if (!topic || !channels?.length) {
    return Response.json(
      { error: "Topic and at least one channel are required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const client = new Anthropic({ apiKey });

  const channelCategories = {
    social: channels.filter((c) =>
      ["twitter", "linkedin", "instagram", "facebook"].includes(c)
    ),
    blog: channels.includes("blog"),
    video: channels.filter((c) => ["youtube", "short-form"].includes(c)),
    email: channels.includes("email"),
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (step: Step, status: string, content: string) => {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ step, status, content })}\n\n`
          )
        );
      };

      try {
        send("strategy", "loading", "");
        const strategyInput = [
          `Topic: ${topic}`,
          audience ? `Target Audience: ${audience}` : "",
          tone ? `Tone: ${tone}` : "",
          goals ? `Goals: ${goals}` : "",
          `Channels: ${channels.join(", ")}`,
        ]
          .filter(Boolean)
          .join("\n");

        const strategy = await generateStep(
          client,
          CONTENT_STRATEGIST_PROMPT,
          strategyInput
        );
        send("strategy", "done", strategy);

        const contentChannels = [
          ...channelCategories.social,
          ...(channelCategories.blog ? ["blog"] : []),
          ...channelCategories.video,
        ];

        if (contentChannels.length > 0) {
          send("content", "loading", "");
          const contentInput = `## Content Strategy\n${strategy}\n\n## Channels to write for\n${contentChannels.join(", ")}`;
          const content = await generateStep(
            client,
            CONTENT_WRITER_PROMPT,
            contentInput
          );
          send("content", "done", content);
        }

        if (channelCategories.email) {
          send("email", "loading", "");
          const emailInput = `## Content Strategy\n${strategy}\n\n## Topic\n${topic}`;
          const email = await generateStep(
            client,
            EMAIL_MARKETER_PROMPT,
            emailInput
          );
          send("email", "done", email);
        }

        send("strategy", "complete", "");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ step: "strategy", status: "error", content: message })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
