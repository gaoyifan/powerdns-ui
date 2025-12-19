import { Header, NavList, PageLayout } from '@primer/react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { ServerIcon, GlobeIcon, ListUnorderedIcon, SignOutIcon, GraphIcon } from '@primer/octicons-react';
import { useAuth } from '../contexts/AuthContext';

export const MainLayout: React.FC = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bgColor-default)', display: 'flex', flexDirection: 'column' }}>
            <Header>
                <Header.Item>
                    <Header.Link href="/" style={{ fontSize: '14px', fontWeight: 'bold' }}>
                        PowerDNS V5
                    </Header.Link>
                </Header.Item>
                <Header.Item full />
                <Header.Item>
                    <Header.Link as="button" onClick={handleLogout} style={{ color: 'var(--fgColor-muted)', cursor: 'pointer' }}>
                        <SignOutIcon /> Logout
                    </Header.Link>
                </Header.Item>
            </Header>

            <PageLayout>
                <PageLayout.Pane position="start">
                    <NavList>
                        <NavList.Item
                            as={Link}
                            to="/"
                            aria-current={location.pathname === '/' ? 'page' : undefined}
                        >
                            <NavList.LeadingVisual>
                                <ServerIcon />
                            </NavList.LeadingVisual>
                            Dashboard
                        </NavList.Item>

                        <NavList.Item
                            as={Link}
                            to="/zones"
                            aria-current={location.pathname.startsWith('/zones') ? 'page' : undefined}
                        >
                            <NavList.LeadingVisual>
                                <GlobeIcon />
                            </NavList.LeadingVisual>
                            Zones
                        </NavList.Item>

                        <NavList.Item
                            as={Link}
                            to="/views"
                            aria-current={location.pathname.startsWith('/views') ? 'page' : undefined}
                        >
                            <NavList.LeadingVisual>
                                <ListUnorderedIcon />
                            </NavList.LeadingVisual>
                            Views
                        </NavList.Item>

                        <NavList.Item
                            as={Link}
                            to="/networks"
                            aria-current={location.pathname.startsWith('/networks') ? 'page' : undefined}
                        >
                            <NavList.LeadingVisual>
                                <GraphIcon />
                            </NavList.LeadingVisual>
                            Networks
                        </NavList.Item>
                    </NavList>
                </PageLayout.Pane>

                <PageLayout.Content>
                    <Outlet />
                </PageLayout.Content>
            </PageLayout>
        </div>
    );
};
