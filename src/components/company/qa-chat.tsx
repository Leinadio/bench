"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold">Poser une question sur ce DEU</h3>
      <div className="flex flex-col gap-2 max-h-96 overflow-auto">
        {messages.map((msg, i) => (
          <Card key={i} className={msg.role === "user" ? "bg-muted" : ""}>
            <CardContent className="pt-3 pb-3">
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              {msg.sources && msg.sources.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Sources : {msg.sources.join(", ")}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
        {loading && (
          <p className="text-sm text-muted-foreground">Analyse en cours...</p>
        )}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ex: Quels sont les principaux risques lies au climat ?"
          className="flex-1 min-h-[60px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <Button type="submit" disabled={loading}>
          Envoyer
        </Button>
      </form>
    </div>
  );
}
