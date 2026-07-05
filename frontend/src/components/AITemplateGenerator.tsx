import { useState } from 'react';
import { Sparkles, Upload, Loader, CheckCircle, AlertCircle, X, DollarSign } from 'lucide-react';
import { templateApi, DocumentType } from '../services/api';

interface AITemplateGeneratorProps {
  documentTypes: DocumentType[];
  onTemplateGenerated: (template: any) => void;
  onCancel: () => void;
  initialDocumentTypeId?: string;
}

export default function AITemplateGenerator({
  documentTypes,
  onTemplateGenerated,
  onCancel,
  initialDocumentTypeId,
}: AITemplateGeneratorProps) {
  const [selectedDocType, setSelectedDocType] = useState<string>(initialDocumentTypeId || '');
  const [sampleFiles, setSampleFiles] = useState<File[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const selectedType = documentTypes.find(dt => dt.documentTypeId === selectedDocType);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + sampleFiles.length > 3) {
      setError('Maximum 3 sample documents allowed');
      return;
    }
    setSampleFiles([...sampleFiles, ...files]);
    setError(null);
  };

  const removeFile = (index: number) => {
    setSampleFiles(sampleFiles.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!selectedDocType || sampleFiles.length === 0) {
      setError('Please select a document type and upload at least one sample document');
      return;
    }

    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      // Convert files to base64 and send directly to AI generator
      const sampleDocumentsData = await Promise.all(
        sampleFiles.map(async (file) => {
          // Convert to base64
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          
          const base64 = await base64Promise;
          const base64Content = base64.split(',')[1];

          return {
            filename: file.name,
            fileContent: base64Content,
          };
        })
      );

      // Generate template using AI (backend will handle S3 upload)
      const generatedTemplate = await templateApi.generateFromExamples({
        documentTypeId: selectedDocType,
        documentTypeName: selectedType!.name,
        documentTypeSchema: selectedType!.schema,
        sampleDocuments: sampleDocumentsData,
        templateName: templateName || undefined,
        templateDescription: templateDescription || undefined,
      });

      setResult(generatedTemplate);
      
    } catch (err: any) {
      console.error('Error generating template:', err);
      
      if (err.response?.status === 429) {
        setError('Monthly AI usage limit reached. Please try again next month or contact support.');
      } else {
        setError(err.response?.data?.error || err.response?.data?.message || 'Failed to generate template. Please try again.');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleAccept = () => {
    if (result?.template) {
      onTemplateGenerated(result.template);
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
      padding: '2rem',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '800px',
        maxHeight: '90vh',
        overflow: 'auto',
        padding: '2rem',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Sparkles size={32} style={{ color: '#667eea' }} />
            <div>
              <h2 style={{ fontSize: '1.75rem', margin: 0 }}>AI Template Generator</h2>
              <p style={{ fontSize: '0.9rem', color: '#666', margin: '0.25rem 0 0' }}>
                Let AI analyze your documents and create extraction rules
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
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

        {!result ? (
          <>
            {/* Cost Warning */}
            <div style={{
              background: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '10px',
              padding: '1rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
            }}>
              <DollarSign size={20} style={{ color: '#856404', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.9rem', color: '#856404' }}>
                <strong>Cost Notice:</strong> This feature uses AWS Bedrock AI (~$0.03-0.05 per generation).
                Monthly limit: $10. Current usage will be shown after generation.
              </div>
            </div>

            {/* Document Type Selection */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Document Type *
              </label>
              <select
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #ddd',
                  borderRadius: '10px',
                  fontSize: '1rem',
                }}
              >
                <option value="">Select document type...</option>
                {documentTypes.map((dt) => (
                  <option key={dt.documentTypeId} value={dt.documentTypeId}>
                    {dt.name} ({dt.schema.fields.length} fields)
                  </option>
                ))}
              </select>
            </div>

            {/* Template Name (Optional) */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Template Name (Optional)
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Leave empty for auto-generated name"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #ddd',
                  borderRadius: '10px',
                  fontSize: '1rem',
                }}
              />
            </div>

            {/* Template Description (Optional) */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Description (Optional)
              </label>
              <textarea
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Leave empty for auto-generated description"
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #ddd',
                  borderRadius: '10px',
                  fontSize: '1rem',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Sample Documents Upload */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Sample Documents * (1-3 documents)
              </label>
              <div style={{
                border: '2px dashed #ddd',
                borderRadius: '10px',
                padding: '2rem',
                textAlign: 'center',
                background: sampleFiles.length > 0 ? '#f0f7ff' : '#fafafa',
              }}>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.tiff"
                  multiple
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  id="sample-files-input"
                  disabled={sampleFiles.length >= 3}
                />
                <label htmlFor="sample-files-input" style={{ cursor: sampleFiles.length >= 3 ? 'not-allowed' : 'pointer' }}>
                  <Upload size={48} style={{ color: '#667eea', margin: '0 auto 1rem' }} />
                  <p style={{ color: '#666', margin: 0 }}>
                    {sampleFiles.length === 0 
                      ? 'Click to upload sample documents'
                      : `${sampleFiles.length}/3 documents uploaded`}
                  </p>
                  <p style={{ color: '#999', fontSize: '0.9rem', margin: '0.5rem 0 0' }}>
                    PDF, PNG, JPEG, or TIFF (max 10MB each)
                  </p>
                </label>
              </div>

              {/* File List */}
              {sampleFiles.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  {sampleFiles.map((file, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem',
                        background: '#f9f9f9',
                        borderRadius: '5px',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <span style={{ fontSize: '0.9rem', color: '#333' }}>{file.name}</span>
                      <button
                        onClick={() => removeFile(index)}
                        style={{
                          background: '#f44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '5px',
                          padding: '0.25rem 0.5rem',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Error Message */}
            {error && (
              <div style={{
                background: '#ffebee',
                border: '1px solid #f44336',
                borderRadius: '10px',
                padding: '1rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <AlertCircle size={20} color="#f44336" />
                <span style={{ color: '#f44336' }}>{error}</span>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!selectedDocType || sampleFiles.length === 0 || generating}
              style={{
                width: '100%',
                padding: '1rem',
                background: !selectedDocType || sampleFiles.length === 0 || generating
                  ? '#ccc'
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                cursor: !selectedDocType || sampleFiles.length === 0 || generating ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              {generating ? (
                <>
                  <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
                  Analyzing documents with AI...
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  Generate Template with AI
                </>
              )}
            </button>
          </>
        ) : (
          /* Results */
          <div>
            <div style={{
              background: '#e8f5e9',
              border: '1px solid #4caf50',
              borderRadius: '10px',
              padding: '1.5rem',
              marginBottom: '1.5rem',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1rem',
              }}>
                <CheckCircle size={24} color="#4caf50" />
                <h3 style={{ margin: 0, color: '#4caf50' }}>Template Generated Successfully!</h3>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ color: '#333' }}>Template Name:</strong>
                <p style={{ margin: '0.25rem 0', color: '#666' }}>{result.template.name}</p>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ color: '#333' }}>Description:</strong>
                <p style={{ margin: '0.25rem 0', color: '#666' }}>{result.template.description}</p>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ color: '#333' }}>Generated Rules:</strong>
                <div style={{ marginTop: '0.5rem' }}>
                  {result.template.rules.map((rule: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        background: 'white',
                        padding: '0.75rem',
                        borderRadius: '5px',
                        marginBottom: '0.5rem',
                        border: '1px solid #ddd',
                      }}
                    >
                      <div style={{ fontWeight: 'bold', color: '#333', marginBottom: '0.25rem' }}>
                        {rule.fieldId} ({rule.method})
                      </div>
                      {rule.reasoning && (
                        <div style={{ fontSize: '0.85rem', color: '#666', fontStyle: 'italic' }}>
                          {rule.reasoning}
                        </div>
                      )}
                      {rule.confidence && (
                        <div style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.25rem' }}>
                          Confidence: {(rule.confidence * 100).toFixed(0)}%
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{
                background: '#fff3cd',
                padding: '0.75rem',
                borderRadius: '5px',
                fontSize: '0.9rem',
                color: '#856404',
              }}>
                <strong>Cost:</strong> ${result.usage.cost.toFixed(4)} | 
                <strong> Monthly Usage:</strong> ${result.usage.monthlyUsage.toFixed(2)} / $10.00 | 
                <strong> Remaining:</strong> ${result.usage.remainingBudget.toFixed(2)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={onCancel}
                style={{
                  flex: 1,
                  padding: '1rem',
                  background: 'white',
                  color: '#666',
                  border: '2px solid #ddd',
                  borderRadius: '10px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                Discard
              </button>
              <button
                onClick={handleAccept}
                style={{
                  flex: 1,
                  padding: '1rem',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                Use This Template
              </button>
            </div>
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
