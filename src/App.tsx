import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { Views } from './pages/Views';
import { Networks } from './pages/Networks';
import { Zones } from './pages/Zones';
import { ZoneDetails } from './pages/ZoneDetails';
import { MainLayout } from './layouts/MainLayout';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/" element={<div className="p-6 text-text-secondary">Dashboard Placeholder</div>} />
        <Route path="/zones" element={<Zones />} />
        <Route path="/zones/:name" element={<ZoneDetails />} />
        <Route path="/views" element={<Views />} />
        <Route path="/networks" element={<Networks />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
