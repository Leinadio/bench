export interface NewsArticle {
  title: string;
  url: string;
  publishedAt: string;
}

export async function fetchNews(companyName: string, ticker: string): Promise<NewsArticle[]> {
  const query = encodeURIComponent(`"${companyName}" OR "${ticker}"`);
  const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=fr&gl=FR&ceid=FR:fr`;

  const response = await fetch(rssUrl, {
    headers: { "User-Agent": "FilingLens/1.0" },
  });

  if (!response.ok) {
    console.error(`News fetch failed: ${response.status}`);
    return [];
  }

  const xml = await response.text();
  const articles: NewsArticle[] = [];

  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && articles.length < 8) {
    const item = match[1];
    const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? "";
    const url = item.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? "";
    const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? "";

    if (title && url) {
      articles.push({
        title: title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
        url,
        publishedAt: pubDate,
      });
    }
  }

  return articles;
}
