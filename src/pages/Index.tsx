import { useState } from 'react';
import { DocumentUpload } from '@/components/DocumentUpload';
import { RedlinePanel } from '@/components/RedlinePanel';
import { DocumentViewer } from '@/components/DocumentViewer';
import { DocxParser } from '@/services/docxParser';
import { DocumentState, RedlineChange, CollaborationComment } from '@/types/redline';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Users, Clock } from 'lucide-react';
import { toast } from 'sonner';

const Index = () => {
  const [documentState, setDocumentState] = useState<DocumentState | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const { content, changes, metadata } = await DocxParser.parseDocument(file);
      
      setDocumentState({
        metadata,
        changes,
        collaborationComments: [],
        documentContent: content,
        originalContent: content
      });
      
      toast.success(`Document loaded with ${changes.length} changes detected`);
    } catch (error) {
      toast.error('Failed to process document: ' + (error as Error).message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleChangeSelect = (changeId: string) => {
    setDocumentState(prev => prev ? {
      ...prev,
      selectedChangeId: changeId
    } : null);
  };

  const handleSuggestionAdd = (changeId: string, suggestion: string) => {
    setDocumentState(prev => {
      if (!prev) return null;
      
      return {
        ...prev,
        changes: prev.changes.map(change => 
          change.id === changeId 
            ? { ...change, suggestions: [...(change.suggestions || []), suggestion] }
            : change
        )
      };
    });
  };

  const handleCommentAdd = (changeId: string, comment: string) => {
    const newComment: CollaborationComment = {
      id: `comment-${Date.now()}`,
      changeId,
      author: 'Contract Manager',
      content: comment,
      timestamp: new Date()
    };

    setDocumentState(prev => prev ? {
      ...prev,
      collaborationComments: [...prev.collaborationComments, newComment]
    } : null);
  };

  const handleChangeResolve = (changeId: string) => {
    setDocumentState(prev => {
      if (!prev) return null;
      
      return {
        ...prev,
        changes: prev.changes.map(change => 
          change.id === changeId 
            ? { ...change, resolved: true }
            : change
        )
      };
    });
  };

  const handleTextSelect = (selection: { start: number; end: number; text: string }) => {
    console.log('Text selected:', selection);
    // Handle text selection for creating new suggestions/comments
  };

  const handleContentChange = (newContent: string) => {
    setDocumentState(prev => prev ? {
      ...prev,
      documentContent: newContent
    } : null);
  };

  if (!documentState) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-panel-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Contract Redlining Platform</h1>
                <p className="text-sm text-muted-foreground">
                  AI-powered contract review and collaboration
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Upload Section */}
        <div className="container mx-auto px-6 py-12">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-4">Upload Your Contract</h2>
              <p className="text-lg text-muted-foreground mb-6">
                Upload a Microsoft Word document (.docx) with track changes to begin the review process
              </p>
              
              <div className="flex justify-center gap-4 mb-8">
                <Badge variant="outline" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  .docx Support
                </Badge>
                <Badge variant="outline" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Collaboration Ready
                </Badge>
                <Badge variant="outline" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Real-time Sync
                </Badge>
              </div>
            </div>
            
            <DocumentUpload onFileUpload={handleFileUpload} isUploading={isUploading} />
            
            <div className="mt-8 text-center text-sm text-muted-foreground">
              <p>Your document will be processed to identify track changes, comments, and suggestions.</p>
              <p>All data is processed securely and remains confidential.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-panel-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              <div>
                <h1 className="font-semibold">{documentState.metadata.filename}</h1>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{documentState.metadata.wordCount} words</span>
                  <span>{documentState.changes.length} changes</span>
                  <span>Authors: {documentState.metadata.authors.join(', ')}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {documentState.changes.filter(c => !c.resolved).length} pending
              </Badge>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setDocumentState(null)}
              >
                New Document
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
            <RedlinePanel
              changes={documentState.changes}
              comments={documentState.collaborationComments}
              selectedChangeId={documentState.selectedChangeId}
              onChangeSelect={handleChangeSelect}
              onSuggestionAdd={handleSuggestionAdd}
              onCommentAdd={handleCommentAdd}
              onChangeResolve={handleChangeResolve}
            />
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          <ResizablePanel defaultSize={65}>
            <DocumentViewer
              documentContent={documentState.documentContent}
              changes={documentState.changes}
              selectedChangeId={documentState.selectedChangeId}
              onTextSelect={handleTextSelect}
              onContentChange={handleContentChange}
              filename={documentState.metadata.filename}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default Index;
