import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Clock, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { documentApi, Document } from '../services/api';

export default function Documents() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadDocuments();
  }, [filter]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const result = await documentApi.list(params);
      setDocuments(result.items || []);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    const upperStatus = status.toUpperCase();
    switch (upperStatus) {
      case 'COMPLETED':
        return <CheckCircle size={20} color="#4caf50" />;
      case 'PROCESSING':
        return <Loader size={20} color="#ff9800" style={{ animation: 'spin 1s linear infinite' }} />;
      case 'FAILED':
        return <AlertCircle size={20} color="#f44336" />;
      default:
        return <Clock size={20} color="#2196f3" />;
    }
  };

  const getStatusColor = (status: string) => {
    const upperStatus = status.toUpperCase();
    switch (upperStatus) {
      case 'COMPLETED':
        return '#4caf50';
      case 'PROCESSING':
        return '#ff9800';
      case 'FAILED':
        return '#f44336';
      default:
        return '#2196f3';
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
        <h1 style={{ fontSize: '2.5rem', color: '#333' }}>My Documents</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {['all', 'completed', 'processing', 'pending', 'failed'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              style={{
                padding: '0.5rem 1rem',
                background: filter === status ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white',
                color: filter === status ? 'white' : '#667eea',
                border: filter === status ? 'none' : '2px solid #667eea',
                borderRadius: '20px',
                cursor: 'pointer',
                textTransform: 'capitalize',
                fontWeight: 'bold',
              }}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader size={48} style={{ color: '#667eea', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          <p style={{ marginTop: '1rem', color: '#666' }}>Loading documents...</p>
        </div>
      ) : documents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <FileText size={64} style={{ color: '#ccc', margin: '0 auto 1rem' }} />
          <p style={{ fontSize: '1.25rem', color: '#666' }}>No documents found</p>
          <Link to="/upload" style={{
            display: 'inline-block',
            marginTop: '1rem',
            padding: '0.75rem 1.5rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '10px',
            fontWeight: 'bold',
          }}>
            Upload Your First Document
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {documents.map((doc) => (
            <Link
              key={doc.documentId}
              to={`/documents/${doc.documentId}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1.5rem',
                padding: '1.5rem',
                background: 'white',
                borderRadius: '15px',
                textDecoration: 'none',
                color: 'inherit',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
            >
              <FileText size={40} style={{ color: '#667eea', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#333' }}>
                  {doc.filename || doc.fileName}
                </h3>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem', color: '#666' }}>
                  <span>Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}</span>
                  {doc.wordCount && <span>Words: {doc.wordCount}</span>}
                </div>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: `${getStatusColor(doc.status)}15`,
                borderRadius: '20px',
                color: getStatusColor(doc.status),
                fontWeight: 'bold',
                textTransform: 'capitalize',
              }}>
                {getStatusIcon(doc.status)}
                {doc.status}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
