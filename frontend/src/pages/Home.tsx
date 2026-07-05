import { Link } from 'react-router-dom';
import { Upload, FileText, Search, Zap, Shield, Cloud } from 'lucide-react';

export default function Home() {
  return (
    <div>
      <div style={{
        textAlign: 'center',
        padding: '4rem 2rem',
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '20px',
        marginBottom: '3rem',
        boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
      }}>
        <h1 style={{
          fontSize: '3rem',
          marginBottom: '1rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          AI-Powered Document Digitization
        </h1>
        <p style={{ fontSize: '1.25rem', color: '#666', marginBottom: '2rem' }}>
          Extract text, analyze content, and digitize your documents with AWS Textract
        </p>
        <Link to="/upload" style={{
          display: 'inline-block',
          padding: '1rem 2rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '50px',
          fontSize: '1.1rem',
          fontWeight: 'bold',
          boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
          transition: 'transform 0.2s',
        }}>
          Get Started
        </Link>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '2rem',
        marginBottom: '3rem',
      }}>
        <FeatureCard
          icon={<Upload size={40} />}
          title="Easy Upload"
          description="Upload PDF, PNG, JPG, or TIFF documents with drag-and-drop support"
        />
        <FeatureCard
          icon={<Zap size={40} />}
          title="Fast Processing"
          description="AWS Textract extracts text in seconds with high accuracy"
        />
        <FeatureCard
          icon={<FileText size={40} />}
          title="Smart Extraction"
          description="Extract text, tables, forms, and key-value pairs automatically"
        />
        <FeatureCard
          icon={<Search size={40} />}
          title="Full-Text Search"
          description="Search across all your digitized documents instantly"
        />
        <FeatureCard
          icon={<Shield size={40} />}
          title="Secure Storage"
          description="Documents stored securely in AWS S3 with encryption"
        />
        <FeatureCard
          icon={<Cloud size={40} />}
          title="Serverless"
          description="Built on AWS Lambda - pay only for what you use"
        />
      </div>

      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '20px',
        padding: '3rem',
        boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
      }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem', color: '#333' }}>
          How It Works
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <Step number={1} title="Upload Document" description="Select and upload your document (PDF or image)" />
          <Step number={2} title="AI Processing" description="AWS Textract analyzes and extracts content" />
          <Step number={3} title="View Results" description="Access extracted text, metadata, and download options" />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '15px',
      padding: '2rem',
      boxShadow: '0 5px 20px rgba(0,0,0,0.1)',
      transition: 'transform 0.2s',
    }}>
      <div style={{ color: '#667eea', marginBottom: '1rem' }}>{icon}</div>
      <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#333' }}>{title}</h3>
      <p style={{ color: '#666', lineHeight: '1.6' }}>{description}</p>
    </div>
  );
}

function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
      <div style={{
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.5rem',
        fontWeight: 'bold',
        flexShrink: 0,
      }}>
        {number}
      </div>
      <div>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#333' }}>{title}</h3>
        <p style={{ color: '#666', lineHeight: '1.6' }}>{description}</p>
      </div>
    </div>
  );
}
