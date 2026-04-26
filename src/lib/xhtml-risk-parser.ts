import fs from "fs";

export interface ParsedRiskFactorItem {
  description: string;
  riskManagement: string;
  orderIndex: number;
}

export interface ParsedRiskFactor {
  sectionRef: string;
  title: string;
  criticalityScore: number;
  orderIndex: number;
  items: ParsedRiskFactorItem[];
}

export interface ParsedCategory {
  name: string;
  orderIndex: number;
  factors: ParsedRiskFactor[];
}

function stripHtml(html: string): string {
  return html
    .replace(/<\/p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<span[^>]*>\s*(?:●|•|&#x25CF;|&#x25cf;)[^<]*<\/span>/gi, "● ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#xA0;|&#160;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#x27;|&#8217;|&apos;|&rsquo;|&#8216;|&lsquo;/gi, "'")
    .replace(/&laquo;|&#171;/gi, "«")
    .replace(/&raquo;|&#187;/gi, "»")
    .replace(/&#x25CF;|&#x25cf;/g, "●")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildCriticalityMap(summarySection: string): Map<string, number> {
  const map = new Map<string, number>();
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(summarySection)) !== null) {
    const row = m[1];
    const critMatch = row.match(/background-color:\s*rgb\(220,\s*222,\s*227\)[^>]*>[\s\S]*?<p[^>]*>\s*(\d)\s*<\/p>/);
    const refMatch = row.match(/\b(\d+\.\d+\.\d+)\b/);
    if (critMatch && refMatch) {
      const ref = refMatch[1];
      if (!map.has(ref)) {
        map.set(ref, parseInt(critMatch[1], 10));
      }
    }
  }
  return map;
}

// Returns one item per content row (skips the header row)
function extractTableRows(tableHtml: string): ParsedRiskFactorItem[] {
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].slice(1);
  const items: ParsedRiskFactorItem[] = [];
  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    const description = cells[0] ? stripHtml(cells[0][1]).trim() : "";
    const riskManagement = cells[1] ? stripHtml(cells[1][1]).trim() : "";
    if (description || riskManagement) {
      items.push({ description, riskManagement, orderIndex: items.length });
    }
  }
  return items;
}

export function parseXhtmlRiskFactors(filePath: string): ParsedCategory[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot read XHTML file at "${filePath}": ${msg}`);
  }

  // Collect all named anchors
  const anchorRe = /<a\s+id="(_Toc\d+)">([\s\S]*?)<\/a>/g;
  const anchors: { id: string; text: string; index: number }[] = [];
  let am: RegExpExecArray | null;
  while ((am = anchorRe.exec(content)) !== null) {
    anchors.push({ id: am[1], index: am.index, text: am[2] });
  }

  const facteurAnchor = anchors.find((a) => /facteurs\s+de\s+risques/i.test(stripHtml(a.text)));
  if (!facteurAnchor) return [];
  const riskSectionStart = facteurAnchor.index;

  const endAnchor = anchors.find(
    (a) =>
      a.index > riskSectionStart &&
      /^\s*\d+\.\s/.test(stripHtml(a.text)) &&
      !/^\s*\d+\.\d+/.test(stripHtml(a.text)) &&
      !/facteurs\s+de\s+risques/i.test(stripHtml(a.text))
  );
  const riskSectionEnd = endAnchor ? endAnchor.index : content.length;

  const categoryAnchors = anchors.filter(
    (a) =>
      a.index > riskSectionStart &&
      a.index < riskSectionEnd &&
      /^\s*\d+\.\d+\s/.test(stripHtml(a.text))
  );
  if (categoryAnchors.length === 0) return [];

  const summarySection = content.slice(riskSectionStart, categoryAnchors[0].index);
  const criticalityMap = buildCriticalityMap(summarySection);

  const categories: ParsedCategory[] = [];

  for (let ci = 0; ci < categoryAnchors.length; ci++) {
    const catAnchor = categoryAnchors[ci];
    const catEnd =
      ci + 1 < categoryAnchors.length ? categoryAnchors[ci + 1].index : riskSectionEnd;
    const catContent = content.slice(catAnchor.index, catEnd);
    const catName = stripHtml(catAnchor.text).replace(/^\d+\.\d+\s+/, "").trim();

    const factorTitleRe =
      /<p[^>]*class="titre"[^>]*>\s*(\d+\.\d+\.\d+)\s+((?:(?!<a\s)[\s\S])*?)\s*<\/p>/g;
    const factorMatches: { sectionRef: string; title: string; index: number }[] = [];
    let fm: RegExpExecArray | null;
    while ((fm = factorTitleRe.exec(catContent)) !== null) {
      factorMatches.push({
        sectionRef: fm[1].trim(),
        title: stripHtml(fm[2]).trim(),
        index: fm.index,
      });
    }

    const factors: ParsedRiskFactor[] = [];

    for (let fi = 0; fi < factorMatches.length; fi++) {
      const factor = factorMatches[fi];
      const factorStart = factor.index;
      const factorEnd =
        fi + 1 < factorMatches.length ? factorMatches[fi + 1].index : catContent.length;
      const factorContent = catContent.slice(factorStart, factorEnd);

      // Collect items from ALL class="textes" tables (handles 1.3.1 with two sub-tables)
      const tableRe = /<table[^>]*class="textes"[\s\S]*?<\/table>/g;
      const items: ParsedRiskFactorItem[] = [];
      let tm: RegExpExecArray | null;
      while ((tm = tableRe.exec(factorContent)) !== null) {
        for (const row of extractTableRows(tm[0])) {
          items.push({ ...row, orderIndex: items.length });
        }
      }

      factors.push({
        sectionRef: factor.sectionRef,
        title: factor.title,
        criticalityScore: criticalityMap.get(factor.sectionRef) ?? 2,
        orderIndex: fi,
        items,
      });
    }

    categories.push({ name: catName, orderIndex: ci, factors });
  }

  return categories;
}
