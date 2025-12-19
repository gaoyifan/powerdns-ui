import React, { useState } from 'react';
import { Button, FormControl, TextInput, Heading, Text, Flash } from '@primer/react';
import { KeyIcon } from '@primer/octicons-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';


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
            // Temporary verify by saving key and trying a request
            // We can't really "verify" without a request, so we'll store it then try to fetch servers
            // But for better UX, we should probably try to fetch something valid first.

            // Store temporarily to test
            localStorage.setItem('pdns_api_key_test', key);

            // Manually construct request with this key to verify
            const headers = { 'X-API-Key': key };
            const res = await fetch(`${import.meta.env.VITE_API_BASE || '/api/v1'}/servers/localhost`, { headers });

            if (!res.ok) {
                throw new Error('Invalid API Key');
            }

            login(key);
            navigate('/');
        } catch (err) {
            setError('Authentication failed. Please check your API Key.');
            localStorage.removeItem('pdns_api_key_test');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'var(--bgColor-default)' }}>
            <div style={{ padding: '24px', backgroundColor: 'var(--overlay-bgColor-default, #1c2128)', borderRadius: '6px', boxShadow: '0 8px 24px rgba(140,149,159,0.2)', width: '100%', maxWidth: '400px' }}>
                <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                    <Heading style={{ marginBottom: '8px' }}>PowerDNS Admin</Heading>
                    <Text style={{ color: 'var(--fgColor-muted)' }}>Enter your API Key to continue</Text>
                </div>

                {error && (
                    <Flash variant="danger" style={{ marginBottom: '16px' }}>
                        {error}
                    </Flash>
                )}

                <form onSubmit={handleSubmit}>
                    <FormControl>
                        <FormControl.Label>API Key</FormControl.Label>
                        <TextInput
                            block
                            leadingVisual={KeyIcon}
                            type="password"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="Enter API Key..."
                            aria-label="API Key"
                        />
                    </FormControl>

                    <div style={{ marginTop: '16px' }}>
                        <Button variant="primary" block disabled={loading || !key}>
                            {loading ? 'Verifying...' : 'Login'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
