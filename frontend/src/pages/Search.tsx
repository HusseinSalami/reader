import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search as SearchIcon, FileText, Loader } from 'lucide-react';
import { documentApi, Document } from '../services/api';

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    try {
      const data = await documentApi.searchDocuments(query);
      setResults(data.documents);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '20px',
      padding: '3rem',
      boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
    }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#333' }}>
        Search Documents
      </h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Search across all your digitized documents
      </p>

      <form onSubmit={handleSearch} style={{ marginBottom: '3rem' }}>
        <div style={{
          display: 'flex',
          gap: '1rem',
          background: 'white',
          padding: '0.5rem',
          borderRadius: '50px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter search terms..."
            style={{
              flex: 1,
              padding: '0.75rem 1.5rem',
              border: 'none',
              outline: 'none',
              fontSize: '1.1rem',
              background: 'transparent',
            }}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            style={{
              padding: '0.75rem 2rem',
              background: query.trim() && !loading ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '50px',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              cursor: query.trim() && !loading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {loading ? (
              <>
                <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
                Searching...
              </>
            ) : (
              <>
                <SearchIcon size={20} />
                Search
              </>
            )}
          </button>
        </div>
      </form>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader size={48} style={{ color: '#667eea', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          <p style={{ marginTop: '1rem', color: '#666' }}>Searching documents...</p>
        </div>
      ) : searched ? (
        results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <SearchIcon size={64} style={{ color: '#ccc', margin: '0 auto 1rem' }} />
            <p style={{ fontSize: '1.25rem', color: '#666' }}>
              No documents found for "{query}"
            </p>
          </div>
        ) : (
          <div>
            <p style={{ marginBottom: '1.5rem', color: '#666', fontSize: '1.1rem' }}>
              Found {results.length} document{results.length !== 1 ? 's' : ''} matching "{query}"
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {results.map((doc) => (
                <Link
                  key={doc.documentId}
                  to={`/documents/${doc.documentId}`}
                  style={{
                    display: 'flex',
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
                      {doc.fileName}
                    </h3>
                    <p style={{
                      color: '#666',
                      lineHeight: '1.6',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {doc.extractedText?.substring(0, 200)}...
                    </p>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#999' }}>
                      Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                      {doc.wordCount && ` • ${doc.wordCount} words`}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <SearchIcon size={64} style={{ color: '#ccc', margin: '0 auto 1rem' }} />
          <p style={{ fontSize: '1.25rem', color: '#666' }}>
            Enter a search term to find documents
          </p>
        </div>
      )}
    </div>
  );
}
