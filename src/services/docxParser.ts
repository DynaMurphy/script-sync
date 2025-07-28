import mammoth from 'mammoth';
import JSZip from 'jszip';
import xml2js from 'xml2js';
import { RedlineChange, DocumentMetadata } from '@/types/redline';

export class DocxParser {
  private static parseXML = xml2js.parseString;

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

      // Parse the XML to extract track changes
      const parsedXml = await this.parseXMLPromise(documentXml);
      
      // Extract changes from the parsed XML
      this.extractChangesFromXML(parsedXml, changes);
      
      // Also check for comments
      const commentsXml = await docxContents.file('word/comments.xml')?.async('text');
      if (commentsXml) {
        const parsedComments = await this.parseXMLPromise(commentsXml);
        this.extractCommentsFromXML(parsedComments, changes);
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

  private static parseXMLPromise = (xml: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      try {
        // Create parser with browser-compatible options
        const parser = new xml2js.Parser({ 
          explicitArray: false,
          ignoreAttrs: false,
          mergeAttrs: true,
          normalize: true,
          normalizeTags: true,
          explicitRoot: false
        });
        
        parser.parseString(xml, (err: any, result: any) => {
          if (err) {
            console.error('XML parsing error:', err);
            reject(err);
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        console.error('Parser creation error:', error);
        reject(error);
      }
    });
  };

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

  private static extractChangesFromXML(xmlObj: any, changes: RedlineChange[]) {
    // This is a simplified extraction - real implementation would need to traverse
    // the complex Word document structure to find w:ins, w:del, and other change elements
    
    try {
      const document = xmlObj?.['w:document'];
      if (!document) return;

      // Look for insertions (w:ins)
      this.findElementsRecursive(document, 'w:ins', (element: any) => {
        const text = this.extractTextFromElement(element);
        const author = element.$?.['w:author'] || 'Unknown';
        const date = element.$?.['w:date'] ? new Date(element.$['w:date']) : new Date();
        
        if (text) {
          changes.push({
            id: `ins-${Date.now()}-${Math.random()}`,
            type: 'added',
            text,
            author,
            timestamp: date,
            location: { start: 0, end: text.length }
          });
        }
      });

      // Look for deletions (w:del)
      this.findElementsRecursive(document, 'w:del', (element: any) => {
        const text = this.extractTextFromElement(element);
        const author = element.$?.['w:author'] || 'Unknown';
        const date = element.$?.['w:date'] ? new Date(element.$['w:date']) : new Date();
        
        if (text) {
          changes.push({
            id: `del-${Date.now()}-${Math.random()}`,
            type: 'deleted',
            text: '',
            originalText: text,
            author,
            timestamp: date,
            location: { start: 0, end: text.length }
          });
        }
      });

    } catch (error) {
      console.warn('Error extracting changes from XML:', error);
    }
  }

  private static extractCommentsFromXML(xmlObj: any, changes: RedlineChange[]) {
    try {
      const comments = xmlObj?.['w:comments']?.['w:comment'];
      if (!comments) return;

      const commentArray = Array.isArray(comments) ? comments : [comments];
      
      commentArray.forEach((comment: any) => {
        const text = this.extractTextFromElement(comment);
        const author = comment.$?.['w:author'] || 'Unknown';
        const date = comment.$?.['w:date'] ? new Date(comment.$['w:date']) : new Date();
        
        if (text) {
          changes.push({
            id: `comment-${Date.now()}-${Math.random()}`,
            type: 'comment',
            text,
            author,
            timestamp: date,
            location: { start: 0, end: 0 },
            comment: text
          });
        }
      });
    } catch (error) {
      console.warn('Error extracting comments from XML:', error);
    }
  }

  private static findElementsRecursive(obj: any, tagName: string, callback: (element: any) => void) {
    if (!obj || typeof obj !== 'object') return;

    if (obj[tagName]) {
      const elements = Array.isArray(obj[tagName]) ? obj[tagName] : [obj[tagName]];
      elements.forEach(callback);
    }

    Object.values(obj).forEach((value: any) => {
      this.findElementsRecursive(value, tagName, callback);
    });
  }

  private static extractTextFromElement(element: any): string {
    if (!element) return '';
    
    let text = '';
    
    const extractTextRecursive = (obj: any) => {
      if (typeof obj === 'string') {
        text += obj;
      } else if (obj && typeof obj === 'object') {
        if (obj['w:t']) {
          const textNodes = Array.isArray(obj['w:t']) ? obj['w:t'] : [obj['w:t']];
          textNodes.forEach((node: any) => {
            if (typeof node === 'string') {
              text += node;
            } else if (node._) {
              text += node._;
            }
          });
        } else {
          Object.values(obj).forEach(extractTextRecursive);
        }
      }
    };

    extractTextRecursive(element);
    return text.trim();
  }
}