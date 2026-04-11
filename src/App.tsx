import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Objectives } from './pages/Objectives';
import { Goals } from './pages/Goals';
import { Study } from './pages/Study';
import { Reports } from './pages/Reports';
import { AdminUsers } from './pages/AdminUsers';
import { AdminTeams } from './pages/AdminTeams';
import { AdminDashboard } from './pages/AdminDashboard';
import { Announcements } from './pages/Announcements';
import { Meetings } from './pages/Meetings';
import { Leads } from './pages/Leads';
import { WhiteboardsList } from './pages/WhiteboardsList';
import { WhiteboardView } from './pages/WhiteboardView';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/objectives" element={<Objectives />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/study" element={<Study />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/announcements" element={<Announcements />} />
            <Route path="/meetings" element={<Meetings />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/whiteboards" element={<WhiteboardsList />} />
            <Route path="/whiteboards/:id" element={<WhiteboardView />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requireAdmin><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/teams" element={<ProtectedRoute requireAdmin><AdminTeams /></ProtectedRoute>} />
          </Route>
          
          {/* Catch-all route to redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
