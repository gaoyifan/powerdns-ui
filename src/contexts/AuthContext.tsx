import React, { createContext, useContext, useState } from 'react';

interface AuthContextType {
    apiKey: string | null;
    user: { username: string } | null;
    isAuthenticated: boolean;
    login: (key: string) => void;
    logout: () => void;
}

import { STORAGE_KEYS } from '../constants';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [apiKey, setApiKey] = useState<string | null>(localStorage.getItem(STORAGE_KEYS.API_KEY));
    const user = apiKey ? { username: 'Admin' } : null; // Mock user for now

    const login = (key: string) => {
        localStorage.setItem(STORAGE_KEYS.API_KEY, key);
        setApiKey(key);
    };

    const logout = () => {
        localStorage.removeItem(STORAGE_KEYS.API_KEY);
        setApiKey(null);
    };

    return <AuthContext.Provider value={{ apiKey, user, isAuthenticated: !!apiKey, login, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
