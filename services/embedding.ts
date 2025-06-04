async function embedding(input: string): Promise<number[]> {
  try {
    const res = await fetch("https://ai.gitee.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer VRE6ZRYRZXSNIQVH58ZBHDM7BATGBCF9DVE0LL1V`,
      },
      body: JSON.stringify({
        input: [
          {
            text: input,
          },
        ],
        model: "jina-clip-v2",
      }),
    });
    const resJson = await res.json();

    return resJson.data[0].embedding;
  } catch (e) {
    console.log("Embedding error:", e);
    throw new Error("Embedding failed");
  }
}

export default embedding;
