import React, { useState } from 'react';
import { Key, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components';

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
        <div className="flex justify-center items-center min-h-screen bg-muted/30">
            <Card className="w-full max-w-md shadow-lg border-border/80 bg-background/80 backdrop-blur">
                <CardHeader className="text-center space-y-2">
                    <div className="mx-auto bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-xl text-2xl font-bold shadow-sm mb-2">
                        P
                    </div>
                    <CardTitle className="text-2xl">PowerDNS Admin</CardTitle>
                    <CardDescription>Enter your API Key to access the control plane</CardDescription>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-3 text-sm font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
                                <ShieldCheck className="size-4" />
                                {error}
                            </div>
                        )}

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
