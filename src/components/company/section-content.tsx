import { Badge } from "@/components/ui/badge";

export function SectionContent({
  heading,
  category,
  content,
}: {
  heading: string;
  category: string;
  content: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xl font-bold">{heading}</h2>
        <Badge variant="secondary">{category}</Badge>
      </div>
      <div className="prose prose-sm max-w-none whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}
