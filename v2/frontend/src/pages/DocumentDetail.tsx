import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  RotateCcw,
  Download,
  Save,
} from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge, ConfidenceBadge } from './Dashboard';

interface Document {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  document_type: string;
  status: string;
  confidence: number | null;
  extracted_data: ExtractedData | null;
  language: string | null;
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ExtractedData {
  vendor?: { name?: string; address?: string; tax_id?: string; email?: string; phone?: string };
  document_number?: string;
  date?: string;
  due_date?: string;
  currency?: string;
  subtotal?: number;
  tax_amount?: number;
  tax_rate?: number;
  total?: number;
  line_items?: Array<{
    description: string;
    quantity?: number;
    unit_price?: number;
    amount: number;
    tax_rate?: number;
    code?: string;
  }>;
  payment_terms?: string;
  notes?: string;
}

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<ExtractedData | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetchDocument();
  }, [id]);

  async function fetchDocument() {
    try {
      const data = await api.get<Document>(`/documents/${id}`);
      setDoc(data);
      setEditData(data.extracted_data ? { ...data.extracted_data } : null);
    } catch (err) {
      console.error('Failed to fetch document:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    try {
      const updated = await api.post<Document>(`/documents/${id}/approve`);
      setDoc(updated);
    } catch (err: any) {
      alert('Failed to approve: ' + err.message);
    }
  }

  async function handleReject() {
    const reason = prompt('Reason for rejection (optional):');
    try {
      const updated = await api.post<Document>(`/documents/${id}/reject`, {
        reason: reason || undefined,
      });
      setDoc(updated);
    } catch (err: any) {
      alert('Failed to reject: ' + err.message);
    }
  }

  async function handleReprocess() {
    try {
      await api.post(`/documents/${id}/reprocess`);
      setDoc((prev) => (prev ? { ...prev, status: 'processing' } : prev));
      // Poll for completion
      setTimeout(fetchDocument, 3000);
    } catch (err: any) {
      alert('Failed to reprocess: ' + err.message);
    }
  }

  async function handleSave() {
    if (!editData) return;
    setSaving(true);
    try {
      const updated = await api.patch<Document>(`/documents/${id}`, {
        extracted_data: editData,
      });
      setDoc(updated);
      setEditing(false);
    } catch (err: any) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPdf() {
    await api.downloadFile(`/exports/pdf/${id}`, `${doc?.file_name || 'document'}.pdf`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading document...</div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Document not found</p>
        <button onClick={() => navigate('/documents')} className="btn-primary mt-4">
          Back to Documents
        </button>
      </div>
    );
  }

  const data = editing ? editData : doc.extracted_data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/documents')}
            className="p-2 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{doc.file_name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <StatusBadge status={doc.status} />
              <ConfidenceBadge confidence={doc.confidence} />
              <span className="text-sm text-slate-500 capitalize">
                {doc.document_type?.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {doc.status !== 'approved' && doc.status !== 'rejected' && doc.extracted_data && (
            <>
              <button onClick={handleApprove} className="btn-primary flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Approve
              </button>
              <button onClick={handleReject} className="btn-danger flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            </>
          )}
          <button onClick={handleReprocess} className="btn-secondary flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            Reprocess
          </button>
          {doc.extracted_data && (
            <button onClick={handleDownloadPdf} className="btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" />
              PDF
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Extracted data */}
        <div className="lg:col-span-2 space-y-6">
          {data ? (
            <>
              {/* Edit toggle */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Extracted Data</h2>
                <div className="flex gap-2">
                  {editing ? (
                    <>
                      <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setEditing(false);
                          setEditData(doc.extracted_data ? { ...doc.extracted_data } : null);
                        }}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setEditing(true)} className="btn-secondary">
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {/* Vendor info */}
              {data.vendor && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">
                    Vendor Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field
                      label="Name"
                      value={data.vendor.name}
                      editing={editing}
                      onChange={(v) =>
                        setEditData((prev) => ({
                          ...prev!,
                          vendor: { ...prev!.vendor, name: v },
                        }))
                      }
                    />
                    <Field
                      label="Tax ID"
                      value={data.vendor.tax_id}
                      editing={editing}
                      onChange={(v) =>
                        setEditData((prev) => ({
                          ...prev!,
                          vendor: { ...prev!.vendor, tax_id: v },
                        }))
                      }
                    />
                    <Field
                      label="Email"
                      value={data.vendor.email}
                      editing={editing}
                      onChange={(v) =>
                        setEditData((prev) => ({
                          ...prev!,
                          vendor: { ...prev!.vendor, email: v },
                        }))
                      }
                    />
                    <Field
                      label="Phone"
                      value={data.vendor.phone}
                      editing={editing}
                      onChange={(v) =>
                        setEditData((prev) => ({
                          ...prev!,
                          vendor: { ...prev!.vendor, phone: v },
                        }))
                      }
                    />
                    <div className="md:col-span-2">
                      <Field
                        label="Address"
                        value={data.vendor.address}
                        editing={editing}
                        onChange={(v) =>
                          setEditData((prev) => ({
                            ...prev!,
                            vendor: { ...prev!.vendor, address: v },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Document details */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">
                  Document Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field
                    label="Document Number"
                    value={data.document_number}
                    editing={editing}
                    onChange={(v) => setEditData((prev) => ({ ...prev!, document_number: v }))}
                  />
                  <Field
                    label="Date"
                    value={data.date}
                    editing={editing}
                    onChange={(v) => setEditData((prev) => ({ ...prev!, date: v }))}
                  />
                  <Field
                    label="Due Date"
                    value={data.due_date}
                    editing={editing}
                    onChange={(v) => setEditData((prev) => ({ ...prev!, due_date: v }))}
                  />
                  <Field
                    label="Currency"
                    value={data.currency}
                    editing={editing}
                    onChange={(v) => setEditData((prev) => ({ ...prev!, currency: v }))}
                  />
                  <Field
                    label="Payment Terms"
                    value={data.payment_terms}
                    editing={editing}
                    onChange={(v) => setEditData((prev) => ({ ...prev!, payment_terms: v }))}
                  />
                </div>
              </div>

              {/* Totals */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">
                  Totals
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Field
                    label="Subtotal"
                    value={data.subtotal?.toString()}
                    editing={editing}
                    onChange={(v) =>
                      setEditData((prev) => ({ ...prev!, subtotal: parseFloat(v) || 0 }))
                    }
                  />
                  <Field
                    label="Tax Rate"
                    value={data.tax_rate?.toString()}
                    editing={editing}
                    onChange={(v) =>
                      setEditData((prev) => ({ ...prev!, tax_rate: parseFloat(v) || 0 }))
                    }
                  />
                  <Field
                    label="Tax Amount"
                    value={data.tax_amount?.toString()}
                    editing={editing}
                    onChange={(v) =>
                      setEditData((prev) => ({ ...prev!, tax_amount: parseFloat(v) || 0 }))
                    }
                  />
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Total</label>
                    <p className="text-xl font-bold text-slate-900">
                      {data.currency || '$'}{data.total?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Line items */}
              {data.line_items && data.line_items.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="p-5 border-b border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                      Line Items ({data.line_items.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left text-xs font-medium text-slate-500 px-4 py-2">
                            Description
                          </th>
                          <th className="text-right text-xs font-medium text-slate-500 px-4 py-2">
                            Qty
                          </th>
                          <th className="text-right text-xs font-medium text-slate-500 px-4 py-2">
                            Unit Price
                          </th>
                          <th className="text-right text-xs font-medium text-slate-500 px-4 py-2">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.line_items.map((item, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2 text-sm text-slate-900">
                              {item.description}
                              {item.code && (
                                <span className="ml-2 text-xs text-slate-400">
                                  ({item.code})
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-slate-600 text-right">
                              {item.quantity ?? '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-slate-600 text-right">
                              {item.unit_price != null ? item.unit_price.toFixed(2) : '-'}
                            </td>
                            <td className="px-4 py-2 text-sm font-medium text-slate-900 text-right">
                              {item.amount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card p-8 text-center">
              <p className="text-slate-500">
                {doc.status === 'processing'
                  ? 'Document is being processed...'
                  : 'No extracted data available'}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* File info */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">
              File Info
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Type</dt>
                <dd className="text-slate-900">{doc.file_type}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Size</dt>
                <dd className="text-slate-900">{(doc.file_size / 1024).toFixed(1)} KB</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Uploaded</dt>
                <dd className="text-slate-900">
                  {new Date(doc.created_at).toLocaleString()}
                </dd>
              </div>
              {doc.reviewed_at && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Reviewed</dt>
                  <dd className="text-slate-900">
                    {new Date(doc.reviewed_at).toLocaleString()}
                  </dd>
                </div>
              )}
              {doc.language && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Language</dt>
                  <dd className="text-slate-900">{doc.language}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Notes */}
          {doc.notes && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                Notes
              </h3>
              <p className="text-sm text-slate-600">{doc.notes}</p>
            </div>
          )}

          {/* Image preview placeholder */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">
              Original Document
            </h3>
            <div className="bg-slate-100 rounded-lg aspect-[3/4] flex items-center justify-center">
              <p className="text-sm text-slate-400">Preview not available</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  editing,
  onChange,
}: {
  label: string;
  value?: string;
  editing: boolean;
  onChange: (value: string) => void;
}) {
  if (editing) {
    return (
      <div>
        <label className="block text-xs text-slate-500 mb-1">{label}</label>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="input-field text-sm"
        />
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <p className="text-sm font-medium text-slate-900">{value || '-'}</p>
    </div>
  );
}
