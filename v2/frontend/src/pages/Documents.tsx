import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge, ConfidenceBadge } from './Dashboard';

interface Document {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  document_type: string;
  status: string;
  confidence: number | null;
  extracted_data: any;
  created_at: string;
}

const DOCUMENT_TYPES = [
  'invoice',
  'receipt',
  'credit_note',
  'purchase_order',
  'delivery_note',
  'bank_statement',
  'expense_report',
  'contract',
  'other',
];

const STATUSES = [
  'uploaded',
  'processing',
  'extracted',
  'review_required',
  'approved',
  'rejected',
  'failed',
];

export default function Documents() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const limit = 20;

  useEffect(() => {
    fetchDocuments();
  }, [page, statusFilter, typeFilter]);

  async function fetchDocuments() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);

      const data = await api.get<{ documents: Document[]; total: number }>(
        `/documents?${params.toString()}`
      );
      setDocuments(data.documents || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/documents/${id}`);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setTotal((prev) => prev - 1);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
        <p className="text-slate-500 mt-1">Manage all your scanned documents</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="input-field w-auto"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="input-field w-auto"
        >
          <option value="">All types</option>
          {DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, ' ')}
            </option>
          ))}
        </select>

        <div className="ml-auto text-sm text-slate-500 self-center">
          {total} document{total !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">
                  Filename
                </th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">
                  Type
                </th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">
                  Vendor
                </th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">
                  Date
                </th>
                <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">
                  Total
                </th>
                <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">
                  Confidence
                </th>
                <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Loading...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No documents found
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        to={`/documents/${doc.id}`}
                        className="text-sm font-medium text-slate-900 hover:text-blue-600 truncate block max-w-[200px]"
                      >
                        {doc.file_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600 capitalize">
                        {doc.document_type?.replace(/_/g, ' ') || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600">
                        {doc.extracted_data?.vendor?.name || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600">
                        {doc.extracted_data?.date ||
                          new Date(doc.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-slate-900">
                        {doc.extracted_data?.total != null
                          ? `${doc.extracted_data.currency || '$'}${doc.extracted_data.total.toFixed(2)}`
                          : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ConfidenceBadge confidence={doc.confidence} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to={`/documents/${doc.id}`}
                          className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(doc.id, doc.file_name)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-50 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-50 hover:bg-slate-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
