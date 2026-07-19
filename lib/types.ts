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
