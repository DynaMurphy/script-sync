import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, FileText, X } from 'lucide-react';
import { toast } from 'sonner';

interface DocumentUploadProps {
  onFileUpload: (file: File) => Promise<void>;
  isUploading?: boolean;
}

export const DocumentUpload = ({ onFileUpload, isUploading = false }: DocumentUploadProps) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.name.endsWith('.docx')) {
      toast.error('Please upload a .docx file');
      return;
    }

    setUploadedFile(file);
    try {
      await onFileUpload(file);
      toast.success('Document uploaded successfully!');
    } catch (error) {
      toast.error('Failed to upload document');
      setUploadedFile(null);
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    multiple: false,
    disabled: isUploading
  });

  const removeFile = () => {
    setUploadedFile(null);
  };

  if (uploadedFile) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">{uploadedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={removeFile}
            disabled={isUploading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card 
      {...getRootProps()} 
      className={`p-8 border-2 border-dashed cursor-pointer transition-all duration-200 ${
        isDragActive 
          ? 'border-primary bg-primary/5' 
          : 'border-panel-border hover:border-primary/50 hover:bg-panel-background/50'
      } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-4 text-center">
        <Upload className={`h-12 w-12 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
        <div>
          <p className="text-lg font-medium mb-2">
            {isDragActive ? 'Drop your document here' : 'Upload Contract Document'}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Drag and drop your .docx file here, or click to browse
          </p>
          <Button variant="outline" disabled={isUploading}>
            {isUploading ? 'Processing...' : 'Choose File'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Supports Microsoft Word documents (.docx) with track changes
        </p>
      </div>
    </Card>
  );
};