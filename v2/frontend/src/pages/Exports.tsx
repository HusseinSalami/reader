import { useState, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, Table2 } from 'lucide-react';
import { api } from '../services/api';

interface UsageData {
  documents_processed: number;
  tokens_input: number;
  tokens_output: number;
  total_cost: number;
  month: string;
}

const STATUSES = [
  'extracted',
  'review_required',
  'approved',
  'rejected',
];

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

export default function Exports() {
  const [format, setFormat] = useState<'pdf' | 'excel' | 'csv'>('excel');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get<UsageData>('/exports/usage').then(setUsage).catch(console.error);
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const queryString = params.toString() ? `?${params.toString()}` : '';

      if (format === 'excel') {
        await api.downloadFile(`/exports/excel${queryString}`, 'documents-export.xlsx');
      } else if (format === 'csv') {
        await api.downloadFile(`/exports/csv${queryString}`, 'documents-export.csv');
      }
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Exports</h1>
        <p className="text-slate-500 mt-1">Export your processed documents in various formats</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Export controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Format selection */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Export Format</h2>
            <div className="grid grid-cols-3 gap-3">
              <FormatOption
                icon={FileSpreadsheet}
                label="Excel"
                description="XLSX spreadsheet"
                selected={format === 'excel'}
                onClick={() => setFormat('excel')}
              />
              <FormatOption
                icon={Table2}
                label="CSV"
                description="Comma-separated"
                selected={format === 'csv'}
                onClick={() => setFormat('csv')}
              />
              <FormatOption
                icon={FileText}
                label="PDF"
                description="Single document"
                selected={format === 'pdf'}
                onClick={() => setFormat('pdf')}
                disabled
              />
            </div>
            {format === 'pdf' && (
              <p className="text-sm text-slate-500 mt-3">
                PDF export is available per document from the document detail page.
              </p>
            )}
          </div>

          {/* Filters */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Filters</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="input-field"
                >
                  <option value="">All statuses</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Document Type
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="input-field"
                >
                  <option value="">All types</option>
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* Download button */}
          <button
            onClick={handleExport}
            disabled={exporting || format === 'pdf'}
            className="btn-primary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : `Export as ${format.toUpperCase()}`}
          </button>
        </div>

        {/* Usage statistics */}
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Usage Statistics</h2>
            {usage ? (
              <dl className="space-y-4">
                <div>
                  <dt className="text-xs text-slate-500 uppercase tracking-wider">Month</dt>
                  <dd className="text-lg font-semibold text-slate-900 mt-1">
                    {usage.month}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 uppercase tracking-wider">
                    Documents Processed
                  </dt>
                  <dd className="text-lg font-semibold text-slate-900 mt-1">
                    {usage.documents_processed}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 uppercase tracking-wider">
                    Input Tokens
                  </dt>
                  <dd className="text-lg font-semibold text-slate-900 mt-1">
                    {usage.tokens_input.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 uppercase tracking-wider">
                    Output Tokens
                  </dt>
                  <dd className="text-lg font-semibold text-slate-900 mt-1">
                    {usage.tokens_output.toLocaleString()}
                  </dd>
                </div>
                <div className="pt-3 border-t border-slate-200">
                  <dt className="text-xs text-slate-500 uppercase tracking-wider">
                    Total Cost
                  </dt>
                  <dd className="text-2xl font-bold text-slate-900 mt-1">
                    ${Number(usage.total_cost).toFixed(4)}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-slate-400">No usage data available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FormatOption({
  icon: Icon,
  label,
  description,
  selected,
  onClick,
  disabled,
}: {
  icon: any;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-4 rounded-lg border-2 text-center transition-colors ${
        selected
          ? 'border-blue-600 bg-blue-50'
          : disabled
          ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
          : 'border-slate-200 hover:border-blue-300'
      }`}
    >
      <Icon className={`w-6 h-6 mx-auto mb-2 ${selected ? 'text-blue-600' : 'text-slate-400'}`} />
      <p className={`text-sm font-medium ${selected ? 'text-blue-700' : 'text-slate-700'}`}>
        {label}
      </p>
      <p className="text-xs text-slate-500 mt-0.5">{description}</p>
    </button>
  );
}
