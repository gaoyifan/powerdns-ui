import React from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { Server, Globe, List, LogOut, Network } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NavItemProps {
    to: string;
    icon: React.ElementType;
    label: string;
    isActive: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon: Icon, label, isActive }) => (
    <Link
        to={to}
        className={`
      flex items-center gap-3 px-3 py-2 rounded-md text-sm
      transition-all duration-[var(--transition-fast)]
      ${isActive
                ? 'bg-primary/10 text-primary font-semibold border-l-2 border-primary -ml-[2px]'
                : 'text-text-secondary hover:text-text-primary hover:bg-border/10'
            }
    `}
    >
        <Icon className="w-5 h-5" />
        <span>{label}</span>
    </Link>
);

export const MainLayout: React.FC = () => {
    const { logout } = useAuth();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        window.location.href = '/login';
    };

    const navItems = [
        { to: '/', icon: Server, label: 'Dashboard', match: (path: string) => path === '/' },
        { to: '/zones', icon: Globe, label: 'Zones', match: (path: string) => path.startsWith('/zones') },
        { to: '/views', icon: List, label: 'Views', match: (path: string) => path.startsWith('/views') },
        { to: '/networks', icon: Network, label: 'Networks', match: (path: string) => path.startsWith('/networks') },
    ];

    return (
        <div className="min-h-screen bg-bg-page flex flex-col">
            {/* Top Header Bar */}
            <header className="bg-bg-card border-b border-border px-6 py-3 flex items-center justify-between">
                <Link to="/" className="text-lg font-bold text-primary hover:text-primary-hover transition-colors">
                    PowerDNS V5
                </Link>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    Logout
                </button>
            </header>

            <div className="flex flex-1">
                {/* Left Sidebar */}
                <nav className="w-56 bg-bg-card border-r border-border p-4 flex flex-col gap-1">
                    {navItems.map(item => (
                        <NavItem
                            key={item.to}
                            to={item.to}
                            icon={item.icon}
                            label={item.label}
                            isActive={item.match(location.pathname)}
                        />
                    ))}
                </nav>

                {/* Main Content */}
                <main className="flex-1 overflow-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
