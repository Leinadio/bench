/**
 * Incremental parser for a stream of JSON text containing one or more
 * top-level objects (typically a JSON array of objects from an LLM).
 *
 * Usage:
 *   const parser = createJsonObjectStreamParser();
 *   for (const chunk of textChunks) {
 *     const completed = parser.push(chunk);
 *     for (const obj of completed) {
 *       console.log("Got object:", obj);
 *     }
 *   }
 *
 * The parser:
 * - Tracks brace depth so it knows when an object is complete.
 * - Correctly skips braces appearing inside JSON strings.
 * - Handles escaped characters (e.g. `\"` inside a string).
 * - Ignores anything outside top-level objects (whitespace, commas, `[`, `]`,
 *   markdown code fences, etc.).
 * - Logs and skips objects that fail to parse, then continues.
 */
export interface JsonObjectStreamParser {
  push(chunk: string): unknown[];
}

export function createJsonObjectStreamParser(): JsonObjectStreamParser {
  let buffer = "";
  let position = 0;
  let depth = 0;
  let inString = false;
  let escape = false;
  let objectStartIdx = -1;

  return {
    push(chunk: string): unknown[] {
      buffer += chunk;
      const completed: unknown[] = [];

      while (position < buffer.length) {
        const ch = buffer[position];

        if (inString) {
          if (escape) {
            escape = false;
          } else if (ch === "\\") {
            escape = true;
          } else if (ch === '"') {
            inString = false;
          }
        } else {
          if (ch === '"') {
            inString = true;
          } else if (ch === "{") {
            if (depth === 0) {
              objectStartIdx = position;
            }
            depth++;
          } else if (ch === "}") {
            depth--;
            if (depth === 0 && objectStartIdx !== -1) {
              const objText = buffer.slice(objectStartIdx, position + 1);
              try {
                completed.push(JSON.parse(objText));
              } catch (err) {
                console.error(
                  "[streaming-json] Failed to parse object:",
                  objText.slice(0, 200),
                  err
                );
              }
              objectStartIdx = -1;
            }
          }
        }

        position++;
      }

      // If we're not in the middle of an object, drop the consumed prefix
      // to avoid unbounded buffer growth.
      if (depth === 0 && !inString) {
        buffer = buffer.slice(position);
        position = 0;
      }

      return completed;
    },
  };
}
