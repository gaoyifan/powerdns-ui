import React, { createContext, useContext, useState } from 'react';

interface AuthContextType {
    apiKey: string | null;
    isAuthenticated: boolean;
    login: (key: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [apiKey, setApiKey] = useState<string | null>(localStorage.getItem('pdns_api_key'));

    const login = (key: string) => {
        localStorage.setItem('pdns_api_key', key);
        setApiKey(key);
    };

    const logout = () => {
        localStorage.removeItem('pdns_api_key');
        setApiKey(null);
    };

    return (
        <AuthContext.Provider value={{ apiKey, isAuthenticated: !!apiKey, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
