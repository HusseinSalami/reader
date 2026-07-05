import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentPreviewProps {
  fileUrl?: string;
  file?: File;
  onPageChange?: (pageNumber: number) => void;
  onDocumentLoad?: (numPages: number) => void;
  showControls?: boolean;
}

export default function DocumentPreview({
  fileUrl,
  file,
  onPageChange,
  onDocumentLoad,
  showControls = true,
}: DocumentPreviewProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
    if (onDocumentLoad) {
      onDocumentLoad(numPages);
    }
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('Error loading document:', error);
    setError('Failed to load document');
    setLoading(false);
  };

  const changePage = (offset: number) => {
    const newPage = pageNumber + offset;
    if (newPage >= 1 && newPage <= numPages) {
      setPageNumber(newPage);
      if (onPageChange) {
        onPageChange(newPage);
      }
    }
  };

  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 3.0));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.5));
  };

  const documentSource = file || fileUrl;

  if (!documentSource) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        background: '#f5f5f5',
        borderRadius: '10px',
        padding: '2rem',
        textAlign: 'center',
        color: '#666',
      }}>
        <div>
          <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>No document loaded</p>
          <p style={{ fontSize: '0.9rem' }}>Upload a document to preview</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#f5f5f5',
      borderRadius: '10px',
      overflow: 'hidden',
    }}>
      {showControls && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem',
          background: 'white',
          borderBottom: '1px solid #ddd',
        }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => changePage(-1)}
              disabled={pageNumber <= 1}
              style={{
                padding: '0.5rem',
                background: pageNumber <= 1 ? '#f0f0f0' : '#667eea',
                color: pageNumber <= 1 ? '#999' : 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: pageNumber <= 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ChevronLeft size={20} />
            </button>
            <span style={{ fontSize: '0.9rem', color: '#666' }}>
              Page {pageNumber} of {numPages || '?'}
            </span>
            <button
              onClick={() => changePage(1)}
              disabled={pageNumber >= numPages}
              style={{
                padding: '0.5rem',
                background: pageNumber >= numPages ? '#f0f0f0' : '#667eea',
                color: pageNumber >= numPages ? '#999' : 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: pageNumber >= numPages ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={zoomOut}
              disabled={scale <= 0.5}
              style={{
                padding: '0.5rem',
                background: scale <= 0.5 ? '#f0f0f0' : '#667eea',
                color: scale <= 0.5 ? '#999' : 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: scale <= 0.5 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ZoomOut size={20} />
            </button>
            <span style={{ fontSize: '0.9rem', color: '#666', minWidth: '60px', textAlign: 'center' }}>
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              disabled={scale >= 3.0}
              style={{
                padding: '0.5rem',
                background: scale >= 3.0 ? '#f0f0f0' : '#667eea',
                color: scale >= 3.0 ? '#999' : 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: scale >= 3.0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ZoomIn size={20} />
            </button>
          </div>
        </div>
      )}

      <div style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '2rem',
      }}>
        {loading && (
          <div style={{ textAlign: 'center', color: '#666' }}>
            <p>Loading document...</p>
          </div>
        )}

        {error && (
          <div style={{
            textAlign: 'center',
            color: '#f44336',
            background: '#ffebee',
            padding: '1rem',
            borderRadius: '5px',
          }}>
            <p>{error}</p>
          </div>
        )}

        <Document
          file={documentSource}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading=""
          error=""
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  );
}
