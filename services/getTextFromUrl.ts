import * as cheerio from "cheerio";

const fetchHtml = async (url: string): Promise<string> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
  return res.text();
};

/**
 * 获取元素的文本内容，打平成 string[]，<p>标签内容拼接为一段，<a>为markdown格式，同时收集所有链接
 */
const getTextContent = (
  element: cheerio.Cheerio<any>,
  links: Set<string>
): string[] => {
  const result: string[] = [];
  element.contents().each((_, child) => {
    if (child.type === "text") {
      const text = child.data?.trim();
      if (text) result.push(text);
      return;
    }
    if (child.type === "tag") {
      if (child.name === "a") {
        const $a = cheerio.load(child);
        const text = $a("a").text().trim();
        let href = $a("a").attr("href") || "";
        href = href.replace(/#.*$/, "");
        if (href) links.add(href); // 去除锚点
        if (text.length && href) result.push(`[${text}](${href})`);
        return;
      }
      if (child.name === "p") {
        // <p>标签，拼接所有子内容为一段
        const $p = cheerio.load(child);
        const pChildren = getTextContent($p("p"), links);
        if (pChildren.length > 0) result.push(pChildren.join(""));
        return;
      }
      // 其他标签，递归打平
      const $child = cheerio.load(child);
      result.push(...getTextContent($child(child), links));
    }
  });
  // 去除重复
  return [...Array.from(new Set(result))];
};
export interface HtmlData {
  url: string;
  title: string;
  description: string;
  content: string[];
}

// 递归爬取网页内容并获取所有 body 内的 url
async function getHtmlData(
  url: string,
  htmlData: HtmlData[],
  visited = new Set<string>(),
  maxLen = 500
) {
  if (visited.has(url)) return [];
  visited.add(url);

  let html = "";

  try {
    html = await fetchHtml(url);
  } catch (e) {}
  if (!html) return; // 如果没有获取到 HTML 则退出
  const $ = cheerio.load(html);

  // 网页标题
  const title = $("title").text().trim();

  // 网页描述
  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    "";

  // 遍历 body 的所有子节点，保持顺序，块级标签单独作为一项
  const body = $("body");
  const links = new Set<string>();
  const originContent = getTextContent(body, links);

  const content: string[] = [];
  // 对 content 进行简单处理，拼接成一段最长不超过 maxLen 的字符串
  originContent.forEach((item) => {
    const last = content[content.length - 1] || "";
    if (last.length + item.length <= maxLen) {
      content[content.length - 1] = last + " \n " + item; // 拼接到最后一段
    } else {
      content.push(item); // 新开一段
    }
  });

  htmlData.push({
    url,
    title,
    description,
    content,
  });

  // while (links.size > 0) {
  //   let nextUrl = links.values().next().value;
  //   if (!nextUrl) break; // 如果没有链接则退出
  //   links.delete(nextUrl);
  //   if (!nextUrl.startsWith("http")) {
  //     // 如果是相对路径，则转换为绝对路径
  //     nextUrl = new URL(nextUrl, new URL(url).origin).href;
  //   }
  //   if (visited.has(nextUrl)) continue; // 如果已经访问过则跳过

  //   await getHtmlData(nextUrl, htmlData, visited);
  // }
}

const getHtmls = async (url: string) => {
  const visited = new Set<string>();
  const htmlData: HtmlData[] = [];

  await getHtmlData(url, htmlData, visited);

  return htmlData;
};

export default getHtmls;
