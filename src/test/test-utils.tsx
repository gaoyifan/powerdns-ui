import { render, type RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { type ReactElement } from 'react';

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
    return (
        <AuthProvider>
            <NotificationProvider>
                <BrowserRouter>
                    {children}
                </BrowserRouter>
            </NotificationProvider>
        </AuthProvider>
    );
};

const customRender = (
    ui: ReactElement,
    options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
