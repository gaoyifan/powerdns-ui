import React, { useState } from 'react';
import { API_BASE_URL } from '../constants';
import { Key } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent, Flash } from '../components';

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
            const res = await fetch(`${API_BASE_URL}/servers/localhost`, { headers });

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
        <div className="flex justify-center items-center min-h-screen bg-muted/30">
            <Card className="w-full max-w-md shadow-lg border-border/80 bg-background/80 backdrop-blur">
                <CardHeader className="text-center space-y-4">
                    <div className="mx-auto flex justify-center">
                        <Logo size={64} className="text-primary drop-shadow-md" />
                    </div>
                    <div>
                        <CardTitle className="text-3xl font-extrabold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                            PowerDNS UI
                        </CardTitle>
                        <CardDescription className="text-sm font-medium uppercase tracking-widest mt-1">v5 Management System</CardDescription>
                    </div>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && <Flash variant="danger">{error}</Flash>}

                        <Input
                            label="API Key"
                            type="password"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="api-key-..."
                            leadingIcon={Key}
                            block
                            required
                            autoFocus
                        />

                        <Button
                            type="submit"
                            variant="primary"
                            block
                            disabled={loading || !key}
                            loading={loading}
                            size="lg"
                            className="text-base font-semibold"
                        >
                            Sign In
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};
