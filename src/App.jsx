import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import AppLayout from '@/components/AppLayout';
import AccessGuard from '@/components/AccessGuard';

// Pages
import Dashboard from '@/pages/Dashboard';
import Customers from '@/pages/Customers';
import CustomerDetail from '@/pages/CustomerDetail';
import Orders from '@/pages/Orders';
import OrderCreate from '@/pages/OrderCreate';
import OrderDetail from '@/pages/OrderDetail';
import Tailors from '@/pages/Tailors';
import Payments from '@/pages/Payments';
import Sales from '@/pages/Sales';
import Settings from '@/pages/Settings';
import OrderOnline from '@/pages/OrderOnline';
import OnlineOrders from '@/pages/OnlineOrders';
import Accounts from '@/pages/Accounts';
import Paywall from '@/pages/Paywall';
import Admin from '@/pages/Admin';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

const AuthenticatedApp = () => {
  return (
    <Routes>
      {/* Public storefront */}
      <Route path="/order-online" element={<OrderOnline />} />

      {/* Public Authentication routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Authenticated Application Shell */}
      <Route element={<AppLayout />}>
        {/* Paywall is accessible to any signed-in user */}
        <Route path="/paywall" element={<Paywall />} />

        {/* Server-gated Admin Console: non-admins receive 404 */}
        <Route element={<AccessGuard requireAdmin={true} />}>
          <Route path="/admin" element={<Admin />} />
        </Route>

        {/* Protected Business Management & POS Routes: require active subscription, coupon, or provisional access */}
        <Route element={<AccessGuard />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/new" element={<OrderCreate />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/tailors" element={<Tailors />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/invoices" element={<Sales />} />
          <Route path="/invoicing" element={<Sales />} />
          <Route path="/invoice" element={<Sales />} />
          <Route path="/whatsapp-invoice" element={<Sales />} />
          <Route path="/whatsapp-invoicing" element={<Sales />} />
          <Route path="/whatsapp" element={<Sales />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/online-orders" element={<OnlineOrders />} />
          <Route path="/accounts" element={<Accounts />} />
        </Route>
      </Route>

      {/* 404 Catch-All */}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;