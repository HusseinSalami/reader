import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload as UploadIcon, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { documentApi, documentTypeApi, templateApi, DocumentType, Template } from '../services/api';
import { config } from '../config';

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [language, setLanguage] = useState<string>('en');
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadDocumentTypes();
  }, []);

  useEffect(() => {
    if (selectedDocumentType) {
      loadTemplates(selectedDocumentType);
    } else {
      setTemplates([]);
      setSelectedTemplate('');
    }
  }, [selectedDocumentType]);

  const loadDocumentTypes = async () => {
    try {
      const result = await documentTypeApi.list();
      setDocumentTypes(result.items || []);
    } catch (err) {
      console.error('Failed to load document types:', err);
      setError('Failed to load document types. Please refresh the page.');
    } finally {
      setLoadingTypes(false);
    }
  };

  const loadTemplates = async (documentTypeId: string) => {
    try {
      const result = await templateApi.list(documentTypeId);
      setTemplates(result.items || []);
      // Auto-select first template if available
      if (result.items && result.items.length > 0) {
        setSelectedTemplate(result.items[0].templateId);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Failed to load templates for this document type.');
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    if (!config.supportedFormats.includes(selectedFile.type)) {
      setError('Unsupported file format. Please upload PDF, PNG, JPG, or TIFF files.');
      return;
    }

    if (selectedFile.size > config.maxFileSize) {
      setError('File size exceeds 10MB limit.');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setSuccess(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  const handleUpload = async () => {
    if (!file || !selectedDocumentType || !selectedTemplate) return;

    setUploading(true);
    setError(null);

    try {
      // Convert file to base64
      const fileContent = await fileToBase64(file);

      // Upload using new Phase 2 API
      const result = await documentApi.uploadNew({
        documentTypeId: selectedDocumentType,
        templateId: selectedTemplate,
        filename: file.name,
        fileContent,
        language,
      });

      setDocumentId(result.documentId);
      setSuccess(true);
      setFile(null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Upload failed. Please try again.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const canUpload = file && selectedDocumentType && selectedTemplate && !uploading;

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '20px',
      padding: '3rem',
      boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
    }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#333' }}>
        Upload Document
      </h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Upload your document to extract and validate data automatically
      </p>

      {!success ? (
        <>
          {/* Document Type Selection */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 'bold',
              color: '#333',
            }}>
              Document Type *
            </label>
            {loadingTypes ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>
                Loading document types...
              </div>
            ) : documentTypes.length === 0 ? (
              <div style={{
                padding: '1rem',
                background: '#fff3e0',
                borderRadius: '10px',
                color: '#ff9800',
              }}>
                No document types available. Please create one first.
              </div>
            ) : (
              <select
                value={selectedDocumentType}
                onChange={(e) => setSelectedDocumentType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #ddd',
                  borderRadius: '10px',
                  fontSize: '1rem',
                  background: 'white',
                  cursor: 'pointer',
                }}
              >
                <option value="">Select a document type...</option>
                {documentTypes.map((type) => (
                  <option key={type.documentTypeId} value={type.documentTypeId}>
                    {type.name} - {type.description}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Template Selection */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 'bold',
              color: '#333',
            }}>
              Extraction Template *
            </label>
            {!selectedDocumentType ? (
              <div style={{
                padding: '0.75rem',
                border: '2px solid #ddd',
                borderRadius: '10px',
                color: '#999',
                background: '#f5f5f5',
              }}>
                Select a document type first
              </div>
            ) : templates.length === 0 ? (
              <div style={{
                padding: '1rem',
                background: '#fff3e0',
                borderRadius: '10px',
                color: '#ff9800',
              }}>
                No templates available for this document type.
              </div>
            ) : (
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #ddd',
                  borderRadius: '10px',
                  fontSize: '1rem',
                  background: 'white',
                  cursor: 'pointer',
                }}
              >
                <option value="">Select a template...</option>
                {templates.map((template) => (
                  <option key={template.templateId} value={template.templateId}>
                    {template.name} {template.aiEnhanced && '(AI Enhanced)'}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Language Selection */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 'bold',
              color: '#333',
            }}>
              Document Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #ddd',
                borderRadius: '10px',
                fontSize: '1rem',
                background: 'white',
                cursor: 'pointer',
              }}
            >
              <option value="en">English</option>
              <option value="fr">French</option>
              <option value="ar">Arabic</option>
            </select>
          </div>

          {/* File Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '3px dashed #667eea',
              borderRadius: '15px',
              padding: '4rem 2rem',
              textAlign: 'center',
              cursor: 'pointer',
              background: file ? 'rgba(102, 126, 234, 0.05)' : 'transparent',
              transition: 'all 0.3s',
              marginBottom: '2rem',
            }}
          >
            <UploadIcon size={64} style={{ color: '#667eea', margin: '0 auto 1rem' }} />
            <p style={{ fontSize: '1.25rem', color: '#333', marginBottom: '0.5rem' }}>
              {file ? file.name : 'Drop your file here or click to browse'}
            </p>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>
              Supported formats: PDF, PNG, JPG, TIFF (Max 10MB)
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.tiff"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            style={{ display: 'none' }}
          />

          {error && (
            <div style={{
              background: '#fee',
              border: '1px solid #fcc',
              borderRadius: '10px',
              padding: '1rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <AlertCircle size={20} color="#c00" />
              <span style={{ color: '#c00' }}>{error}</span>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!canUpload}
            style={{
              width: '100%',
              padding: '1rem',
              background: canUpload ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              cursor: canUpload ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            {uploading ? (
              <>
                <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
                Uploading and Processing...
              </>
            ) : (
              <>
                <UploadIcon size={20} />
                Upload & Process Document
              </>
            )}
          </button>
        </>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
        }}>
          <CheckCircle size={80} style={{ color: '#4caf50', margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#333' }}>
            Upload Successful!
          </h2>
          <p style={{ color: '#666', marginBottom: '2rem' }}>
            Your document is being processed. This may take 30-60 seconds.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              onClick={() => navigate(`/documents/${documentId}`)}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              View Document
            </button>
            <button
              onClick={() => {
                setSuccess(false);
                setDocumentId(null);
                setFile(null);
                setSelectedDocumentType('');
                setSelectedTemplate('');
              }}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'white',
                color: '#667eea',
                border: '2px solid #667eea',
                borderRadius: '10px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Upload Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
