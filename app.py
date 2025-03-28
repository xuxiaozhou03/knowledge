from flask import Flask, jsonify
import requests
from bs4 import BeautifulSoup
import numpy as np
from openai import OpenAI

# 初始化 Flask 应用
app = Flask(__name__)

# client = OpenAI(
# 	base_url="https://ai.gitee.com/v1",
# 	api_key="VRE6ZRYRZXSNIQVH58ZBHDM7BATGBCF9DVE0LL1V",
# )
client = OpenAI(
	base_url="https://ai-testing.gitee.com/v1",
	api_key="xxx",
)

# 知识库 URL
knowledge_base_url = "https://ai.gitee.com/docs/getting-started/intro"

# 替代 get_embedding 函数
def get_embedding(text):
    try:
        response = client.embeddings.create(
            model="bge-large-zh-v1.5",
            input=text,
        )
        # 正确访问嵌入数据
        return response.data[0].embedding
    except Exception as e:
        print(f"生成嵌入时出错: {e}")
        return None

# 替代 cosine_similarity 函数
def cosine_similarity(vec1, vec2):
    vec1 = np.array(vec1)
    vec2 = np.array(vec2)
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

# 使用 RAG 技术获取相关知识
def retrieve_relevant_knowledge(user_input, knowledge_base):
    # 检查输入和知识库是否有效
    if not user_input or not knowledge_base.strip():
        return "知识库为空或用户输入无效。"

    # 将知识库分块
    knowledge_chunks = knowledge_base.splitlines()
    chunk_embeddings = []

    # 生成知识库的嵌入
    try:
        for chunk in knowledge_chunks:
            if chunk.strip():  # 跳过空行
                embedding = get_embedding(chunk)
                chunk_embeddings.append((chunk, embedding))
    except Exception as e:
        print(f"生成知识库嵌入时出错: {e}")
        return "知识库处理失败，请稍后再试。"

    # 生成用户输入的嵌入
    try:
        user_embedding = get_embedding(user_input)
    except Exception as e:
        print(f"生成用户输入嵌入时出错: {e}")
        return "用户输入处理失败，请稍后再试。"

    # 计算相似度并排序
    relevant_chunks = sorted(
        chunk_embeddings,
        key=lambda x: cosine_similarity(user_embedding, x[1]),
        reverse=True
    )

    # 提取最相关的内容，限制总长度
    relevant_knowledge = []
    total_length = 0
    for chunk, _ in relevant_chunks:
        chunk_length = len(chunk)
        if total_length + chunk_length > 2000:  # 限制为 2000 字符
            break
        relevant_knowledge.append(chunk)
        total_length += chunk_length

    # 如果没有匹配到内容，返回默认提示
    if not relevant_knowledge:
        return "未能从知识库中找到相关内容。"

    return "\n".join(relevant_knowledge)

# 获取知识库内容
def fetch_knowledge_base(url):
    try:
        print(f"正在获取知识库内容: {url}")
        response = requests.get(url)
        response.raise_for_status()  # 检查请求是否成功
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 提取主页面文本内容
        main_content = soup.get_text()

        # print(f"主页面内容长度: {len(main_content)}")

        # 提取外链并获取其内容
        external_links = [a['href'] for a in soup.find_all('a', href=True) if a['href'].startswith('http')]
        # print(f"找到 {len(external_links)} 个外链")
        external_content = ""
        for link in external_links:
            try:
                ext_response = requests.get(link)
                ext_response.raise_for_status()
                ext_soup = BeautifulSoup(ext_response.text, 'html.parser')
                print(f"外链内容长度: {len(ext_soup.get_text())}")
                external_content += ext_soup.get_text() + "\n"
            except Exception as e:
                print(f"获取外链内容时出错 ({link}): {e}")

        # 合并主页面内容和外链内容
        return main_content + "\n" + external_content
    except Exception as e:
        print(f"获取知识库内容时出错: {e}")
        return ""

# 预处理知识库内容
knowledge_base_content = fetch_knowledge_base(knowledge_base_url)

# 使用 Qwen 大模型生成回答
def generate_response(user_input, relevant_knowledge):
    prompt = f"用户问题: {user_input}\n相关知识: {relevant_knowledge}\n不要联网搜索\n基于相关知识回答\n请根据相关知识回答用户问题:"
    try:
        response = client.chat.completions.create(
            model="Qwen2.5-72B-Instruct",
            stream=False,
            max_tokens=512,
            temperature=0.7,
            top_p=0.7,
            extra_body={
                "top_k": 50,
            },
            frequency_penalty=1,
            messages=[
                {"role": "system", "content": "你是一个智能客服助手，根据相关知识回答用户问题。"},
                {"role": "user", "content": prompt}
            ],
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"生成回答时出错: {e}")
        return "抱歉，我暂时无法回答您的问题，请稍后再试。"

# # API 接口
# @app.route('/ask', methods=['POST'])
# def ask_question():
#     user_input = request.json.get('question')
#     print(f"用户输入: {user_input}")
#     if not user_input:
#         return jsonify({"error": "请输入问题"}), 400

#     # 检索相关知识
#     relevant_knowledge = retrieve_relevant_knowledge(user_input, knowledge_base_content)

#     # 生成回答
#     answer = generate_response(user_input, relevant_knowledge)

#     return jsonify({"answer": answer})

# if __name__ == '__main__':
#     print("Starting the Flask app...")
#     app.run(debug=True)

def ask_question(user_input):
    # user_input = request.json.get('question')
    if not user_input:
        return jsonify({"error": "请输入问题"}), 400

    # 检索相关知识
    relevant_knowledge = retrieve_relevant_knowledge(user_input, knowledge_base_content)

    # 生成回答
    answer = generate_response(user_input, relevant_knowledge)

    print(f"回答: {answer}")
    return answer


ask_question("有什么计费方式？")