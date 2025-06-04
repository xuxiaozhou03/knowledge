import { NextRequest, NextResponse } from "next/server";
import { getVectorDB } from "@/services/vectordb";
import getTextFromUrl from "@/services/getTextFromUrl";
import embedding from "@/services/embedding";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: "缺少 url" }, { status: 400 });

    // 1. 递归爬取
    const pages = await getTextFromUrl(url);
    console.log("Crawled pages ended");

    // 2. 获取 VectorDB 实例
    const db = await getVectorDB();

    // 2. 拆段并 embedding
    for (const page of pages) {
      for (const chunk of page.content) {
        const res = await embedding(chunk);
        await db.insert(Math.random().toString(36).slice(2), res, {
          text: chunk,
          source: page.url,
        });
      }
    }

    return NextResponse.json({ success: true, data: pages });
  } catch (e) {
    console.log(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
