import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Check, Clock, User, Edit3 } from 'lucide-react';
import { RedlineChange, CollaborationComment } from '@/types/redline';
import { toast } from 'sonner';

interface RedlinePanelProps {
  changes: RedlineChange[];
  comments: CollaborationComment[];
  selectedChangeId?: string;
  onChangeSelect: (changeId: string) => void;
  onSuggestionAdd: (changeId: string, suggestion: string) => void;
  onCommentAdd: (changeId: string, comment: string) => void;
  onChangeResolve: (changeId: string) => void;
}

export const RedlinePanel = ({
  changes,
  comments,
  selectedChangeId,
  onChangeSelect,
  onSuggestionAdd,
  onCommentAdd,
  onChangeResolve
}: RedlinePanelProps) => {
  const [newSuggestion, setNewSuggestion] = useState('');
  const [newComment, setNewComment] = useState('');
  const [expandedChange, setExpandedChange] = useState<string | null>(null);

  const getChangeTypeColor = (type: RedlineChange['type']) => {
    switch (type) {
      case 'added': return 'bg-redline-added text-redline-added-foreground';
      case 'deleted': return 'bg-redline-deleted text-redline-deleted-foreground';
      case 'modified': return 'bg-redline-modified text-redline-modified-foreground';
      case 'comment': return 'bg-redline-comment text-redline-comment-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getChangeIcon = (type: RedlineChange['type']) => {
    switch (type) {
      case 'added': return '+';
      case 'deleted': return '−';
      case 'modified': return '±';
      case 'comment': return '💬';
      default: return '?';
    }
  };

  const handleSuggestionSubmit = (changeId: string) => {
    if (!newSuggestion.trim()) return;
    onSuggestionAdd(changeId, newSuggestion);
    setNewSuggestion('');
    toast.success('Suggestion added');
  };

  const handleCommentSubmit = (changeId: string) => {
    if (!newComment.trim()) return;
    onCommentAdd(changeId, newComment);
    setNewComment('');
    toast.success('Comment added');
  };

  const getCommentsForChange = (changeId: string) => {
    return comments.filter(comment => comment.changeId === changeId);
  };

  return (
    <div className="h-full flex flex-col bg-panel-background">
      <div className="p-4 border-b border-panel-border">
        <h2 className="text-lg font-semibold mb-2">Contract Changes</h2>
        <div className="flex gap-2">
          <Badge variant="secondary">{changes.length} changes</Badge>
          <Badge variant="outline">{changes.filter(c => !c.resolved).length} pending</Badge>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {changes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Edit3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No changes detected</p>
              <p className="text-sm">Upload a document with track changes to get started</p>
            </div>
          ) : (
            changes.map((change) => (
              <Card 
                key={change.id} 
                className={`p-4 cursor-pointer transition-all duration-200 ${
                  selectedChangeId === change.id 
                    ? 'ring-2 ring-highlight-active bg-highlight-active/5' 
                    : 'hover:bg-panel-background/80'
                } ${change.resolved ? 'opacity-60' : ''}`}
                onClick={() => onChangeSelect(change.id)}
              >
                <div className="flex items-start gap-3">
                  <Badge 
                    className={`${getChangeTypeColor(change.type)} shrink-0 w-6 h-6 p-0 flex items-center justify-center text-xs font-bold`}
                  >
                    {getChangeIcon(change.type)}
                  </Badge>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium capitalize">{change.type}</span>
                      {change.resolved && (
                        <Badge variant="outline" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Resolved
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      {change.type === 'deleted' && change.originalText && (
                        <p className="text-sm bg-redline-deleted/10 p-2 rounded line-through">
                          {change.originalText}
                        </p>
                      )}
                      
                      {change.text && (
                        <p className={`text-sm p-2 rounded ${
                          change.type === 'added' ? 'bg-redline-added/10' :
                          change.type === 'modified' ? 'bg-redline-modified/10' :
                          'bg-muted'
                        }`}>
                          {change.text}
                        </p>
                      )}
                      
                      {change.comment && (
                        <p className="text-sm text-muted-foreground italic">
                          "{change.comment}"
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{change.author}</span>
                      <Clock className="h-3 w-3" />
                      <span>{change.timestamp.toLocaleDateString()}</span>
                    </div>

                    {/* Suggestions */}
                    {change.suggestions && change.suggestions.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Suggestions:</p>
                        {change.suggestions.map((suggestion, index) => (
                          <div key={index} className="text-sm bg-accent/10 p-2 rounded">
                            {suggestion}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Comments */}
                    {getCommentsForChange(change.id).length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Comments:</p>
                        {getCommentsForChange(change.id).map((comment) => (
                          <div key={comment.id} className="text-sm bg-muted/50 p-2 rounded">
                            <p>{comment.content}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span>{comment.author}</span>
                              <span>{comment.timestamp.toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Expanded controls */}
                    {selectedChangeId === change.id && !change.resolved && (
                      <div className="mt-4 space-y-3 border-t border-panel-border pt-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Add Suggestion:</label>
                          <div className="flex gap-2 mt-1">
                            <Textarea
                              placeholder="Propose alternative text..."
                              value={newSuggestion}
                              onChange={(e) => setNewSuggestion(e.target.value)}
                              className="h-20 text-sm"
                            />
                            <Button 
                              size="sm" 
                              onClick={() => handleSuggestionSubmit(change.id)}
                              disabled={!newSuggestion.trim()}
                            >
                              Add
                            </Button>
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Add Comment:</label>
                          <div className="flex gap-2 mt-1">
                            <Textarea
                              placeholder="Add your feedback..."
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              className="h-16 text-sm"
                            />
                            <Button 
                              size="sm" 
                              onClick={() => handleCommentSubmit(change.id)}
                              disabled={!newComment.trim()}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => onChangeResolve(change.id)}
                          className="w-full"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Mark as Resolved
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};