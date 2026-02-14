import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    FolderTree,
    Users,
    LogOut,
    Image as ImageIcon,
    LayoutTemplate,
    MessageSquare,
    Settings,
    FileText
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const AdminLayout: React.FC = () => {
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const menuItems = [
        { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { path: '/admin/products', label: 'Ürün Yönetimi', icon: Package },
        { path: '/admin/orders', label: 'Siparişler', icon: ShoppingCart },
        { path: '/admin/categories', label: 'Kategori Yönetimi', icon: FolderTree },
        { path: '/admin/dealers', label: 'Bayi Yönetimi', icon: Users },
        { path: '/admin/hero-yonetimi', label: 'Hero Slider', icon: LayoutTemplate },
        { path: '/admin/featured-collections', label: 'Vitrin (Koleksiyon)', icon: ImageIcon },
        { path: '/admin/reviews', label: 'Yorum Yönetimi', icon: MessageSquare },
        { path: '/admin/settings', label: 'Ayarlar (Döviz)', icon: Settings },
        { path: '/admin/blogs', label: 'Blog Yönetimi', icon: FileText },
    ];

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                ></div>
            )}

            {/* Sidebar */}
            <aside className={`
                fixed top-0 left-0 z-50 h-screen w-64 bg-gray-900 text-white flex flex-col overflow-hidden transition-transform duration-200 ease-in-out
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="flex-none flex items-center justify-between h-16 px-6 bg-gray-900 border-b border-gray-800">
                    <span className="text-xl font-bold tracking-wider text-[#f0c961]">ADMIN PANEL</span>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto p-4 space-y-2">
                    <div className="pb-2">
                        <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Menü</p>
                    </div>

                    {menuItems.map((item) => {
                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.end}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive
                                        ? 'bg-[#f0c961] text-[#1a1a1a] font-bold shadow-sm'
                                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                    }`
                                }
                            >
                                <item.icon className="w-5 h-5" />
                                <span>{item.label}</span>
                            </NavLink>
                        );
                    })}
                </nav>

                <div className="flex-none p-4 bg-gray-900 border-t border-gray-800">
                    <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-sm text-red-400 hover:text-red-300 transition-colors"
                    >
                        <LogOut className="w-5 h-5 mr-3" />
                        Çıkış Yap
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className={`flex flex-col min-h-screen transition-all duration-200 ${isMobileMenuOpen ? '' : 'lg:ml-64'}`}>
                {/* Mobile Header */}
                <header className="flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200 lg:hidden sticky top-0 z-30">
                    <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-500 focus:outline-none">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <span className="text-lg font-bold text-gray-900">Admin Panel</span>
                    <div className="w-6"></div> {/* Spacer */}
                </header>

                {/* Page Content */}
                <main className="flex-1 p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
