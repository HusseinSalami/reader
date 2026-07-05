import { useState } from 'react';
import { Upload, Play, Loader, CheckCircle, AlertCircle, X } from 'lucide-react';
import { documentApi } from '../services/api';

interface TemplateTestingPanelProps {
  templateId: string;
  documentTypeId: string;
  onClose: () => void;
}

export default function TemplateTestingPanel({
  templateId,
  documentTypeId,
  onClose,
}: TemplateTestingPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResults(null);
      setError(null);
    }
  };

  const handleTest = async () => {
    if (!file) return;

    setTesting(true);
    setError(null);
    setResults(null);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const base64Content = base64.split(',')[1];

        // Upload document for processing
        const uploadResult = await documentApi.uploadNew({
          documentTypeId,
          templateId,
          filename: file.name,
          fileContent: base64Content,
          language: 'en',
        });

        // Poll for results
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes max
        const pollInterval = 5000; // 5 seconds

        const poll = async () => {
          attempts++;
          
          if (attempts > maxAttempts) {
            setError('Processing timeout - document is taking too long');
            setTesting(false);
            return;
          }

          const doc = await documentApi.get(uploadResult.documentId);

          if (doc.status === 'completed' || doc.status === 'failed') {
            setResults(doc);
            setTesting(false);
          } else if (doc.status === 'processing') {
            setTimeout(poll, pollInterval);
          } else {
            setError(`Unexpected status: ${doc.status}`);
            setTesting(false);
          }
        };

        setTimeout(poll, pollInterval);
      };

      reader.onerror = () => {
        setError('Failed to read file');
        setTesting(false);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('Test failed:', err);
      setError(err.response?.data?.message || 'Failed to test template');
      setTesting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '2rem',
        maxWidth: '800px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Test Template</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
            }}
          >
            <X size={24} />
          </button>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: 'bold',
            color: '#333',
          }}>
            Upload Sample Document
          </label>
          <div style={{
            border: '2px dashed #ddd',
            borderRadius: '10px',
            padding: '2rem',
            textAlign: 'center',
            cursor: 'pointer',
            background: file ? '#f0f7ff' : '#fafafa',
          }}>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.tiff"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="test-file-input"
            />
            <label htmlFor="test-file-input" style={{ cursor: 'pointer' }}>
              <Upload size={48} style={{ color: '#667eea', margin: '0 auto 1rem' }} />
              {file ? (
                <p style={{ color: '#333', margin: 0 }}>{file.name}</p>
              ) : (
                <>
                  <p style={{ color: '#666', margin: 0 }}>Click to upload or drag and drop</p>
                  <p style={{ color: '#999', fontSize: '0.9rem', margin: '0.5rem 0 0' }}>
                    PDF, PNG, JPEG, or TIFF (max 10MB)
                  </p>
                </>
              )}
            </label>
          </div>
        </div>

        <button
          onClick={handleTest}
          disabled={!file || testing}
          style={{
            width: '100%',
            padding: '1rem',
            background: !file || testing ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            cursor: !file || testing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            marginBottom: '2rem',
          }}
        >
          {testing ? (
            <>
              <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
              Processing...
            </>
          ) : (
            <>
              <Play size={20} />
              Test Template
            </>
          )}
        </button>

        {error && (
          <div style={{
            background: '#ffebee',
            border: '1px solid #f44336',
            borderRadius: '10px',
            padding: '1rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <AlertCircle size={20} color="#f44336" />
            <span style={{ color: '#f44336' }}>{error}</span>
          </div>
        )}

        {results && (
          <div style={{
            background: results.status === 'completed' ? '#e8f5e9' : '#ffebee',
            border: `1px solid ${results.status === 'completed' ? '#4caf50' : '#f44336'}`,
            borderRadius: '10px',
            padding: '1.5rem',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
            }}>
              {results.status === 'completed' ? (
                <>
                  <CheckCircle size={24} color="#4caf50" />
                  <h3 style={{ margin: 0, color: '#4caf50' }}>Extraction Complete</h3>
                </>
              ) : (
                <>
                  <AlertCircle size={24} color="#f44336" />
                  <h3 style={{ margin: 0, color: '#f44336' }}>Extraction Failed</h3>
                </>
              )}
            </div>

            {results.extractedData?.fields && (
              <div>
                <h4 style={{ marginBottom: '1rem', color: '#333' }}>Extracted Fields:</h4>
                {Object.entries(results.extractedData.fields).map(([fieldId, field]: [string, any]) => (
                  <div key={fieldId} style={{
                    background: 'white',
                    padding: '1rem',
                    borderRadius: '5px',
                    marginBottom: '0.5rem',
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem', color: '#333' }}>
                      {fieldId}
                    </div>
                    <div style={{ color: '#666', marginBottom: '0.25rem' }}>
                      {Array.isArray(field.value) ? (
                        <span>Table with {field.value.length} rows</span>
                      ) : typeof field.value === 'object' ? (
                        <pre style={{ fontSize: '0.8rem', overflow: 'auto' }}>
                          {JSON.stringify(field.value, null, 2)}
                        </pre>
                      ) : (
                        String(field.value)
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#999' }}>
                      Confidence: {(field.confidence * 100).toFixed(0)}% | Source: {field.source}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {results.validationErrors && results.validationErrors.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ marginBottom: '0.5rem', color: '#f44336' }}>Validation Errors:</h4>
                {results.validationErrors.map((error: any, idx: number) => (
                  <div key={idx} style={{
                    background: 'white',
                    padding: '0.75rem',
                    borderRadius: '5px',
                    marginBottom: '0.5rem',
                    borderLeft: '3px solid #f44336',
                  }}>
                    <div style={{ fontWeight: 'bold', color: '#333' }}>{error.fieldName}</div>
                    <div style={{ fontSize: '0.9rem', color: '#666' }}>{error.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
