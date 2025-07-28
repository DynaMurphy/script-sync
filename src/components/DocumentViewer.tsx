import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Download, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import { RedlineChange } from '@/types/redline';

interface DocumentViewerProps {
  documentContent: string;
  changes: RedlineChange[];
  selectedChangeId?: string;
  onTextSelect: (selection: { start: number; end: number; text: string }) => void;
  onContentChange: (newContent: string) => void;
  filename?: string;
}

export const DocumentViewer = ({
  documentContent,
  changes,
  selectedChangeId,
  onTextSelect,
  onContentChange,
  filename = 'Document'
}: DocumentViewerProps) => {
  const [zoom, setZoom] = useState(100);
  const [isEditing, setIsEditing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Highlight the selected change in the document
  useEffect(() => {
    if (!selectedChangeId || !contentRef.current) return;

    const selectedChange = changes.find(c => c.id === selectedChangeId);
    if (!selectedChange) return;

    // Scroll to and highlight the selected change
    const changeElements = contentRef.current.querySelectorAll(`[data-change-id="${selectedChangeId}"]`);
    if (changeElements.length > 0) {
      changeElements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedChangeId, changes]);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString();
    if (!selectedText.trim()) return;

    // Calculate approximate position in the document
    const range = selection.getRangeAt(0);
    const startOffset = range.startOffset;
    const endOffset = range.endOffset;

    onTextSelect({
      start: startOffset,
      end: endOffset,
      text: selectedText
    });
  };

  const renderDocumentWithChanges = (content: string) => {
    let processedContent = content;
    
    // Sort changes by location to process them in order
    const sortedChanges = [...changes].sort((a, b) => a.location.start - b.location.start);
    
    // Apply highlighting for changes
    sortedChanges.forEach((change) => {
      const changeClass = getChangeHighlightClass(change.type);
      const isSelected = selectedChangeId === change.id;
      
      // Simple highlighting - in a real implementation, you'd need more sophisticated text processing
      if (change.text) {
        const highlightedText = `<span 
          class="${changeClass} ${isSelected ? 'ring-2 ring-highlight-active' : ''} cursor-pointer rounded px-1" 
          data-change-id="${change.id}"
          title="${change.type}: ${change.author}"
        >${change.text}</span>`;
        
        processedContent = processedContent.replace(change.text, highlightedText);
      }
    });

    return { __html: processedContent };
  };

  const getChangeHighlightClass = (type: RedlineChange['type']) => {
    switch (type) {
      case 'added': return 'bg-redline-added/20 border-l-2 border-redline-added';
      case 'deleted': return 'bg-redline-deleted/20 border-l-2 border-redline-deleted line-through';
      case 'modified': return 'bg-redline-modified/20 border-l-2 border-redline-modified';
      case 'comment': return 'bg-redline-comment/20 border-l-2 border-redline-comment';
      default: return '';
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 50));

  const toggleEditMode = () => {
    if (isEditing && editorRef.current) {
      onContentChange(editorRef.current.value);
    }
    setIsEditing(!isEditing);
  };

  const handleRefresh = () => {
    // Reset zoom and refresh the document view
    setZoom(100);
    setIsEditing(false);
    // Trigger a re-render by clearing and restoring selection
    if (window.getSelection) {
      window.getSelection()?.removeAllRanges();
    }
  };

  const handleDownload = () => {
    // Create a blob with the current document content
    const blob = new Blob([documentContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace(/\.[^/.]+$/, '') + '_edited.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-document-background">
      {/* Header */}
      <div className="p-4 border-b border-panel-border bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">{filename}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{changes.length} changes detected</span>
                <Badge variant="outline" className="text-xs">
                  Track Changes: ON
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium w-12 text-center">{zoom}%</span>
            <Button variant="ghost" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            
            <Button variant="outline" size="sm" onClick={toggleEditMode}>
              {isEditing ? 'View' : 'Edit'}
            </Button>
            
            <Button variant="ghost" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            
            <Button variant="ghost" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Document Content */}
      <ScrollArea className="flex-1">
        <div className="p-8 max-w-4xl mx-auto">
          <Card className="min-h-[800px] bg-white shadow-lg">
            <div 
              className="p-8"
              style={{ fontSize: `${zoom}%` }}
            >
              {isEditing ? (
                <textarea
                  ref={editorRef}
                  defaultValue={documentContent}
                  className="w-full h-full min-h-[700px] border-none outline-none resize-none font-serif text-base leading-relaxed"
                  style={{ fontSize: 'inherit' }}
                />
              ) : (
                <div
                  ref={contentRef}
                  className="prose prose-slate max-w-none font-serif text-base leading-relaxed"
                  dangerouslySetInnerHTML={renderDocumentWithChanges(documentContent)}
                  onMouseUp={handleTextSelection}
                />
              )}
            </div>
          </Card>
        </div>
      </ScrollArea>

      {/* Status Bar */}
      <div className="p-2 border-t border-panel-border bg-muted/30 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Microsoft Word Compatibility Mode</span>
          <span>Words: {documentContent.split(/\s+/).length} | Changes: {changes.length}</span>
        </div>
      </div>
    </div>
  );
};