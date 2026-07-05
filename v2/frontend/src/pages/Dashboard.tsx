import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import { api } from '../services/api';

interface Document {
  id: string;
  file_name: string;
  document_type: string;
  status: string;
  confidence: number | null;
  created_at: string;
  extracted_data: any;
}

interface UsageData {
  documents_processed: number;
  tokens_input: number;
  tokens_output: number;
  total_cost: number;
  month: string;
}

export default function Dashboard() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [docsRes, usageRes] = await Promise.all([
          api.get<{ documents: Document[]; total: number }>('/documents?limit=50'),
          api.get<UsageData>('/exports/usage'),
        ]);
        setDocuments(docsRes.documents || []);
        setUsage(usageRes);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const statusCounts = documents.reduce(
    (acc, doc) => {
      acc[doc.status] = (acc[doc.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const typeCounts = documents.reduce(
    (acc, doc) => {
      const type = doc.document_type || 'other';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const recentDocs = documents.slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Overview of your document processing</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={FileText}
          label="Total Documents"
          value={documents.length}
          color="blue"
        />
        <StatCard
          icon={CheckCircle}
          label="Approved"
          value={statusCounts['approved'] || 0}
          color="emerald"
        />
        <StatCard
          icon={AlertCircle}
          label="Review Required"
          value={statusCounts['review_required'] || 0}
          color="amber"
        />
        <StatCard
          icon={Clock}
          label="Processing"
          value={statusCounts['processing'] || 0}
          color="blue"
        />
      </div>

      {/* Usage and type breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly usage */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Monthly Usage</h2>
          {usage ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-slate-600">Documents Processed</span>
                </div>
                <span className="font-semibold">{usage.documents_processed}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm text-slate-600">Total Cost</span>
                </div>
                <span className="font-semibold">${Number(usage.total_cost).toFixed(4)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-600">Tokens Used</span>
                </div>
                <span className="font-semibold">
                  {(usage.tokens_input + usage.tokens_output).toLocaleString()}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No usage data yet</p>
          )}
        </div>

        {/* Document types breakdown */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">By Document Type</h2>
          {Object.keys(typeCounts).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(typeCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 capitalize">
                      {type.replace(/_/g, ' ')}
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${(count / documents.length) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No documents yet</p>
          )}
        </div>
      </div>

      {/* Status breakdown */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Status Overview</h2>
        <div className="flex flex-wrap gap-3">
          {[
            { status: 'uploaded', color: 'bg-slate-100 text-slate-700' },
            { status: 'processing', color: 'bg-blue-100 text-blue-700' },
            { status: 'extracted', color: 'bg-green-100 text-green-700' },
            { status: 'review_required', color: 'bg-amber-100 text-amber-700' },
            { status: 'approved', color: 'bg-emerald-100 text-emerald-700' },
            { status: 'rejected', color: 'bg-red-100 text-red-700' },
            { status: 'failed', color: 'bg-red-100 text-red-700' },
          ].map(({ status, color }) => (
            <div key={status} className={`px-3 py-2 rounded-lg ${color}`}>
              <span className="text-xs font-medium capitalize">
                {status.replace(/_/g, ' ')}
              </span>
              <span className="ml-2 text-sm font-bold">{statusCounts[status] || 0}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent documents */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Recent Documents</h2>
          <Link to="/documents" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            View all
          </Link>
        </div>
        {recentDocs.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {recentDocs.map((doc) => (
              <Link
                key={doc.id}
                to={`/documents/${doc.id}`}
                className="flex items-center justify-between py-3 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {doc.file_name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(doc.created_at).toLocaleDateString()} &middot;{' '}
                    <span className="capitalize">{doc.document_type?.replace(/_/g, ' ') || 'Unknown'}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <ConfidenceBadge confidence={doc.confidence} />
                  <StatusBadge status={doc.status} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 text-sm">No documents yet. Upload your first document!</p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number;
  color: 'blue' | 'emerald' | 'amber';
}) {
  const iconColors = {
    blue: 'text-blue-600 bg-blue-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    amber: 'text-amber-600 bg-amber-50',
  };

  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconColors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    uploaded: 'bg-slate-100 text-slate-700',
    processing: 'bg-blue-100 text-blue-700 animate-pulse',
    extracted: 'bg-green-100 text-green-700',
    review_required: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    failed: 'bg-red-100 text-red-700',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
        styles[status] || 'bg-slate-100 text-slate-700'
      }`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null || confidence === undefined) return null;

  let color = 'bg-red-100 text-red-700';
  if (confidence >= 0.8) color = 'bg-green-100 text-green-700';
  else if (confidence >= 0.6) color = 'bg-amber-100 text-amber-700';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${color}`}>
      {Math.round(confidence * 100)}%
    </span>
  );
}
