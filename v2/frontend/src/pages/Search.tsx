import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search as SearchIcon, Filter } from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge, ConfidenceBadge } from './Dashboard';

interface Document {
  id: string;
  file_name: string;
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

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setSearched(true);

    try {
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);

      const data = await api.get<{ documents: Document[]; total: number }>(
        `/documents?${params.toString()}`
      );

      // Client-side text search (the API doesn't have a search endpoint, so we filter locally)
      let docs = data.documents || [];
      if (query.trim()) {
        const q = query.toLowerCase();
        docs = docs.filter(
          (doc) =>
            doc.file_name.toLowerCase().includes(q) ||
            doc.extracted_data?.vendor?.name?.toLowerCase().includes(q) ||
            doc.extracted_data?.document_number?.toLowerCase().includes(q) ||
            doc.extracted_data?.notes?.toLowerCase().includes(q) ||
            doc.document_type?.toLowerCase().includes(q)
        );
      }

      setResults(docs);
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Search</h1>
        <p className="text-slate-500 mt-1">Find documents by name, vendor, or number</p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents..."
              className="input-field pl-10"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center gap-2 ${showFilters ? 'bg-slate-100' : ''}`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3 p-4 bg-slate-50 rounded-lg">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
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
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input-field w-auto"
            >
              <option value="">All types</option>
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        )}
      </form>

      {/* Results */}
      {searched && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </p>

          {results.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-slate-400">No documents match your search</p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((doc) => (
                <Link
                  key={doc.id}
                  to={`/documents/${doc.id}`}
                  className="card p-4 flex items-center justify-between hover:border-blue-300 transition-colors block"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {doc.file_name}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-500 capitalize">
                        {doc.document_type?.replace(/_/g, ' ') || 'Unknown'}
                      </span>
                      {doc.extracted_data?.vendor?.name && (
                        <span className="text-xs text-slate-500">
                          {doc.extracted_data.vendor.name}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {doc.extracted_data?.total != null && (
                      <span className="text-sm font-medium text-slate-900">
                        {doc.extracted_data.currency || '$'}
                        {doc.extracted_data.total.toFixed(2)}
                      </span>
                    )}
                    <ConfidenceBadge confidence={doc.confidence} />
                    <StatusBadge status={doc.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
