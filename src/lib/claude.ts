import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function askQuestion(question: string, context: string): Promise<string> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are an expert financial analyst. Answer the following question based ONLY on the document excerpts provided. Always cite which section your answer comes from. If the information is not in the excerpts, say so.

DOCUMENT EXCERPTS:
${context}

QUESTION: ${question}

Answer in the same language as the question.`,
      },
    ],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}
