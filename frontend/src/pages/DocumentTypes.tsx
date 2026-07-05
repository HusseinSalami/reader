import { useState, useEffect } from 'react';
import { FileType, Plus, Edit2, Trash2, Loader, CheckCircle, AlertCircle, X, Sparkles } from 'lucide-react';
import { documentTypeApi, DocumentType } from '../services/api';

// Example document types to help users get started
const EXAMPLE_TYPES = [
  {
    name: 'Invoice',
    description: 'Standard business invoice',
    schema: {
      fields: [
        { fieldId: 'invoice_number', name: 'Invoice Number', dataType: 'text' as const, required: true, validationRules: [{ type: 'required', params: {} }] },
        { fieldId: 'invoice_date', name: 'Invoice Date', dataType: 'date' as const, required: true, validationRules: [{ type: 'required', params: {} }, { type: 'dateFormat', params: { format: 'YYYY-MM-DD' } }] },
        { fieldId: 'due_date', name: 'Due Date', dataType: 'date' as const, required: false, validationRules: [{ type: 'dateFormat', params: { format: 'YYYY-MM-DD' } }] },
        { fieldId: 'vendor_name', name: 'Vendor Name', dataType: 'text' as const, required: true, validationRules: [{ type: 'required', params: {} }] },
        { fieldId: 'total_amount', name: 'Total Amount', dataType: 'number' as const, required: true, validationRules: [{ type: 'required', params: {} }, { type: 'min', params: { value: 0 } }] },
        { fieldId: 'tax_amount', name: 'Tax Amount', dataType: 'number' as const, required: false, validationRules: [{ type: 'min', params: { value: 0 } }] },
      ],
    },
  },
  {
    name: 'Receipt',
    description: 'Purchase receipt or proof of payment',
    schema: {
      fields: [
        { fieldId: 'receipt_number', name: 'Receipt Number', dataType: 'text' as const, required: true, validationRules: [{ type: 'required', params: {} }] },
        { fieldId: 'date', name: 'Date', dataType: 'date' as const, required: true, validationRules: [{ type: 'required', params: {} }, { type: 'dateFormat', params: { format: 'YYYY-MM-DD' } }] },
        { fieldId: 'merchant_name', name: 'Merchant Name', dataType: 'text' as const, required: true, validationRules: [{ type: 'required', params: {} }] },
        { fieldId: 'total', name: 'Total', dataType: 'number' as const, required: true, validationRules: [{ type: 'required', params: {} }, { type: 'min', params: { value: 0 } }] },
        { fieldId: 'payment_method', name: 'Payment Method', dataType: 'text' as const, required: false, validationRules: [] },
      ],
    },
  },
  {
    name: 'ID Card',
    description: 'Government-issued identification card',
    schema: {
      fields: [
        { fieldId: 'id_number', name: 'ID Number', dataType: 'text' as const, required: true, validationRules: [{ type: 'required', params: {} }] },
        { fieldId: 'full_name', name: 'Full Name', dataType: 'text' as const, required: true, validationRules: [{ type: 'required', params: {} }] },
        { fieldId: 'date_of_birth', name: 'Date of Birth', dataType: 'date' as const, required: true, validationRules: [{ type: 'required', params: {} }, { type: 'dateFormat', params: { format: 'YYYY-MM-DD' } }] },
        { fieldId: 'expiry_date', name: 'Expiry Date', dataType: 'date' as const, required: false, validationRules: [{ type: 'dateFormat', params: { format: 'YYYY-MM-DD' } }] },
        { fieldId: 'address', name: 'Address', dataType: 'text' as const, required: false, validationRules: [] },
      ],
    },
  },
];

