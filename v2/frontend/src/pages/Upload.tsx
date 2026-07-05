import { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Upload as UploadIcon, File, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { api } from '../services/api';

interface UploadItem {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'error';
  documentId?: string;
  error?: string;
}

export default function Upload() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const newUploads: UploadItem[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'pending' as const,
    }));
    setUploads((prev) => [...prev, ...newUploads]);

    // Start uploading each file
    newUploads.forEach((upload) => uploadFile(upload));
  }, []);

  async function uploadFile(upload: UploadItem) {
    setUploads((prev) =>
      prev.map((u) => (u.id === upload.id ? { ...u, status: 'uploading' } : u))
    );

    try {
      const result = await api.uploadFile<{ id: string; status: string }>(
        '/documents/upload',
        upload.file
      );
      setUploads((prev) =>
        prev.map((u) =>
          u.id === upload.id
            ? { ...u, status: 'processing', documentId: result.id }
            : u
        )
      );

      // Poll for completion
      pollStatus(upload.id, result.id);
    } catch (err: any) {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === upload.id ? { ...u, status: 'error', error: err.message } : u
        )
      );
    }
  }

  async function pollStatus(uploadId: string, documentId: string) {
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        const doc = await api.get<{ status: string }>(`/documents/${documentId}`);
        if (doc.status !== 'processing') {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === uploadId ? { ...u, status: 'done' } : u
            )
          );
          return;
        }
      } catch {
        break;
      }
    }
    // If we get here, still processing - mark as done anyway
    setUploads((prev) =>
      prev.map((u) => (u.id === uploadId ? { ...u, status: 'done' } : u))
    );
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Upload Documents</h1>
        <p className="text-slate-500 mt-1">
          Upload invoices, receipts, and other documents for AI-powered extraction
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`card border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-blue-400 bg-blue-50'
            : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
        />
        <div className="flex flex-col items-center">
          <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <UploadIcon className="w-7 h-7 text-blue-600" />
          </div>
          <p className="text-lg font-medium text-slate-900">
            Drop files here or click to browse
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Supports JPEG, PNG, WebP, and PDF files
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Multiple files supported for batch processing
          </p>
        </div>
      </div>

      {/* Upload list */}
      {uploads.length > 0 && (
        <div className="card divide-y divide-slate-100">
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">
              Uploads ({uploads.length})
            </h2>
          </div>
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="flex items-center justify-between p-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <File className="w-5 h-5 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {upload.file.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {(upload.file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                {upload.status === 'pending' && (
                  <span className="text-xs text-slate-400">Pending</span>
                )}
                {upload.status === 'uploading' && (
                  <span className="flex items-center gap-1 text-xs text-blue-600">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Uploading
                  </span>
                )}
                {upload.status === 'processing' && (
                  <span className="flex items-center gap-1 text-xs text-blue-600">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Processing
                  </span>
                )}
                {upload.status === 'done' && (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle className="w-3 h-3" />
                    Done
                  </span>
                )}
                {upload.status === 'error' && (
                  <span className="flex items-center gap-1 text-xs text-red-600">
                    <XCircle className="w-3 h-3" />
                    {upload.error || 'Failed'}
                  </span>
                )}
                {upload.documentId && upload.status === 'done' && (
                  <Link
                    to={`/documents/${upload.documentId}`}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium ml-2"
                  >
                    View
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
