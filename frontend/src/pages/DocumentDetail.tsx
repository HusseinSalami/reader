import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, CheckCircle, AlertCircle, Edit2, Check, X, Table, FileJson } from 'lucide-react';
import { documentApi, Document } from '../services/api';

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'extracted' | 'validation' | 'metadata'>('extracted');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>('');
  const [saving, setSaving] = useState(false);
  const [editingTableCell, setEditingTableCell] = useState<{ fieldId: string; rowIndex: number; columnKey: string } | null>(null);
  const [tableCellValue, setTableCellValue] = useState<string>('');
  const [fieldViewMode, setFieldViewMode] = useState<Record<string, 'table' | 'json'>>({});

  useEffect(() => {
    if (id) {
      loadDocument();
      // Poll for updates if processing
      const interval = setInterval(() => {
        if (document?.status === 'processing') {
          loadDocument();
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [id, document?.status]);

  const loadDocument = async () => {
    if (!id) return;
    setLoading(false); // Only show loading on first load
    try {
      const data = await documentApi.get(id);
      setDocument(data);
    } catch (error) {
      console.error('Failed to load document:', error);
    }
  };

  const handleEditField = (fieldId: string, currentValue: any) => {
    setEditingField(fieldId);
    setEditValue(currentValue);
  };

  const handleSaveField = async (fieldId: string) => {
    if (!document || !document.extractedData) return;
    
    setSaving(true);
    try {
      const updatedData = {
        ...document.extractedData,
        fields: {
          ...document.extractedData.fields,
          [fieldId]: {
            ...document.extractedData.fields[fieldId],
            value: editValue,
            corrected: true,
            source: 'manual' as const,
          },
        },
      };

      const updated = await documentApi.review(document.documentId, updatedData);
      setDocument(updated);
      setEditingField(null);
    } catch (error) {
      console.error('Failed to save field:', error);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleEditTableCell = (fieldId: string, rowIndex: number, columnKey: string, currentValue: any) => {
    setEditingTableCell({ fieldId, rowIndex, columnKey });
    setTableCellValue(String(currentValue));
  };

  const handleSaveTableCell = async () => {
    if (!editingTableCell || !document || !document.extractedData) return;
    
    const { fieldId, rowIndex, columnKey } = editingTableCell;
    const field = document.extractedData.fields[fieldId];
    
    if (!Array.isArray(field.value)) return;
    
    setSaving(true);
    try {
      const updatedArray = [...field.value];
      updatedArray[rowIndex] = {
        ...updatedArray[rowIndex],
        [columnKey]: tableCellValue,
      };

      const updatedData = {
        ...document.extractedData,
        fields: {
          ...document.extractedData.fields,
          [fieldId]: {
            ...field,
            value: updatedArray,
            corrected: true,
            source: 'manual' as const,
          },
        },
      };

      const updated = await documentApi.review(document.documentId, updatedData);
      setDocument(updated);
      setEditingTableCell(null);
    } catch (error) {
      console.error('Failed to save table cell:', error);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const toggleFieldViewMode = (fieldId: string) => {
    setFieldViewMode(prev => ({
      ...prev,
      [fieldId]: prev[fieldId] === 'json' ? 'table' : 'json',
    }));
  };

  const getFieldViewMode = (fieldId: string): 'table' | 'json' => {
    return fieldViewMode[fieldId] || 'table'; // Default to table view
  };

  const handleExportTableToCSV = (fieldId: string, tableData: any[]) => {
    if (!Array.isArray(tableData) || tableData.length === 0) return;
    
    // Get headers from first row
    const headers = Object.keys(tableData[0]);
    
    // Create CSV content
    const csvRows = [
      headers.join(','), // Header row
      ...tableData.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape values that contain commas or quotes
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      )
    ];
    
    const csvContent = csvRows.join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = window.document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${fieldId}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  const handleApprove = async () => {
    if (!document) return;
    
    if (!confirm('Are you sure you want to approve this document?')) return;
    
    try {
      const updated = await documentApi.approve(document.documentId);
      setDocument(updated);
      alert('Document approved successfully!');
    } catch (error) {
      console.error('Failed to approve document:', error);
      alert('Failed to approve document');
    }
  };

  const handleReject = async () => {
    if (!document) return;
    
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;
    
    try {
      const updated = await documentApi.reject(document.documentId, reason);
      setDocument(updated);
      alert('Document rejected');
    } catch (error) {
      console.error('Failed to reject document:', error);
      alert('Failed to reject document');
    }
  };

  if (loading) {
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '20px',
        padding: '3rem',
        textAlign: 'center',
      }}>
        <p>Loading document...</p>
      </div>
    );
  }

  if (!document) {
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '20px',
        padding: '3rem',
        textAlign: 'center',
      }}>
        <AlertCircle size={64} style={{ color: '#f44336', margin: '0 auto 1rem' }} />
        <h2>Document not found</h2>
        <Link to="/documents" style={{
          display: 'inline-block',
          marginTop: '1rem',
          padding: '0.75rem 1.5rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '10px',
        }}>
          Back to Documents
        </Link>
      </div>
    );
  }

  const statusColors = {
    pending: '#ff9800',
    processing: '#2196f3',
    completed: '#4caf50',
    failed: '#f44336',
    needs_review: '#ff9800',
  };

  const statusColor = statusColors[document.status] || '#999';

  return (
    <div>
      <Link to="/documents" style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '1rem',
        color: 'white',
        textDecoration: 'none',
        fontSize: '1.1rem',
      }}>
        <ArrowLeft size={20} />
        Back to Documents
      </Link>

      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '20px',
        padding: '3rem',
        boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#333' }}>
              {document.filename || document.fileName}
            </h1>
            <div style={{ display: 'flex', gap: '2rem', color: '#666', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={16} />
                {new Date(document.uploadedAt).toLocaleString()}
              </div>
              {document.processedAt && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={16} />
                  Processed: {new Date(document.processedAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          background: `${statusColor}20`,
          borderRadius: '20px',
          marginBottom: '2rem',
        }}>
          {document.status === 'completed' ? (
            <CheckCircle size={20} color={statusColor} />
          ) : (
            <AlertCircle size={20} color={statusColor} />
          )}
          <span style={{ fontWeight: 'bold', color: statusColor, textTransform: 'capitalize' }}>
            {document.status}
          </span>
        </div>

        {document.status === 'processing' && (
          <div style={{
            background: '#e3f2fd',
            padding: '1rem',
            borderRadius: '10px',
            marginBottom: '2rem',
            textAlign: 'center',
          }}>
            <p style={{ color: '#1976d2', margin: 0 }}>
              Document is being processed... This page will update automatically.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '2px solid #eee' }}>
          {['extracted', 'validation', 'metadata'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              style={{
                padding: '1rem 2rem',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab ? '3px solid #667eea' : 'none',
                color: activeTab === tab ? '#667eea' : '#666',
                fontWeight: activeTab === tab ? 'bold' : 'normal',
                fontSize: '1.1rem',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {tab === 'extracted' && 'Extracted Data'}
              {tab === 'validation' && `Validation ${document.validationErrors?.length ? `(${document.validationErrors.length})` : ''}`}
              {tab === 'metadata' && 'Metadata'}
            </button>
          ))}
        </div>

        {activeTab === 'extracted' && (
          <div>
            {document.extractedData?.fields && Object.keys(document.extractedData.fields).length > 0 ? (
              <>
                <div style={{ marginBottom: '2rem' }}>
                  {Object.entries(document.extractedData.fields).map(([fieldId, field]) => (
                    <div key={fieldId} style={{
                      background: field.needsReview ? '#fff3e0' : '#f9f9f9',
                      padding: '1.5rem',
                      borderRadius: '10px',
                      marginBottom: '1rem',
                      border: field.needsReview ? '2px solid #ff9800' : 'none',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <strong style={{ fontSize: '1.1rem', color: '#333' }}>{fieldId}</strong>
                            {field.corrected && (
                              <span style={{
                                background: '#4caf50',
                                color: 'white',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '5px',
                                fontSize: '0.75rem',
                              }}>
                                Corrected
                              </span>
                            )}
                            {field.needsReview && (
                              <span style={{
                                background: '#ff9800',
                                color: 'white',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '5px',
                                fontSize: '0.75rem',
                              }}>
                                Needs Review
                              </span>
                            )}
                          </div>
                          {editingField === fieldId ? (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                style={{
                                  flex: 1,
                                  padding: '0.5rem',
                                  border: '2px solid #667eea',
                                  borderRadius: '5px',
                                  fontSize: '1rem',
                                }}
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveField(fieldId)}
                                disabled={saving}
                                style={{
                                  padding: '0.5rem',
                                  background: '#4caf50',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '5px',
                                  cursor: 'pointer',
                                }}
                              >
                                <Check size={20} />
                              </button>
                              <button
                                onClick={() => setEditingField(null)}
                                style={{
                                  padding: '0.5rem',
                                  background: '#f44336',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '5px',
                                  cursor: 'pointer',
                                }}
                              >
                                <X size={20} />
                              </button>
                            </div>
                          ) : (
                            <div style={{ fontSize: '1.2rem', color: '#333', marginBottom: '0.5rem' }}>
                              {field.value && Array.isArray(field.value.value) ? (
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.9rem', color: '#666' }}>
                                      {field.value.value.length} row{field.value.value.length !== 1 ? 's' : ''}
                                    </span>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <button
                                        onClick={() => toggleFieldViewMode(fieldId)}
                                        style={{
                                          padding: '0.5rem 1rem',
                                          background: '#667eea',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '5px',
                                          fontSize: '0.9rem',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.5rem',
                                        }}
                                        title={getFieldViewMode(fieldId) === 'table' ? 'Switch to JSON view' : 'Switch to table view'}
                                      >
                                        {getFieldViewMode(fieldId) === 'table' ? (
                                          <>
                                            <FileJson size={16} />
                                            JSON
                                          </>
                                        ) : (
                                          <>
                                            <Table size={16} />
                                            Table
                                          </>
                                        )}
                                      </button>
                                      {getFieldViewMode(fieldId) === 'table' && (
                                        <button
                                          onClick={() => handleExportTableToCSV(fieldId, field.value.value)}
                                          style={{
                                            padding: '0.5rem 1rem',
                                            background: '#4caf50',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '5px',
                                            fontSize: '0.9rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                          }}
                                        >
                                          📥 Export CSV
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  {getFieldViewMode(fieldId) === 'table' ? (
                                    <div style={{ overflowX: 'auto' }}>
                                      <table style={{
                                        width: '100%',
                                        borderCollapse: 'collapse',
                                        marginTop: '0.5rem',
                                        background: 'white',
                                        border: '1px solid #ddd',
                                      }}>
                                        <thead>
                                          <tr style={{ background: '#f5f5f5' }}>
                                            {field.value.value.length > 0 && Object.keys(field.value.value[0]).map((key) => (
                                              <th key={key} style={{
                                                padding: '0.75rem',
                                                textAlign: 'left',
                                                borderBottom: '2px solid #ddd',
                                                fontWeight: 'bold',
                                                color: '#333',
                                              }}>
                                                {key}
                                              </th>
                                            ))}
                                            <th style={{
                                              padding: '0.75rem',
                                              textAlign: 'center',
                                              borderBottom: '2px solid #ddd',
                                              fontWeight: 'bold',
                                              color: '#333',
                                              width: '80px',
                                            }}>
                                              Actions
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {field.value.value.map((row: any, rowIndex: number) => (
                                            <tr key={rowIndex} style={{
                                              background: rowIndex % 2 === 0 ? 'white' : '#fafafa',
                                            }}>
                                              {Object.entries(row).map(([columnKey, cell], cellIndex) => {
                                                const isEditing = editingTableCell?.fieldId === fieldId && 
                                                                 editingTableCell?.rowIndex === rowIndex && 
                                                                 editingTableCell?.columnKey === columnKey;
                                                
                                                return (
                                                  <td key={cellIndex} style={{
                                                    padding: '0.75rem',
                                                    borderBottom: '1px solid #eee',
                                                    color: '#333',
                                                  }}>
                                                    {isEditing ? (
                                                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                        <input
                                                          type="text"
                                                          value={tableCellValue}
                                                          onChange={(e) => setTableCellValue(e.target.value)}
                                                          style={{
                                                            flex: 1,
                                                            padding: '0.25rem',
                                                            border: '2px solid #667eea',
                                                            borderRadius: '3px',
                                                            fontSize: '0.9rem',
                                                          }}
                                                          autoFocus
                                                          onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleSaveTableCell();
                                                            if (e.key === 'Escape') setEditingTableCell(null);
                                                          }}
                                                        />
                                                        <button
                                                          onClick={handleSaveTableCell}
                                                          disabled={saving}
                                                          style={{
                                                            padding: '0.25rem',
                                                            background: '#4caf50',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '3px',
                                                            cursor: 'pointer',
                                                          }}
                                                        >
                                                          <Check size={16} />
                                                        </button>
                                                        <button
                                                          onClick={() => setEditingTableCell(null)}
                                                          style={{
                                                            padding: '0.25rem',
                                                            background: '#f44336',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '3px',
                                                            cursor: 'pointer',
                                                          }}
                                                        >
                                                          <X size={16} />
                                                        </button>
                                                      </div>
                                                    ) : (
                                                      <div 
                                                        onClick={() => handleEditTableCell(fieldId, rowIndex, columnKey, cell)}
                                                        style={{ cursor: 'pointer' }}
                                                        title="Click to edit"
                                                      >
                                                        {typeof cell === 'object' ? JSON.stringify(cell) : String(cell)}
                                                      </div>
                                                    )}
                                                  </td>
                                                );
                                              })}
                                              <td style={{
                                                padding: '0.75rem',
                                                borderBottom: '1px solid #eee',
                                                textAlign: 'center',
                                              }}>
                                                <button
                                                  onClick={() => {
                                                    const firstKey = Object.keys(row)[0];
                                                    handleEditTableCell(fieldId, rowIndex, firstKey, row[firstKey]);
                                                  }}
                                                  style={{
                                                    padding: '0.25rem 0.5rem',
                                                    background: '#667eea',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '3px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.8rem',
                                                  }}
                                                >
                                                  <Edit2 size={14} />
                                                </button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <pre style={{
                                      background: 'white',
                                      padding: '1rem',
                                      borderRadius: '5px',
                                      fontSize: '0.9rem',
                                      overflow: 'auto',
                                      border: '1px solid #ddd',
                                      maxHeight: '400px',
                                    }}>
                                      {JSON.stringify(field.value.value, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              ) : field.value && Array.isArray(field.value) ? (
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.9rem', color: '#666' }}>
                                      {field.value.length} row{field.value.length !== 1 ? 's' : ''}
                                    </span>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <button
                                        onClick={() => toggleFieldViewMode(fieldId)}
                                        style={{
                                          padding: '0.5rem 1rem',
                                          background: '#667eea',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '5px',
                                          fontSize: '0.9rem',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.5rem',
                                        }}
                                        title={getFieldViewMode(fieldId) === 'table' ? 'Switch to JSON view' : 'Switch to table view'}
                                      >
                                        {getFieldViewMode(fieldId) === 'table' ? (
                                          <>
                                            <FileJson size={16} />
                                            JSON
                                          </>
                                        ) : (
                                          <>
                                            <Table size={16} />
                                            Table
                                          </>
                                        )}
                                      </button>
                                      {getFieldViewMode(fieldId) === 'table' && (
                                        <button
                                          onClick={() => handleExportTableToCSV(fieldId, field.value)}
                                          style={{
                                            padding: '0.5rem 1rem',
                                            background: '#4caf50',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '5px',
                                            fontSize: '0.9rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                          }}
                                        >
                                          📥 Export CSV
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  {getFieldViewMode(fieldId) === 'table' ? (
                                    <div style={{ overflowX: 'auto' }}>
                                      <table style={{
                                        width: '100%',
                                        borderCollapse: 'collapse',
                                        marginTop: '0.5rem',
                                        background: 'white',
                                        border: '1px solid #ddd',
                                      }}>
                                        <thead>
                                          <tr style={{ background: '#f5f5f5' }}>
                                            {field.value.length > 0 && Object.keys(field.value[0]).map((key) => (
                                              <th key={key} style={{
                                                padding: '0.75rem',
                                                textAlign: 'left',
                                                borderBottom: '2px solid #ddd',
                                                fontWeight: 'bold',
                                                color: '#333',
                                              }}>
                                                {key}
                                              </th>
                                            ))}
                                            <th style={{
                                              padding: '0.75rem',
                                              textAlign: 'center',
                                              borderBottom: '2px solid #ddd',
                                              fontWeight: 'bold',
                                              color: '#333',
                                              width: '80px',
                                            }}>
                                              Actions
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {field.value.map((row, rowIndex) => (
                                            <tr key={rowIndex} style={{
                                              background: rowIndex % 2 === 0 ? 'white' : '#fafafa',
                                            }}>
                                              {Object.entries(row).map(([columnKey, cell], cellIndex) => {
                                                const isEditing = editingTableCell?.fieldId === fieldId && 
                                                                 editingTableCell?.rowIndex === rowIndex && 
                                                                 editingTableCell?.columnKey === columnKey;
                                                
                                                return (
                                                  <td key={cellIndex} style={{
                                                    padding: '0.75rem',
                                                    borderBottom: '1px solid #eee',
                                                    color: '#333',
                                                  }}>
                                                    {isEditing ? (
                                                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                        <input
                                                          type="text"
                                                          value={tableCellValue}
                                                          onChange={(e) => setTableCellValue(e.target.value)}
                                                          style={{
                                                            flex: 1,
                                                            padding: '0.25rem',
                                                            border: '2px solid #667eea',
                                                            borderRadius: '3px',
                                                            fontSize: '0.9rem',
                                                          }}
                                                          autoFocus
                                                          onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleSaveTableCell();
                                                            if (e.key === 'Escape') setEditingTableCell(null);
                                                          }}
                                                        />
                                                        <button
                                                          onClick={handleSaveTableCell}
                                                          disabled={saving}
                                                          style={{
                                                            padding: '0.25rem',
                                                            background: '#4caf50',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '3px',
                                                            cursor: 'pointer',
                                                          }}
                                                        >
                                                          <Check size={16} />
                                                        </button>
                                                        <button
                                                          onClick={() => setEditingTableCell(null)}
                                                          style={{
                                                            padding: '0.25rem',
                                                            background: '#f44336',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '3px',
                                                            cursor: 'pointer',
                                                          }}
                                                        >
                                                          <X size={16} />
                                                        </button>
                                                      </div>
                                                    ) : (
                                                      <div 
                                                        onClick={() => handleEditTableCell(fieldId, rowIndex, columnKey, cell)}
                                                        style={{ cursor: 'pointer' }}
                                                        title="Click to edit"
                                                      >
                                                        {typeof cell === 'object' ? JSON.stringify(cell) : String(cell)}
                                                      </div>
                                                    )}
                                                  </td>
                                                );
                                              })}
                                              <td style={{
                                                padding: '0.75rem',
                                                borderBottom: '1px solid #eee',
                                                textAlign: 'center',
                                              }}>
                                                <button
                                                  onClick={() => {
                                                    const firstKey = Object.keys(row)[0];
                                                    handleEditTableCell(fieldId, rowIndex, firstKey, row[firstKey]);
                                                  }}
                                                  style={{
                                                    padding: '0.25rem 0.5rem',
                                                    background: '#667eea',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '3px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.8rem',
                                                  }}
                                                >
                                                  <Edit2 size={14} />
                                                </button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <pre style={{
                                      background: 'white',
                                      padding: '1rem',
                                      borderRadius: '5px',
                                      fontSize: '0.9rem',
                                      overflow: 'auto',
                                      border: '1px solid #ddd',
                                      maxHeight: '400px',
                                    }}>
                                      {JSON.stringify(field.value, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              ) : typeof field.value === 'object' && field.value !== null ? (
                                <pre style={{
                                  background: 'white',
                                  padding: '0.75rem',
                                  borderRadius: '5px',
                                  fontSize: '0.9rem',
                                  overflow: 'auto',
                                }}>
                                  {JSON.stringify(field.value, null, 2)}
                                </pre>
                              ) : (
                                field.value ? String(field.value) : <span style={{ color: '#999', fontStyle: 'italic' }}>No value</span>
                              )}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem', color: '#666' }}>
                            <span>Confidence: {(field.confidence * 100).toFixed(0)}%</span>
                            <span>Source: {field.source}</span>
                          </div>
                        </div>
                        {!editingField && (
                          <button
                            onClick={() => handleEditField(fieldId, field.value)}
                            style={{
                              padding: '0.5rem',
                              background: '#667eea',
                              color: 'white',
                              border: 'none',
                              borderRadius: '5px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                            }}
                          >
                            <Edit2 size={16} />
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {document.status === 'completed' && (
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <button
                      onClick={handleApprove}
                      style={{
                        padding: '1rem 2rem',
                        background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <CheckCircle size={20} />
                      Approve Document
                    </button>
                    <button
                      onClick={handleReject}
                      style={{
                        padding: '1rem 2rem',
                        background: 'white',
                        color: '#f44336',
                        border: '2px solid #f44336',
                        borderRadius: '10px',
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <X size={20} />
                      Reject Document
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>
                {document.status === 'processing' ? 'Data extraction in progress...' : 'No extracted data available'}
              </p>
            )}
          </div>
        )}

        {activeTab === 'validation' && (
          <div style={{
            background: '#f9f9f9',
            padding: '2rem',
            borderRadius: '10px',
          }}>
            {document.validationErrors && document.validationErrors.length > 0 ? (
              <div>
                {document.validationErrors.map((error, index) => (
                  <div key={index} style={{
                    background: 'white',
                    padding: '1rem',
                    borderRadius: '10px',
                    marginBottom: '1rem',
                    borderLeft: '4px solid #f44336',
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#333' }}>
                      {error.fieldName}
                    </div>
                    <div style={{ color: '#666', marginBottom: '0.5rem' }}>
                      Rule: {error.rule}
                    </div>
                    <div style={{ color: '#f44336' }}>
                      {error.message?.errors?.[0]?.message || JSON.stringify(error.message)}
                    </div>
                    {error.value !== undefined && (
                      <div style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
                        Value: {String(error.value)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#666', textAlign: 'center' }}>
                {document.status === 'processing' ? 'Validation in progress...' : 'No validation errors'}
              </p>
            )}
          </div>
        )}

        {activeTab === 'metadata' && (
          <div style={{
            background: '#f9f9f9',
            padding: '2rem',
            borderRadius: '10px',
          }}>
            <pre style={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              color: '#333',
            }}>
              {JSON.stringify({
                documentId: document.documentId,
                customerId: document.customerId,
                documentTypeId: document.documentTypeId,
                templateId: document.templateId,
                filename: document.filename,
                s3Key: document.s3Key,
                s3Bucket: document.s3Bucket,
                language: document.language,
                uploadedAt: document.uploadedAt,
                processedAt: document.processedAt,
              }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