export default function DocumentTypes() {
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [showExampleUpload, setShowExampleUpload] = useState(false);
  const [createdDocTypeForExamples, setCreatedDocTypeForExamples] = useState<DocumentType | null>(null);
  const [editingType, setEditingType] = useState<DocumentType | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    aiEnhanced: boolean;
    fields: Array<{
      fieldId: string;
      name: string;
      dataType: 'text' | 'number' | 'date' | 'boolean' | 'table' | 'array';
      required: boolean;
      validationRules?: Array<{ type: string; params: Record<string, any> }>;
    }>;
  }>({
    name: '',
    description: '',
    aiEnhanced: true,
    fields: [{ fieldId: '', name: '', dataType: 'text', required: false }],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDocumentTypes();
  }, []);

  const loadDocumentTypes = async () => {
    try {
      const result = await documentTypeApi.list();
      setDocumentTypes(result.items || []);
    } catch (err) {
      console.error('Failed to load document types:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFromExample = (example: typeof EXAMPLE_TYPES[0]) => {
    setFormData({
      name: example.name,
      description: example.description,
      aiEnhanced: true,
      fields: example.schema.fields,
    });
    setShowExamples(false);
    setShowCreateModal(true);
  };

  const handleAddField = () => {
    setFormData({
      ...formData,
      fields: [...formData.fields, { fieldId: '', name: '', dataType: 'text', required: false }],
    });
  };

  const handleRemoveField = (index: number) => {
    setFormData({
      ...formData,
      fields: formData.fields.filter((_, i) => i !== index),
    });
  };

  const handleFieldChange = (index: number, field: string, value: any) => {
    const newFields = [...formData.fields];
    newFields[index] = { ...newFields[index], [field]: value };
    setFormData({ ...formData, fields: newFields });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const schema = {
        fields: formData.fields.map(f => ({
          ...f,
          validationRules: f.required ? [{ type: 'required', params: {} }] : [],
        })),
      };

      if (editingType) {
        await documentTypeApi.update(editingType.documentTypeId, {
          name: formData.name,
          description: formData.description,
          schema,
        });
        
        setShowCreateModal(false);
        setEditingType(null);
        setFormData({ 
          name: '', 
          description: '', 
          aiEnhanced: true,
          fields: [{ fieldId: '', name: '', dataType: 'text', required: false }] 
        });
        await loadDocumentTypes();
      } else {
        // Creating new document type
        const newDocType = await documentTypeApi.create({
          name: formData.name,
          description: formData.description,
          schema,
          aiEnhanced: false, // Don't auto-create template yet
        });

        console.log('Document type created:', newDocType);
        console.log('AI Enhanced?', formData.aiEnhanced);

        setShowCreateModal(false);
        
        // If AI Enhanced, prompt for example documents
        if (formData.aiEnhanced) {
          console.log('Showing example upload modal');
          setCreatedDocTypeForExamples(newDocType);
          setShowExampleUpload(true);
        } else {
          console.log('Skipping example upload');
          // Reset form and reload
          setFormData({ 
            name: '', 
            description: '', 
            aiEnhanced: true,
            fields: [{ fieldId: '', name: '', dataType: 'text', required: false }] 
          });
          await loadDocumentTypes();
        }
      }
    } catch (err: any) {
      console.error('Error saving document type:', err);
      console.error('Error response:', err.response);
      setError(err.response?.data?.error?.message || err.message || 'Failed to save document type');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (type: DocumentType) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      description: type.description,
      aiEnhanced: false, // Not used when editing (show button instead)
      fields: type.schema.fields,
    });
    setShowCreateModal(true);
  };

  const handleEnhanceWithAI = (type: DocumentType) => {
    // Set the document type for AI enhancement and show example upload
    setCreatedDocTypeForExamples(type);
    setShowExampleUpload(true);
  };

  const handleSkipExamples = async () => {
    if (!confirm('Skip example upload?\n\nA basic template will be created, but it won\'t be trained on your specific documents. You can add examples later from the Templates page.')) {
      return;
    }
    
    // Create basic template
    if (createdDocTypeForExamples) {
      try {
        const templateService = await import('../services/api');
        const defaultRules = createdDocTypeForExamples.schema.fields.map((field) => ({
          ruleId: `rule-${field.fieldId}`,
          fieldId: field.fieldId,
          method: 'textract_kv' as const,
          params: {
            keywords: [field.name, field.fieldId],
            confidence: 0.8
          }
        }));

        await templateService.templateApi.create({
          documentTypeId: createdDocTypeForExamples.documentTypeId,
          name: `${createdDocTypeForExamples.name} - Default Template`,
          description: `Auto-generated template for ${createdDocTypeForExamples.name}`,
          rules: defaultRules,
          aiEnhanced: true
        });
      } catch (err) {
        console.error('Failed to create basic template:', err);
      }
    }
    
    setShowExampleUpload(false);
    setCreatedDocTypeForExamples(null);
    setFormData({ 
      name: '', 
      description: '', 
      aiEnhanced: true,
      fields: [{ fieldId: '', name: '', dataType: 'text', required: false }] 
    });
    await loadDocumentTypes();
  };

  const handleDelete = async (type: DocumentType) => {
    if (!confirm(`Are you sure you want to delete "${type.name}"? This cannot be undone.`)) return;

    try {
      await documentTypeApi.delete(type.documentTypeId);
      loadDocumentTypes();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to delete document type');
    }
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
          <h1 style={{ fontSize: '2.5rem', color: '#333', marginBottom: '0.5rem' }}>Document Types</h1>
          <p style={{ color: '#666' }}>Define the structure and fields for your documents</p>
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
            <FileType size={20} />
            Use Example
          </button>
          <button
            onClick={() => {
              setEditingType(null);
              setFormData({ 
                name: '', 
                description: '', 
                aiEnhanced: true,
                fields: [{ fieldId: '', name: '', dataType: 'text', required: false }] 
              });
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
          <p style={{ marginTop: '1rem', color: '#666' }}>Loading document types...</p>
        </div>
      ) : documentTypes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <FileType size={64} style={{ color: '#ccc', margin: '0 auto 1rem' }} />
          <p style={{ fontSize: '1.25rem', color: '#666', marginBottom: '1rem' }}>No document types yet</p>
          <p style={{ color: '#999', marginBottom: '2rem' }}>Create your first document type or use an example to get started</p>
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
          {documentTypes.map((type) => (
            <div
              key={type.documentTypeId}
              style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '15px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#333' }}>{type.name}</h3>
                  <p style={{ color: '#666', marginBottom: '1rem' }}>{type.description}</p>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {type.schema.fields.map((field) => (
                      <span
                        key={field.fieldId}
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: '#f0f0f0',
                          borderRadius: '15px',
                          fontSize: '0.9rem',
                          color: '#666',
                        }}
                      >
                        {field.name} ({field.dataType}){field.required && ' *'}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleEnhanceWithAI(type)}
                    title="Create AI-enhanced template"
                    style={{
                      padding: '0.5rem',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <Sparkles size={16} />
                  </button>
                  <button
                    onClick={() => handleEdit(type)}
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
                    onClick={() => handleDelete(type)}
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
              <h2 style={{ fontSize: '2rem', color: '#333' }}>Example Document Types</h2>
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
              {EXAMPLE_TYPES.map((example, index) => (
                <div
                  key={index}
                  style={{
                    border: '2px solid #eee',
                    borderRadius: '10px',
                    padding: '1.5rem',
                  }}
                >
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#333' }}>{example.name}</h3>
                  <p style={{ color: '#666', marginBottom: '1rem' }}>{example.description}</p>
                  <div style={{ marginBottom: '1rem' }}>
                    <strong style={{ color: '#333' }}>Fields:</strong>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                      {example.schema.fields.map((field) => (
                        <span
                          key={field.fieldId}
                          style={{
                            padding: '0.25rem 0.75rem',
                            background: '#f0f0f0',
                            borderRadius: '15px',
                            fontSize: '0.85rem',
                          }}
                        >
                          {field.name} ({field.dataType}){field.required && ' *'}
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

      {/* Create/Edit Modal */}
      {showCreateModal && (
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
              <h2 style={{ fontSize: '2rem', color: '#333' }}>
                {editingType ? 'Edit Document Type' : 'Create Document Type'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingType(null);
                  setError(null);
                }}
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

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#333' }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #ddd',
                    borderRadius: '10px',
                    fontSize: '1rem',
                  }}
                  placeholder="e.g., Invoice, Receipt, ID Card"
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#333' }}>
                  Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #ddd',
                    borderRadius: '10px',
                    fontSize: '1rem',
                    fontFamily: 'inherit',
                  }}
                  placeholder="Brief description of this document type"
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <label style={{ fontWeight: 'bold', color: '#333' }}>Fields *</label>
                  <button
                    type="button"
                    onClick={handleAddField}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <Plus size={16} />
                    Add Field
                  </button>
                </div>

                {formData.fields.map((field, index) => (
                  <div key={index} style={{
                    border: '2px solid #eee',
                    borderRadius: '10px',
                    padding: '1rem',
                    marginBottom: '1rem',
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                          Field ID *
                        </label>
                        <input
                          type="text"
                          value={field.fieldId}
                          onChange={(e) => handleFieldChange(index, 'fieldId', e.target.value)}
                          required
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            border: '1px solid #ddd',
                            borderRadius: '5px',
                            fontSize: '0.9rem',
                          }}
                          placeholder="e.g., invoice_number"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                          Display Name *
                        </label>
                        <input
                          type="text"
                          value={field.name}
                          onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                          required
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            border: '1px solid #ddd',
                            borderRadius: '5px',
                            fontSize: '0.9rem',
                          }}
                          placeholder="e.g., Invoice Number"
                        />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                          Data Type *
                        </label>
                        <select
                          value={field.dataType}
                          onChange={(e) => handleFieldChange(index, 'dataType', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            border: '1px solid #ddd',
                            borderRadius: '5px',
                            fontSize: '0.9rem',
                          }}
                        >
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                          <option value="date">Date</option>
                          <option value="boolean">Boolean</option>
                          <option value="table">Table</option>
                          <option value="array">Array</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => handleFieldChange(index, 'required', e.target.checked)}
                          />
                          <span style={{ fontSize: '0.9rem', color: '#666' }}>Required</span>
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveField(index)}
                        disabled={formData.fields.length === 1}
                        style={{
                          padding: '0.5rem',
                          background: formData.fields.length === 1 ? '#ccc' : '#f44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '5px',
                          cursor: formData.fields.length === 1 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {!editingType && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    gap: '1rem',
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%)',
                    borderRadius: '15px',
                    cursor: 'pointer',
                    border: '2px solid #e0e7ff',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#667eea';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e0e7ff';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.aiEnhanced}
                      onChange={(e) => setFormData({ ...formData, aiEnhanced: e.target.checked })}
                      style={{
                        width: '20px',
                        height: '20px',
                        marginTop: '2px',
                        cursor: 'pointer',
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <strong style={{ fontSize: '1.1rem', color: '#333' }}>🤖 Enable AI-Enhanced Extraction</strong>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          background: '#667eea',
                          color: 'white',
                          borderRadius: '5px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                        }}>
                          RECOMMENDED
                        </span>
                      </div>
                      <p style={{ fontSize: '0.95rem', color: '#666', margin: 0, lineHeight: '1.5' }}>
                        Uses Claude AI to intelligently extract fields with higher accuracy. A default template will be automatically created for this document type.
                      </p>
                      <p style={{ fontSize: '0.85rem', color: '#999', margin: '0.5rem 0 0 0', fontStyle: 'italic' }}>
                        You can create additional templates later for different extraction strategies.
                      </p>
                    </div>
                  </label>
                </div>
              )}

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

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingType(null);
                    setError(null);
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'white',
                    color: '#666',
                    border: '2px solid #ddd',
                    borderRadius: '10px',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: saving ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  {saving ? (
                    <>
                      <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={20} />
                      {editingType ? 'Update' : 'Create'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Template Generator for Examples */}
      {showExampleUpload && createdDocTypeForExamples && (
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
          zIndex: 1001,
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '2rem',
            maxWidth: '600px',
            width: '90%',
          }}>
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem', color: '#333', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={28} style={{ color: '#667eea' }} />
                AI-Enhanced Template
              </h2>
              <p style={{ color: '#666', marginBottom: '1rem' }}>
                Create an AI-enhanced template for <strong>{createdDocTypeForExamples.name}</strong>
              </p>
              <p style={{ color: '#666', marginBottom: '1rem' }}>
                Upload 1-3 example documents and let AI analyze them to create smart extraction rules.
              </p>
              <div style={{
                background: '#e3f2fd',
                border: '1px solid #2196f3',
                borderRadius: '10px',
                padding: '1rem',
                fontSize: '0.9rem',
                color: '#1565c0',
              }}>
                <strong>💡 Best Results:</strong> Upload diverse examples with different formats and layouts. The AI will learn patterns from all of them.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={handleSkipExamples}
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
                Create Basic Template
              </button>
              <button
                onClick={() => {
                  setShowExampleUpload(false);
                  // Navigate to Templates page with AI generator
                  window.location.href = '/templates?generate=true&docType=' + createdDocTypeForExamples.documentTypeId;
                }}
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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                <Sparkles size={20} />
                Upload Examples
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
