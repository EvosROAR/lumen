export type DocumentMeta = {
  id: string;
  title: string;
  filename: string;
  chars: number;
  chunks: number;
  createdAt: string;
};

export type ChunkRecord = {
  id: string;
  documentId: string;
  title: string;
  filename: string;
  index: number;
  text: string;
  embedding: number[];
};

export type KnowledgeStore = {
  documents: DocumentMeta[];
  chunks: ChunkRecord[];
};

export type RetrievedChunk = ChunkRecord & {
  score: number;
};

export type Citation = {
  documentId: string;
  title: string;
  filename: string;
  chunkIndex: number;
  score: number;
  excerpt: string;
};

export type RetrievalMode = "vector" | "bm25" | "hybrid";

export type ConversationMeta = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: Citation[] | null;
  createdAt: string;
};

export type QueryLog = {
  id: string;
  conversationId?: string | null;
  query: string;
  retrievalMode: string;
  retrieveMs: number;
  generateMs: number;
  totalMs: number;
  topK: number;
  citationCount: number;
  citationFilenames: string[];
  createdAt: string;
};
