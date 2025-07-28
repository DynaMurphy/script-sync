export interface RedlineChange {
  id: string;
  type: 'added' | 'deleted' | 'modified' | 'comment';
  text: string;
  originalText?: string;
  author: string;
  timestamp: Date;
  location: {
    start: number;
    end: number;
    paragraph?: number;
  };
  comment?: string;
  suggestions?: string[];
  resolved?: boolean;
}

export interface DocumentMetadata {
  filename: string;
  uploadedAt: Date;
  lastModified: Date;
  wordCount: number;
  changeCount: number;
  authors: string[];
}

export interface CollaborationComment {
  id: string;
  changeId: string;
  author: string;
  content: string;
  timestamp: Date;
  resolved?: boolean;
}

export interface DocumentState {
  metadata: DocumentMetadata;
  changes: RedlineChange[];
  collaborationComments: CollaborationComment[];
  selectedChangeId?: string;
  documentContent: string;
  originalContent: string;
}