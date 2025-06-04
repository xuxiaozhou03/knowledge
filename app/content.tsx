"use client";
import React, { useState } from "react";

export default function Content() {
  const [siteUrl, setSiteUrl] = useState(
    "https://ai.gitee.com/docs/getting-started/intro"
  );
  const [crawlStatus, setCrawlStatus] = useState("");
  const [query, setQuery] = useState("gitee ai 是什么");
  const [searchResult, setSearchResult] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // 递归爬取、embedding、存入向量数据库
  const handleCrawl = async () => {
    setCrawlStatus("正在处理...");
    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: siteUrl }),
      });
      if (res.ok) {
        setCrawlStatus("知识库已处理并存入向量数据库！");
      } else {
        setCrawlStatus("处理失败");
      }
    } catch (e) {
      setCrawlStatus("网络错误");
    }
  };

  // 对话查询
  const handleSearch = async () => {
    setSearching(true);
    setSearchResult([]);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.body) throw new Error("无响应流");
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // 处理多行 data: ...\n
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // 剩余部分留给下次
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const json = JSON.parse(line.slice(6));
              const content =
                json.choices?.[0]?.delta?.reasoning_content ||
                json.choices?.[0]?.delta?.content;
              if (content) {
                fullText += content;
                setSearchResult([{ text: fullText }]);
              }
            } catch {}
          }
        }
      }
    } catch (e) {
      setSearchResult([{ text: "网络错误" }]);
    }
    setSearching(false);
  };

  return (
    <div className="">
      <div style={{ maxWidth: 600, margin: "40px auto", padding: 20 }}>
        <h2>知识库在线网站导入</h2>
        <input
          type="text"
          placeholder="输入知识库网站地址"
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
          style={{ width: "80%" }}
        />
        <button onClick={handleCrawl} style={{ marginLeft: 8 }}>
          导入
        </button>
        <div style={{ marginTop: 8, color: "#888" }}>{crawlStatus}</div>

        <hr style={{ margin: "32px 0" }} />

        <h2>知识库对话</h2>
        <input
          type="text"
          placeholder="请输入你的问题"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: "80%" }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
        />
        <button
          onClick={handleSearch}
          disabled={searching}
          style={{ marginLeft: 8 }}
        >
          查询
        </button>
        <div style={{ marginTop: 16 }}>
          {searching && <div>搜索中...</div>}
          {searchResult.map((item, idx) => (
            <div
              key={idx}
              style={{
                margin: "8px 0",
                background: "#f6f6f6",
                padding: 8,
              }}
            >
              {item.text || JSON.stringify(item)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
