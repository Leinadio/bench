"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

export function QAChat({ filingId }: { filingId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);
    const res = await fetch("/api/qa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, filingId }),
    });
    const data = await res.json();
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: data.answer, sources: data.sourceSections },
    ]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <MessageCircle className="w-5 h-5 text-primary" />
        <h3 className="text-xl">Poser une question sur ce DEU</h3>
      </div>

      {messages.length > 0 && (
        <div className="flex flex-col gap-3 max-h-96 overflow-auto">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "animate-fade-in-up",
                msg.role === "user" ? "flex justify-end" : "flex justify-start"
              )}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-4 py-3",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border"
                )}
              >
                <p className="text-base whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </p>
                {msg.sources && msg.sources.length > 0 && (
                  <p className="text-sm mt-2 opacity-70">
                    Sources : {msg.sources.join(", ")}
                  </p>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-xl px-4 py-3 flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary/50 loading-dot" />
                <span
                  className="w-2 h-2 rounded-full bg-primary/50 loading-dot"
                  style={{ animationDelay: "0.2s" }}
                />
                <span
                  className="w-2 h-2 rounded-full bg-primary/50 loading-dot"
                  style={{ animationDelay: "0.4s" }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ex: Quels sont les principaux risques li&eacute;s au climat ?"
          className="flex-1 min-h-[56px] resize-none text-base"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <Button type="submit" disabled={loading} size="lg">
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
