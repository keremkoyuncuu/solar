import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import ProductReviewsPage from './pages/ProductReviewsPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import AdminRoute from './components/AdminRoute';
import AdminLayout from './layouts/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminProductDetail from './pages/admin/AdminProductDetail';
import AdminOrders from './pages/admin/AdminOrders';
import AdminOrderDetail from './pages/admin/AdminOrderDetail';
import AdminCategories from './pages/admin/AdminCategories';
import AdminFeaturedCollections from './pages/admin/AdminFeaturedCollections';
import CategoryPage from './pages/CategoryPage';
import AccountPage from './pages/AccountPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import Header from './components/Header';
import Footer from './components/Footer';
import LegalPage from './pages/LegalPage';
import DealerApplicationForm from './pages/DealerApplicationForm';
import AdminDealers from './pages/admin/AdminDealers';
import AdminHeroSlides from './pages/admin/AdminHeroSlides';
import AdminReviews from './pages/admin/AdminReviews';
import AdminSettings from './pages/admin/AdminSettings';
import SearchResults from './pages/SearchResults';
import WhatsAppButton from './components/common/WhatsAppButton';
import ForgotPassword from './pages/auth/ForgotPassword';
import UpdatePassword from './pages/auth/UpdatePassword';
import PaymentPage from './pages/PaymentPage';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentFailed from './pages/PaymentFailed';
import PaymentCallback from './pages/PaymentCallback';
import './lib/supabaseClient';



function MainLayout() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#fefcf5] selection:bg-[#f0c961] selection:text-black">
      {!isAdminRoute && <Header />}

      <main className={!isAdminRoute ? 'min-h-[calc(100vh-300px)]' : 'h-screen'}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/update-password" element={<UpdatePassword />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:slug" element={<ProductDetail />} />
          <Route path="/products/:slug/reviews" element={<ProductReviewsPage />} />
          <Route path="/search" element={<SearchResults />} />

          {/* Kategori Sayfası */}
          <Route path="/kategori/:slug" element={<CategoryPage />} />

          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/payment/:orderId" element={<PaymentPage />} />
          <Route path="/payment/success/:orderNo" element={<PaymentSuccess />} />
          <Route path="/payment/fail" element={<PaymentFailed />} />
          <Route path="/payment/callback" element={<PaymentCallback />} />

          {/* Dinamik Yasal Sayfalar */}
          <Route path="/kurumsal/:slug" element={<LegalPage />} />

          {/* Bayilik Başvurusu */}
          <Route path="/bayi-basvuru" element={<DealerApplicationForm />} />

          {/* Hakkımızda Sayfası */}
          <Route path="/hakkimizda" element={<AboutPage />} />

          {/* İletişim Sayfası */}
          <Route path="/iletisim" element={<ContactPage />} />

          <Route path="/account" element={<AccountPage />} />

          {/* Admin Routes */}
          <Route element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<Dashboard />} />

              {/* Statik Rotalar (Static Routes) - EN ÜSTTE */}
              <Route path="/admin/products/categories" element={<AdminCategories />} />
              <Route path="/admin/products/variants" element={<div>Varyantlar Sayfası (Yapım Aşamasında)</div>} />

              {/* Mevcut Statik Rotalar */}
              <Route path="/admin/categories" element={<AdminCategories />} />
              <Route path="/admin/products" element={<AdminProducts />} />
              <Route path="/admin/featured-collections" element={<AdminFeaturedCollections />} />
              <Route path="/admin/orders" element={<AdminOrders />} />
              {/* <Route path="/admin/companies" element={<div className="p-8">Firmalar (Yakında)</div>} /> */}
              <Route path="/admin/dealers" element={<AdminDealers />} />
              <Route path="/admin/hero-yonetimi" element={<AdminHeroSlides />} />
              <Route path="/admin/reviews" element={<AdminReviews />} />
              <Route path="/admin/settings" element={<AdminSettings />} />


              {/* Dinamik Rotalar (Dynamic Routes) - ALTTA */}
              <Route path="/admin/products/:id" element={<AdminProductDetail />} />
              <Route path="/admin/orders/:id" element={<AdminOrderDetail />} />

            </Route>
          </Route>
        </Routes>
      </main>

      {!isAdminRoute && <WhatsAppButton />}
      {!isAdminRoute && <Footer />}
    </div>
  );
}

import ScrollToTop from './components/ScrollToTop';

function App() {
  return (
    <Router>
      <ScrollToTop />
      <MainLayout />
    </Router>
  );
}

export default App;
