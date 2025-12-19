import React, { useState } from 'react';
import { Key } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Flash } from '../components';

export const Login: React.FC = () => {
    const [key, setKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            localStorage.setItem('pdns_api_key_test', key);
            const headers = { 'X-API-Key': key };
            const res = await fetch(`${import.meta.env.VITE_API_BASE || '/api/v1'}/servers/localhost`, { headers });

            if (!res.ok) {
                throw new Error('Invalid API Key');
            }

            login(key);
            navigate('/');
        } catch {
            setError('Authentication failed. Please check your API Key.');
            localStorage.removeItem('pdns_api_key_test');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex justify-center items-center min-h-screen bg-bg-page">
            <div className="p-6 bg-bg-card border border-border rounded-lg shadow-lg w-full max-w-sm">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-bold text-text-primary mb-2">PowerDNS Admin</h1>
                    <p className="text-text-secondary text-sm">Enter your API Key to continue</p>
                </div>

                {error && (
                    <Flash variant="danger" className="mb-4">
                        {error}
                    </Flash>
                )}

                <form onSubmit={handleSubmit}>
                    <Input
                        label="API Key"
                        type="password"
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        placeholder="Enter API Key..."
                        leadingIcon={Key}
                        block
                    />

                    <div className="mt-4">
                        <Button
                            type="submit"
                            variant="primary"
                            block
                            disabled={loading || !key}
                            loading={loading}
                        >
                            {loading ? 'Verifying...' : 'Login'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
