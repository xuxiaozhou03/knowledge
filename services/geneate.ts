const generate = async (prompt: string) => {
  const API_URL = "https://ai.gitee.com/v1/chat/completions";
  const API_TOKEN = "VRE6ZRYRZXSNIQVH58ZBHDM7BATGBCF9DVE0LL1V";
  const headers = {
    "X-Failover-Enabled": "true",
    Authorization: `Bearer ${API_TOKEN}`,
    "Content-Type": "application/json",
  };

  const response = await fetch(API_URL, {
    headers,
    method: "POST",
    body: JSON.stringify({
      model: "Qwen3-32B",
      max_tokens: 1024,
      temperature: 0.7,
      top_p: 0.7,
      top_k: 50,
      frequency_penalty: 1,
      messages: [
        {
          content: prompt,
          role: "user",
        },
      ],
      stream: true, // 开启流式返回
    }),
  });
  return response;
};
export default generate;
