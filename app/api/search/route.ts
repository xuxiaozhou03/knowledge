import embedding from "@/services/embedding";
import generate from "@/services/geneate";
import { getVectorDB } from "@/services/vectordb";
import { NextRequest } from "next/server";

export const POST = async (req: NextRequest) => {
  const { query } = await req.json();

  // Validate input
  if (!query || typeof query !== "string") {
    return new Response(JSON.stringify({ error: "Invalid query" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 将 query 转为向量
  const res = await embedding(query);

  //   // 获取 VectorDB 实例
  const db = await getVectorDB();

  // 执行向量搜索
  const results = await db.search(res, 5);

  const chunkTexts = results
    .map((chunk) => chunk.payload!.text)
    .filter(Boolean)
    .join("\n");

  const lang = "zh";
  //   调用大模型
  const newPrompt = chunkTexts
    ? `以下是相关的背景信息：\n"${chunkTexts}"\n\n用户语言为：${lang}\n请根据上面的信息回答用户的问题:\n${query}`
    : "";

  const response = await generate(newPrompt);

  // 透传 AI stream 给前端
  return new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
