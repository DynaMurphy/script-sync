import mammoth from 'mammoth';
import JSZip from 'jszip';
import { RedlineChange, DocumentMetadata } from '@/types/redline';

export class DocxParser {

  static async parseDocument(file: File): Promise<{
    content: string;
    changes: RedlineChange[];
    metadata: DocumentMetadata;
  }> {
    try {
      // Extract text content using mammoth
      const { value: htmlContent } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
      
      // Convert HTML to plain text for processing
      const textContent = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      
      // Extract track changes from the docx file
      const changes = await this.extractTrackChanges(file);
      
      // Generate metadata
      const metadata: DocumentMetadata = {
        filename: file.name,
        uploadedAt: new Date(),
        lastModified: new Date(file.lastModified),
        wordCount: textContent.split(/\s+/).length,
        changeCount: changes.length,
        authors: [...new Set(changes.map(c => c.author))]
      };

      return {
        content: textContent,
        changes,
        metadata
      };
    } catch (error) {
      console.error('Error parsing document:', error);
      throw new Error('Failed to parse document. Please ensure it\'s a valid .docx file.');
    }
  }

  private static async extractTrackChanges(file: File): Promise<RedlineChange[]> {
    const changes: RedlineChange[] = [];
    
    try {
      const zip = new JSZip();
      const docxContents = await zip.loadAsync(file);
      
      // Extract the main document content
      const documentXml = await docxContents.file('word/document.xml')?.async('text');
      if (!documentXml) throw new Error('Could not find document.xml');

      // Parse the XML using browser's native DOMParser
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(documentXml, 'text/xml');
      
      // Extract changes from the parsed XML
      this.extractChangesFromXML(xmlDoc, changes);
      
      // Also check for comments
      const commentsXml = await docxContents.file('word/comments.xml')?.async('text');
      if (commentsXml) {
        const commentsDoc = parser.parseFromString(commentsXml, 'text/xml');
        this.extractCommentsFromXML(commentsDoc, changes);
      }

      // If no real changes found, return empty array instead of mock data
      if (changes.length === 0) {
        console.info('No track changes found in document. Upload a document with track changes enabled.');
      }

    } catch (error) {
      console.error('Could not extract track changes from document:', error);
      // Try alternative parsing method if available
      try {
        const textContent = await this.getTextContent(file);
        const alternativeChanges = this.parseAlternativeTrackChanges(textContent);
        if (alternativeChanges.length > 0) {
          return alternativeChanges;
        }
      } catch (altError) {
        console.warn('Alternative parsing also failed:', altError);
      }
      
      // Return empty array - let the UI handle the no changes case
      return [];
    }

    return changes;
  }


  // Helper method to get text content from file
  private static async getTextContent(file: File): Promise<string> {
    try {
      const { value: htmlContent } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
      return htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    } catch (error) {
      console.warn('Could not extract text content:', error);
      return '';
    }
  }

  // Alternative parsing method for when xml2js fails
  private static parseAlternativeTrackChanges(content: string): RedlineChange[] {
    const changes: RedlineChange[] = [];
    
    // Look for common track change patterns in the text
    const addedPattern = /\[Added: (.+?)\]/g;
    const deletedPattern = /\[Deleted: (.+?)\]/g;
    const modifiedPattern = /\[Modified: (.+?) -> (.+?)\]/g;
    
    let match;
    let index = 0;
    
    // Find added text
    while ((match = addedPattern.exec(content)) !== null) {
      changes.push({
        id: `alt-added-${index++}`,
        type: 'added',
        text: match[1],
        author: 'Document Author',
        timestamp: new Date(),
        location: { start: match.index, end: match.index + match[0].length },
        comment: 'Added content detected'
      });
    }
    
    // Find deleted text
    while ((match = deletedPattern.exec(content)) !== null) {
      changes.push({
        id: `alt-deleted-${index++}`,
        type: 'deleted',
        text: '',
        originalText: match[1],
        author: 'Document Author',
        timestamp: new Date(),
        location: { start: match.index, end: match.index + match[0].length },
        comment: 'Deleted content detected'
      });
    }
    
    // Find modified text
    while ((match = modifiedPattern.exec(content)) !== null) {
      changes.push({
        id: `alt-modified-${index++}`,
        type: 'modified',
        text: match[2],
        originalText: match[1],
        author: 'Document Author',
        timestamp: new Date(),
        location: { start: match.index, end: match.index + match[0].length },
        comment: 'Modified content detected'
      });
    }
    
    return changes;
  }

