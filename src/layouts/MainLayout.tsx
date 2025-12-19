import React from 'react';
import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import { Server, Globe, List, LogOut, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { cn } from '../lib/utils';

interface NavItem {
    to: string;
    icon: React.ElementType;
    label: string;
    match: (path: string) => boolean;
}

export const MainLayout: React.FC = () => {
    const { logout, user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems: NavItem[] = [
        { to: '/', icon: Server, label: 'Dashboard', match: (path: string) => path === '/' },
        { to: '/domains', icon: Globe, label: 'Domains', match: (path: string) => path.startsWith('/domains') },
        { to: '/views', icon: List, label: 'Views', match: (path: string) => path.startsWith('/views') },
    ];

    return (
        <div className="bg-muted/30 text-foreground min-h-screen">
            {/* Header */}
            <header className="border-border/80 bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
                <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
                    <Link to="/" className="flex items-center gap-4">
                        <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg text-lg font-semibold shadow-sm">
                            P
                        </div>
                        <div className="flex flex-col leading-tight">
                            <span className="text-sm font-semibold tracking-tight">PowerDNS UI</span>
                            <span className="text-muted-foreground text-xs">v5 Management</span>
                        </div>
                    </Link>

                    <div className="flex flex-1 items-center justify-end gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="border-border/80 rounded-full border"
                            aria-label="Notifications"
                        >
                            <Bell className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-4 border-l border-border/80 pl-4 ml-2">
                            <div className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold uppercase">
                                {user?.username?.slice(0, 2) || 'AD'}
                            </div>
                            <span className="hidden text-sm leading-tight font-medium sm:inline">
                                {user?.username || 'Admin'}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleLogout}
                                className="text-destructive hover:text-destructive/80"
                            >
                                <LogOut className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex flex-col lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
                {/* Sidebar */}
                <aside className="border-border/80 bg-background/80 hidden px-4 py-6 backdrop-blur lg:flex lg:min-h-screen">
                    <nav className="sticky top-24 flex w-full flex-col gap-1">
                        {navItems.map((item) => {
                            const isActive = item.match(location.pathname);
                            return (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    className={cn(
                                        'group relative flex items-center gap-4 rounded-xl px-3 py-2 text-sm transition-colors',
                                        isActive
                                            ? 'bg-primary/10 text-primary font-semibold shadow-sm'
                                            : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground font-medium'
                                    )}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            'h-6 w-1 rounded-full bg-transparent transition-colors',
                                            isActive ? 'bg-primary' : 'group-hover:bg-primary/60'
                                        )}
                                    />
                                    <item.icon className="h-4 w-4" />
                                    <span className="truncate">{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="min-h-screen px-4 py-6 sm:px-6">
                    <div className="mx-auto max-w-7xl">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};
