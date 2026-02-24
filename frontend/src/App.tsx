import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { Box, CircularProgress } from '@mui/material';
import theme from './theme';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute, AdminRoute } from './auth/ProtectedRoute';
import { CategoriesProvider } from './contexts/CategoriesContext';
import LoginPage from './auth/LoginPage';

const HomePage = lazy(() => import('./pages/HomePage'));
const ReceiptCapturePage = lazy(() => import('./pages/ReceiptCapturePage'));
const ReceiptReviewPage = lazy(() => import('./pages/ReceiptReviewPage'));
const ManualEntryPage = lazy(() => import('./pages/ManualEntryPage'));
const RecordListPage = lazy(() => import('./pages/RecordListPage'));
const RecordDetailPage = lazy(() => import('./pages/RecordDetailPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const CardStatusPage = lazy(() => import('./pages/CardStatusPage'));
const MorePage = lazy(() => import('./pages/MorePage'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement'));
const AdminRecords = lazy(() => import('./pages/admin/AdminRecords'));

const Loader = () => (
  <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
    <CircularProgress />
  </Box>
);

const App: React.FC = () => (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <AuthProvider>
      <CategoriesProvider>
      <BrowserRouter>
        <Suspense fallback={<Loader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/capture" element={<ReceiptCapturePage />} />
              <Route path="/receipt-review" element={<ReceiptReviewPage />} />
              <Route path="/receipt-manual" element={<ManualEntryPage />} />
              <Route path="/records" element={<RecordListPage />} />
              <Route path="/records/:id" element={<RecordDetailPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/cards" element={<CardStatusPage />} />
              <Route path="/more" element={<MorePage />} />
            </Route>

            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<UserManagement />} />
              <Route path="/admin/records" element={<AdminRecords />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      </CategoriesProvider>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
