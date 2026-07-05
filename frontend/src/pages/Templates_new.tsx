import { useState, useEffect } from 'react';
import { FileCode, Plus, Edit2, Trash2, Loader, X } from 'lucide-react';
import { templateApi, documentTypeApi, Template, DocumentType } from '../services/api';

// Example templates to help users get started
const EXAMPLE_TEMPLATES = [
  {
    name: 'Standard Invoice Template',
    description: 'Extract key fields from standard invoices',
    documentTypeName: 'Invoice',
    rules: [
      {
        fieldId: 'invoice_number',
        method: 'textract_kv' as const,
        params: { keyPattern: 'invoice number', confidence: 0.8 },
      },
      {
        fieldId: 'total_amount',
        method: 'textract_kv' as const,
        params: { keyPattern: 'total', confidence: 0.8 },
      },
      {
        fieldId: 'invoice_date',
        method: 'regex' as const,
        params: { pattern: '\\d{4}-\\d{2}-\\d{2}', captureGroup: 0 },
      },
    ],
    aiEnhanced: true,
  },
  {
    name: 'Receipt Scanner',
    description: 'Extract data from purchase receipts',
    documentTypeName: 'Receipt',
    rules: [
      {
        fieldId: 'receipt_number',
        method: 'textract_kv' as const,
        params: { keyPattern: 'receipt', confidence: 0.7 },
      },
      {
        fieldId: 'merchant_name',
        method: 'textract_kv' as const,
        params: { keyPattern: 'merchant|store', confidence: 0.7 },
      },
      {
        fieldId: 'total',
        method: 'textract_kv' as const,
        params: { keyPattern: 'total', confidence: 0.8 },
      },
      {
        fieldId: 'date',
        method: 'regex' as const,
        params: { pattern: '\\d{2}/\\d{2}/\\d{4}', captureGroup: 0 },
      },
    ],
    aiEnhanced: true,
  },
  {
    name: 'ID Card Reader',
    description: 'Extract information from ID cards',
    documentTypeName: 'ID Card',
    rules: [
      {
        fieldId: 'id_number',
        method: 'textract_kv' as const,
        params: { keyPattern: 'id number|identification', confidence: 0.9 },
      },
      {
        fieldId: 'full_name',
        method: 'textract_kv' as const,
        params: { keyPattern: 'name', confidence: 0.9 },
      },
      {
        fieldId: 'date_of_birth',
        method: 'regex' as const,
        params: { pattern: '\\d{4}-\\d{2}-\\d{2}', captureGroup: 0 },
      },
    ],
    aiEnhanced: false,
  },
  {
    name: 'Invoice with Line Items',
    description: 'Extract invoice header and line items table',
    documentTypeName: 'Invoice',
    rules: [
      {
        fieldId: 'invoice_number',
        method: 'textract_kv' as const,
        params: { keyPattern: 'invoice number', confidence: 0.8 },
      },
      {
        fieldId: 'line_items',
        method: 'table' as const,
        params: {
          tableIndex: 0,
          columnMapping: {
            'Product': 'product_name',
            'Quantity': 'quantity',
            'Price': 'unit_price',
            'Total': 'total',
          },
        },
      },
    ],
    aiEnhanced: true,
  },
];

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [_showCreateModal, setShowCreateModal] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  // const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  // const [formData, setFormData] = useState<{
  //   name: string;
  //   description: string;
  //   documentTypeId: string;
  //   rules: Array<{
  //     ruleId?: string;
  //     fieldId: string;
  //     method: 'textract_kv' | 'regex' | 'table';
  //     params: Record<string, any>;
  //   }>;
  //   aiEnhanced: boolean;
  // }>({
  //   name: '',
  //   description: '',
  //   documentTypeId: '',
  //   rules: [{ fieldId: '', method: 'textract_kv', params: {} }],
  //   aiEnhanced: true,
  // });
  // const [saving, setSaving] = useState(false);
  // const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [templatesResult, docTypesResult] = await Promise.all([
        templateApi.list(),
        documentTypeApi.list(),
      ]);
      setTemplates(templatesResult.items || []);
      setDocumentTypes(docTypesResult.items || []);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFromExample = (_example: typeof EXAMPLE_TEMPLATES[0]) => {
    // const docType = documentTypes.find(dt => dt.name === example.documentTypeName);
    // if (!docType) {
    //   alert(`Please create a "${example.documentTypeName}" document type first`);
    //   return;
    // }
    
    // setFormData({
    //   name: example.name,
    //   description: example.description,
    //   documentTypeId: docType.documentTypeId,
    //   rules: example.rules.map((rule, idx) => ({ ...rule, ruleId: `rule-${idx}` })),
    //   aiEnhanced: example.aiEnhanced,
    // });
    setShowExamples(false);
    setShowCreateModal(true);
  };

  // const handleAddRule = () => {
  //   setFormData({
  //     ...formData,
  //     rules: [...formData.rules, { fieldId: '', method: 'textract_kv', params: {} }],
  //   });
  // };

  // const handleRemoveRule = (index: number) => {
  //   setFormData({
  //     ...formData,
  //     rules: formData.rules.filter((_, i) => i !== index),
  //   });
  // };

  // const handleRuleChange = (index: number, field: string, value: any) => {
  //   const newRules = [...formData.rules];
  //   newRules[index] = { ...newRules[index], [field]: value };
  //   setFormData({ ...formData, rules: newRules });
  // };

  // const handleSubmit = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   setError(null);
  //   setSaving(true);

  //   try {
  //     const payload = {
  //       name: formData.name,
  //       description: formData.description,
  //       documentTypeId: formData.documentTypeId,
  //       rules: formData.rules.map((rule, idx) => ({
  //         ruleId: rule.ruleId || `rule-${idx}`,
  //         fieldId: rule.fieldId,
  //         method: rule.method,
  //         params: rule.params,
  //       })),
  //       aiEnhanced: formData.aiEnhanced,
  //     };

  //     if (editingTemplate) {
  //       await templateApi.update(editingTemplate.templateId, payload);
  //     } else {
  //       await templateApi.create(payload);
  //     }

  //     // Success! Close modal and reset form
  //     setShowCreateModal(false);
  //     setEditingTemplate(null);
  //     setFormData({
  //       name: '',
  //       description: '',
  //       documentTypeId: '',
  //       rules: [{ fieldId: '', method: 'textract_kv', params: {} }],
  //       aiEnhanced: true,
  //     });
      
  //     // Reload list (don't let this error affect the success state)
  //     try {
  //       await loadData();
  //     } catch (listErr) {
  //       console.error('Failed to reload list after save:', listErr);
  //       // List reload failed, but the save succeeded - just log it
  //     }
  //   } catch (err: any) {
  //     setError(err.response?.data?.error?.message || 'Failed to save template');
  //   } finally {
  //     setSaving(false);
  //   }
  // };

  const handleEdit = (_template: Template) => {
    // setEditingTemplate(template);
    // setFormData({
    //   name: template.name,
    //   description: template.description || '',
    //   documentTypeId: template.documentTypeId,
    //   rules: template.rules,
    //   aiEnhanced: template.aiEnhanced,
    // });
    setShowCreateModal(true);
  };

  const handleDelete = async (template: Template) => {
    if (!confirm(`Are you sure you want to delete "${template.name}"? This cannot be undone.`)) return;

    try {
      await templateApi.delete(template.templateId);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to delete template');
    }
  };

  const getDocumentTypeName = (documentTypeId: string) => {
    const docType = documentTypes.find(dt => dt.documentTypeId === documentTypeId);
    return docType?.name || 'Unknown';
  };

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '20px',
      padding: '3rem',
      boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', color: '#333', marginBottom: '0.5rem' }}>Templates</h1>
          <p style={{ color: '#666' }}>Define extraction rules for your document types</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => setShowExamples(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'white',
              color: '#667eea',
              border: '2px solid #667eea',
              borderRadius: '10px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <FileCode size={20} />
            Use Example
          </button>
          <button
            onClick={() => {
              // setEditingTemplate(null);
              // setFormData({
              //   name: '',
              //   description: '',
              //   documentTypeId: '',
              //   rules: [{ fieldId: '', method: 'textract_kv', params: {} }],
              //   aiEnhanced: true,
              // });
              setShowCreateModal(true);
            }}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Plus size={20} />
            Create New
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader size={48} style={{ color: '#667eea', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          <p style={{ marginTop: '1rem', color: '#666' }}>Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <FileCode size={64} style={{ color: '#ccc', margin: '0 auto 1rem' }} />
          <p style={{ fontSize: '1.25rem', color: '#666', marginBottom: '1rem' }}>No templates yet</p>
          <p style={{ color: '#999', marginBottom: '2rem' }}>Create your first template or use an example to get started</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              onClick={() => setShowExamples(true)}
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
              Browse Examples
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
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
              Create From Scratch
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {templates.map((template) => (
            <div
              key={template.templateId}
              style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '15px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.5rem', color: '#333' }}>{template.name}</h3>
                    {template.aiEnhanced && (
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        borderRadius: '15px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                      }}>
                        AI Enhanced
                      </span>
                    )}
                  </div>
                  <p style={{ color: '#666', marginBottom: '0.5rem' }}>{template.description}</p>
                  <p style={{ color: '#999', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    Document Type: {getDocumentTypeName(template.documentTypeId)}
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {template.rules.map((rule) => (
                      <span
                        key={rule.ruleId}
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: '#f0f0f0',
                          borderRadius: '15px',
                          fontSize: '0.85rem',
                          color: '#666',
                        }}
                      >
                        {rule.fieldId} ({rule.method})
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleEdit(template)}
                    style={{
                      padding: '0.5rem',
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                    }}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(template)}
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
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Examples Modal */}
      {showExamples && (
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
            maxHeight: '80vh',
            overflow: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '2rem', color: '#333' }}>Example Templates</h2>
              <button
                onClick={() => setShowExamples(false)}
                style={{
                  padding: '0.5rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#666',
                }}
              >
                <X size={24} />
              </button>
            </div>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {EXAMPLE_TEMPLATES.map((example, index) => (
                <div
                  key={index}
                  style={{
                    border: '2px solid #eee',
                    borderRadius: '10px',
                    padding: '1.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', color: '#333' }}>{example.name}</h3>
                    {example.aiEnhanced && (
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        borderRadius: '10px',
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                      }}>
                        AI
                      </span>
                    )}
                  </div>
                  <p style={{ color: '#666', marginBottom: '0.5rem' }}>{example.description}</p>
                  <p style={{ color: '#999', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    For: {example.documentTypeName}
                  </p>
                  <div style={{ marginBottom: '1rem' }}>
                    <strong style={{ color: '#333', fontSize: '0.9rem' }}>Extraction Rules:</strong>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                      {example.rules.map((rule, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: '0.25rem 0.75rem',
                            background: '#f0f0f0',
                            borderRadius: '15px',
                            fontSize: '0.8rem',
                          }}
                        >
                          {rule.fieldId} ({rule.method})
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCreateFromExample(example)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                    }}
                  >
                    Use This Template
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