  private static extractChangesFromXML(xmlDoc: Document, changes: RedlineChange[]) {
    try {
      // Look for insertions (w:ins elements)
      const insertions = xmlDoc.querySelectorAll('ins, w\\:ins');
      insertions.forEach((element, index) => {
        const text = this.extractTextFromElement(element);
        const author = element.getAttribute('w:author') || element.getAttribute('author') || 'Unknown';
        const dateStr = element.getAttribute('w:date') || element.getAttribute('date');
        const date = dateStr ? new Date(dateStr) : new Date();
        
        if (text.trim()) {
          changes.push({
            id: `ins-${Date.now()}-${index}`,
            type: 'added',
            text: text.trim(),
            author,
            timestamp: date,
            location: { start: 0, end: text.length }
          });
        }
      });

      // Look for deletions (w:del elements)
      const deletions = xmlDoc.querySelectorAll('del, w\\:del');
      deletions.forEach((element, index) => {
        const text = this.extractTextFromElement(element);
        const author = element.getAttribute('w:author') || element.getAttribute('author') || 'Unknown';
        const dateStr = element.getAttribute('w:date') || element.getAttribute('date');
        const date = dateStr ? new Date(dateStr) : new Date();
        
        if (text.trim()) {
          changes.push({
            id: `del-${Date.now()}-${index}`,
            type: 'deleted',
            text: '',
            originalText: text.trim(),
            author,
            timestamp: date,
            location: { start: 0, end: text.length }
          });
        }
      });

      // Also look for elements with specific Word namespace prefixes
      const allElements = xmlDoc.querySelectorAll('*');
      allElements.forEach((element, index) => {
        if (element.tagName.includes(':ins') || element.tagName.includes(':del')) {
          const text = this.extractTextFromElement(element);
          const author = element.getAttribute('w:author') || 'Unknown';
          const dateStr = element.getAttribute('w:date');
          const date = dateStr ? new Date(dateStr) : new Date();
          
          if (text.trim()) {
            const isInsertion = element.tagName.includes(':ins');
            changes.push({
              id: `${isInsertion ? 'ins' : 'del'}-${Date.now()}-${index}`,
              type: isInsertion ? 'added' : 'deleted',
              text: isInsertion ? text.trim() : '',
              originalText: isInsertion ? undefined : text.trim(),
              author,
              timestamp: date,
              location: { start: 0, end: text.length }
            });
          }
        }
      });

      console.log(`Found ${changes.length} track changes in document`);

    } catch (error) {
      console.warn('Error extracting changes from XML:', error);
    }
  }

  private static extractCommentsFromXML(xmlDoc: Document, changes: RedlineChange[]) {
    try {
      const comments = xmlDoc.querySelectorAll('comment, w\\:comment');
      
      comments.forEach((comment, index) => {
        const text = this.extractTextFromElement(comment);
        const author = comment.getAttribute('w:author') || comment.getAttribute('author') || 'Unknown';
        const dateStr = comment.getAttribute('w:date') || comment.getAttribute('date');
        const date = dateStr ? new Date(dateStr) : new Date();
        
        if (text.trim()) {
          changes.push({
            id: `comment-${Date.now()}-${index}`,
            type: 'comment',
            text: text.trim(),
            author,
            timestamp: date,
            location: { start: 0, end: 0 },
            comment: text.trim()
          });
        }
      });
    } catch (error) {
      console.warn('Error extracting comments from XML:', error);
    }
  }


  private static extractTextFromElement(element: Element): string {
    if (!element) return '';
    
    // Get all text content, including from nested elements
    let text = element.textContent || '';
    
    // Also check for w:t elements (Word text elements)
    const textElements = element.querySelectorAll('t, w\\:t, delText, w\\:delText');
    textElements.forEach(textEl => {
      const elementText = textEl.textContent || '';
      if (elementText && !text.includes(elementText)) {
        text += ' ' + elementText;
      }
    });

    return text.trim();
  }
}