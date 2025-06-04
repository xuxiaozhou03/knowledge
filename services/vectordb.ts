import Database from "better-sqlite3";

interface VectorRow {
  id: string;
  vector: string;
  payload: string | null;
}

interface SearchResult {
  id: string;
  payload: Record<string, unknown> | null;
  score: number;
}

class VectorDBService {
  private db: Database.Database;
  private table: string;
  private dimension: number;

  constructor(dbPath: string = "vectordb.sqlite", table: string = "vectors") {
    this.db = new Database(dbPath);
    this.table = table;
    this.dimension = 0;
  }

  async init(dimension: number) {
    this.dimension = dimension;
    // 创建表，id 唯一，vector 用 JSON 存储，payload 也用 JSON
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS ${this.table} (
      id TEXT PRIMARY KEY,
      vector TEXT NOT NULL,
      payload TEXT
    )`
      )
      .run();
  }

  async insert(
    id: string,
    vector: number[],
    payload?: Record<string, unknown> | null
  ) {
    if (vector.length !== this.dimension) {
      throw new Error(
        `Vector dimension mismatch: expected ${this.dimension}, got ${vector.length}`
      );
    }
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO ${this.table} (id, vector, payload) VALUES (?, ?, ?)`
    );
    stmt.run(
      id,
      JSON.stringify(vector),
      payload ? JSON.stringify(payload) : null
    );
  }

  async search(vector: number[], topK: number = 5): Promise<SearchResult[]> {
    if (vector.length !== this.dimension) {
      throw new Error(
        `Vector dimension mismatch: expected ${this.dimension}, got ${vector.length}`
      );
    }
    const rows = this.db
      .prepare(`SELECT id, vector, payload FROM ${this.table}`)
      .all() as VectorRow[];
    const scored: SearchResult[] = rows.map((row: VectorRow) => {
      const v = JSON.parse(row.vector) as number[];
      const score = cosineSimilarity(vector, v);
      return {
        id: row.id,
        payload: row.payload ? JSON.parse(row.payload) : null,
        score,
      };
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}

// 余弦相似度
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}

export const getVectorDB = async (dimension = 1024) => {
  try {
    const db = new VectorDBService("vectordb.sqlite", "vectors");
    await db.init(dimension);
    return db;
  } catch (e) {
    console.error("Failed to initialize VectorDB:", e);
    throw new Error(`Failed to initialize VectorDB: ${e}`);
  }
};
