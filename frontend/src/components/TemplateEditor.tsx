import { useState } from 'react';
import { Plus, Trash2, Save, X, FileText, TestTube } from 'lucide-react';
import { DocumentType } from '../services/api';
import DocumentPreview from './DocumentPreview';
import TemplateTestingPanel from './TemplateTestingPanel';

interface Rule {
  ruleId?: string;
  fieldId: string;
  method: 'textract_kv' | 'regex' | 'table';
  params: Record<string, any>;
}

interface TemplateEditorProps {
  documentTypes: DocumentType[];
  initialData?: {
    name: string;
    description: string;
    documentTypeId: string;
    templateId?: string;
    rules: Rule[];
    aiEnhanced: boolean;
  };
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}

export default function TemplateEditor({
  documentTypes,
  initialData,
  onSave,
  onCancel,
}: TemplateEditorProps) {
  const [formData, setFormData] = useState(initialData || {
    name: '',
    description: '',
    documentTypeId: '',
    rules: [],
    aiEnhanced: true,
  });
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [showTesting, setShowTesting] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'rules' | 'preview'>('basic');

  const selectedDocType = documentTypes.find(dt => dt.documentTypeId === formData.documentTypeId);
  const availableFields = selectedDocType?.schema.fields || [];

  const handleAddRule = () => {
    setFormData({
      ...formData,
      rules: [...formData.rules, { fieldId: '', method: 'textract_kv', params: {} }],
    });
  };

  const handleRemoveRule = (index: number) => {
    setFormData({
      ...formData,
      rules: formData.rules.filter((_, i) => i !== index),
    });
  };

  const handleRuleChange = (index: number, field: string, value: any) => {
    const newRules = [...formData.rules];
    
    if (field === 'method') {
      // Reset params when method changes
      newRules[index] = {
        ...newRules[index],
        method: value,
        params: getDefaultParams(value),
      };
    } else {
      newRules[index] = { ...newRules[index], [field]: value };
    }
    
    setFormData({ ...formData, rules: newRules });
  };

  const handleParamChange = (ruleIndex: number, paramKey: string, paramValue: any) => {
    const newRules = [...formData.rules];
    newRules[ruleIndex] = {
      ...newRules[ruleIndex],
      params: {
        ...newRules[ruleIndex].params,
        [paramKey]: paramValue,
      },
    };
    setFormData({ ...formData, rules: newRules });
  };

  const getDefaultParams = (method: string): Record<string, any> => {
    switch (method) {
      case 'textract_kv':
        return { keyPattern: '', confidence: 0.8 };
      case 'regex':
        return { pattern: '', captureGroup: 0 };
      case 'table':
        return { tableIndex: 0, columnMapping: {} };
      default:
        return {};
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSampleFile(file);
      setActiveTab('preview');
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
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
        maxWidth: '1400px',
        height: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem 2rem',
          borderBottom: '1px solid #eee',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ fontSize: '1.5rem', margin: 0 }}>
            {initialData?.templateId ? 'Edit Template' : 'Create Template'}
          </h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {formData.templateId && (
              <button
                onClick={() => setShowTesting(true)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <TestTube size={20} />
                Test Template
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={saving || !formData.name || !formData.documentTypeId}
              style={{
                padding: '0.75rem 1.5rem',
                background: saving || !formData.name || !formData.documentTypeId
                  ? '#ccc'
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: saving || !formData.name || !formData.documentTypeId ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <Save size={20} />
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={onCancel}
              style={{
                padding: '0.75rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0 2rem',
          borderBottom: '1px solid #eee',
        }}>
          {['basic', 'rules', 'preview'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              style={{
                padding: '1rem 1.5rem',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab ? '3px solid #667eea' : 'none',
                color: activeTab === tab ? '#667eea' : '#666',
                fontWeight: activeTab === tab ? 'bold' : 'normal',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {tab === 'basic' && 'Basic Info'}
              {tab === 'rules' && `Extraction Rules (${formData.rules.length})`}
              {tab === 'preview' && 'Document Preview'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '2rem' }}>
          {activeTab === 'basic' && (
            <div style={{ maxWidth: '600px' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Template Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Standard Invoice Template"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #ddd',
                    borderRadius: '10px',
                    fontSize: '1rem',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what this template extracts..."
                  rows={3}
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

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Document Type *
                </label>
                <select
                  value={formData.documentTypeId}
                  onChange={(e) => setFormData({ ...formData, documentTypeId: e.target.value, rules: [] })}
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
                      {dt.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={formData.aiEnhanced}
                    onChange={(e) => setFormData({ ...formData, aiEnhanced: e.target.checked })}
                    style={{ width: '20px', height: '20px' }}
                  />
                  <span style={{ fontWeight: 'bold' }}>Enable AI Enhancement (Bedrock)</span>
                </label>
                <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem', marginLeft: '28px' }}>
                  Use Claude AI to improve extraction accuracy and handle complex documents
                </p>
              </div>

              <div style={{
                background: '#f0f7ff',
                padding: '1rem',
                borderRadius: '10px',
                border: '1px solid #667eea',
              }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                  💡 <strong>Tip:</strong> Upload a sample document in the Preview tab to help configure extraction rules
                </p>
              </div>
            </div>
          )}

          {activeTab === 'rules' && (
            <div>
              {!formData.documentTypeId ? (
                <div style={{
                  textAlign: 'center',
                  padding: '3rem',
                  color: '#666',
                }}>
                  <FileText size={64} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                  <p>Please select a document type first</p>
                </div>
              ) : (
                <>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1.5rem',
                  }}>
                    <h3 style={{ margin: 0 }}>Extraction Rules</h3>
                    <button
                      onClick={handleAddRule}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <Plus size={20} />
                      Add Rule
                    </button>
                  </div>

                  {formData.rules.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '3rem',
                      background: '#f9f9f9',
                      borderRadius: '10px',
                      color: '#666',
                    }}>
                      <p>No extraction rules yet. Click "Add Rule" to get started.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {formData.rules.map((rule, index) => (
                        <RuleEditor
                          key={index}
                          rule={rule}
                          index={index}
                          availableFields={availableFields}
                          onRuleChange={handleRuleChange}
                          onParamChange={handleParamChange}
                          onRemove={handleRemoveRule}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'preview' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {!sampleFile ? (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px dashed #ddd',
                  borderRadius: '10px',
                  padding: '3rem',
                }}>
                  <FileText size={64} style={{ color: '#667eea', marginBottom: '1rem' }} />
                  <p style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#333' }}>
                    Upload a sample document
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.tiff"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                    id="sample-file-input"
                  />
                  <label
                    htmlFor="sample-file-input"
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      borderRadius: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    Choose File
                  </label>
                </div>
              ) : (
                <div style={{ height: '100%' }}>
                  <DocumentPreview file={sampleFile} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showTesting && formData.templateId && (
        <TemplateTestingPanel
          templateId={formData.templateId}
          documentTypeId={formData.documentTypeId}
          onClose={() => setShowTesting(false)}
        />
      )}
    </div>
  );
}

// Rule Editor Component
interface RuleEditorProps {
  rule: Rule;
  index: number;
  availableFields: any[];
  onRuleChange: (index: number, field: string, value: any) => void;
  onParamChange: (index: number, paramKey: string, paramValue: any) => void;
  onRemove: (index: number) => void;
}

function RuleEditor({
  rule,
  index,
  availableFields,
  onRuleChange,
  onParamChange,
  onRemove,
}: RuleEditorProps) {
  const selectedField = availableFields.find(f => f.fieldId === rule.fieldId);

  return (
    <div style={{
      background: '#f9f9f9',
      padding: '1.5rem',
      borderRadius: '10px',
      border: '1px solid #ddd',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '1rem',
      }}>
        <h4 style={{ margin: 0, color: '#333' }}>Rule {index + 1}</h4>
        <button
          onClick={() => onRemove(index)}
          style={{
            padding: '0.5rem',
            background: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
            Field
          </label>
          <select
            value={rule.fieldId}
            onChange={(e) => onRuleChange(index, 'fieldId', e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '5px',
            }}
          >
            <option value="">Select field...</option>
            {availableFields.map((field) => (
              <option key={field.fieldId} value={field.fieldId}>
                {field.name} ({field.dataType})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
            Extraction Method
          </label>
          <select
            value={rule.method}
            onChange={(e) => onRuleChange(index, 'method', e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '5px',
            }}
          >
            <option value="textract_kv">Textract Key-Value</option>
            <option value="regex">Regular Expression</option>
            <option value="table">Table Extraction</option>
          </select>
        </div>
      </div>

      {/* Method-specific parameters */}
      {rule.method === 'textract_kv' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
              Key Pattern
            </label>
            <input
              type="text"
              value={rule.params.keyPattern || ''}
              onChange={(e) => onParamChange(index, 'keyPattern', e.target.value)}
              placeholder="e.g., invoice number, total, date"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '5px',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
              Min Confidence
            </label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={rule.params.confidence || 0.8}
              onChange={(e) => onParamChange(index, 'confidence', parseFloat(e.target.value))}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '5px',
              }}
            />
          </div>
        </div>
      )}

      {rule.method === 'regex' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
              Regex Pattern
            </label>
            <input
              type="text"
              value={rule.params.pattern || ''}
              onChange={(e) => onParamChange(index, 'pattern', e.target.value)}
              placeholder="e.g., \\d{4}-\\d{2}-\\d{2}"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '5px',
                fontFamily: 'monospace',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
              Capture Group
            </label>
            <input
              type="number"
              min="0"
              value={rule.params.captureGroup || 0}
              onChange={(e) => onParamChange(index, 'captureGroup', parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '5px',
              }}
            />
          </div>
        </div>
      )}

      {rule.method === 'table' && selectedField?.dataType === 'table' && (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
              Table Index (0 = first table)
            </label>
            <input
              type="number"
              min="0"
              value={rule.params.tableIndex || 0}
              onChange={(e) => onParamChange(index, 'tableIndex', parseInt(e.target.value))}
              style={{
                width: '200px',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '5px',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
              Column Mapping (JSON)
            </label>
            <textarea
              value={JSON.stringify(rule.params.columnMapping || {}, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  onParamChange(index, 'columnMapping', parsed);
                } catch (err) {
                  // Invalid JSON, don't update
                }
              }}
              placeholder='{"Column Name": "field_id"}'
              rows={4}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '5px',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
              }}
            />
            <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
              Map table column headers to field IDs
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
