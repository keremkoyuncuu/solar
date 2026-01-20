import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Menu, Search, Heart, User, ShoppingCart, X, ChevronDown, ChevronRight } from 'lucide-react';
import { getOrCreateActiveCart } from '../lib/cart';

export default function Header() {
    const location = useLocation();
    const [session, setSession] = useState<any>(null);
    const [cartCount, setCartCount] = useState<number>(0);
    const [categories, setCategories] = useState<any[]>([]);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);
    // --- Search State ---
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);

    const searchRef = React.useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Live Search Logic
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.trim().length < 2) {
                setSearchResults([]);
                return;
            }

            setSearchLoading(true);
            setShowDropdown(true);

            try {
                const query = searchQuery.trim();

                // Parallel Queries
                const [prodRes, catRes] = await Promise.all([
                    // A. Products (Name or Description)
                    supabase
                        .from('products')
                        .select('id, name, slug, product_images(url)')
                        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
                        .eq('is_active', true)
                        .limit(5),

                    // B. Categories (Name)
                    supabase
                        .from('categories')
                        .select('id, name, slug')
                        .ilike('name', `%${query}%`)
                        .eq('is_active', true)
                        .limit(3)
                ]);

                const combined = [
                    ...(catRes.data || []).map(c => ({ ...c, type: 'category' })),
                    ...(prodRes.data || []).map(p => ({ ...p, type: 'product' }))
                ];

                setSearchResults(combined);
            } catch (error) {
                console.error('Autocomplete error:', error);
            } finally {
                setSearchLoading(false);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const handleSearchSubmit = () => {
        if (searchQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
            setShowDropdown(false);
            setIsMobileMenuOpen(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleSearchSubmit();
    };

    // --- Data Fetching ---
    useEffect(() => {
        // Initial Session Check
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) {
                initializeCart(session.user.id);
            } else {
                // Misafir kullanıcı için sepet sayısını çek
                fetchGuestCartCount();
            }
        });

        // Auth State Listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) {
                initializeCart(session.user.id);
            } else {
                fetchGuestCartCount();
            }
        });

        fetchCategories();

        return () => subscription.unsubscribe();
    }, []);

    // Sepet değişikliklerini dinle (realtime)
    useEffect(() => {
        const refreshCartCount = () => {
            if (session) {
                fetchCartCount(session.user.id);
            } else {
                fetchGuestCartCount();
            }
        };

        // Her sayfa değişikliğinde ve storage event'inde sepeti güncelle
        window.addEventListener('storage', refreshCartCount);
        window.addEventListener('cartUpdated', refreshCartCount);

        return () => {
            window.removeEventListener('storage', refreshCartCount);
            window.removeEventListener('cartUpdated', refreshCartCount);
        };
    }, [session]);

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    const fetchCategories = async () => {
        const { data } = await supabase
            .from('categories')
            .select('id, name, slug, parent_id')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (data) setCategories(data);
    };

    const initializeCart = async (userId: string) => {
        const cartId = await getOrCreateActiveCart(userId);
        if (cartId) {
            fetchCartCount(userId);
        }
    };

    // Giriş yapmış kullanıcı için sepet sayısı
    const fetchCartCount = async (userId: string) => {
        const { data } = await supabase.from('carts').select('id').eq('profile_id', userId).eq('status', 'active').maybeSingle();
        if (data) {
            const { count } = await supabase.from('cart_items').select('*', { count: 'exact', head: true }).eq('cart_id', data.id);
            setCartCount(count || 0);
        } else {
            setCartCount(0);
        }
    };

    // Misafir kullanıcı için sepet sayısı
    const fetchGuestCartCount = async () => {
        const sessionId = localStorage.getItem('guest_session_id');
        if (!sessionId) {
            setCartCount(0);
            return;
        }

        const { data } = await supabase.from('carts').select('id').eq('session_id', sessionId).eq('status', 'active').maybeSingle();
        if (data) {
            const { count } = await supabase.from('cart_items').select('*', { count: 'exact', head: true }).eq('cart_id', data.id);
            setCartCount(count || 0);
        } else {
            setCartCount(0);
        }
    };

    // --- Helpers ---
    const buildMenu = (cats: any[]) => {
        const rootCats = cats.filter(c => !c.parent_id);
        return rootCats.map(root => ({
            ...root,
            children: cats.filter(c => c.parent_id === root.id)
        }));
    };

    const menuItems = buildMenu(categories);

    const toggleSubMenu = (id: string) => {
        setOpenSubMenu(openSubMenu === id ? null : id);
    };

    if (location.pathname === '/checkout') return null;

    return (
        <>


            {/* 2. MAIN NAVBAR CONTAINER */}
            <header className="bg-[#fffcf7] border-b border-gray-100 sticky top-0 z-[50] shadow-sm transition-all duration-300">
                <div className="container mx-auto px-4 py-2 md:py-3">

                    {/* ROW 1: Navigation & Logos */}
                    <div className="flex justify-between items-center gap-2">
                        {/* Left: Hamburger Menu */}
                        <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-1 text-gray-800 shrink-0">
                            <Menu className="w-6 h-6" strokeWidth={2.5} />
                        </button>

                        {/* Center: Logo + Search */}
                        <div className="flex items-center justify-start flex-1 gap-6">
                            <Link to="/" className="group flex flex-col items-center hover:scale-105 transition-transform duration-300 shrink-0">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-lg md:text-2xl font-black text-[#f0c961] italic tracking-tighter drop-shadow-sm select-none">İÇEL</span>
                                    <span className="text-lg md:text-2xl font-black text-[#222] italic tracking-tighter select-none">SOLAR</span>
                                </div>
                            </Link>

                            {/* Desktop Search (Inline with Logo) */}
                            <div className="hidden md:block flex-1 max-w-lg relative" ref={searchRef}>
                                <input
                                    type="text"
                                    placeholder="Ürün, kategori veya marka ara..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-200 bg-[#f9f9f9] text-gray-700 placeholder-gray-400 focus:bg-white focus:border-[#f0c961] focus:ring-2 focus:ring-[#f0c961]/20 outline-none transition-all shadow-inner text-sm"
                                />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    <Search className="w-4 h-4" />
                                </div>

                                {/* Autocomplete Dropdown */}
                                {showDropdown && searchQuery.length >= 2 && (
                                    <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-[100] animate-fade-in-up">
                                        {searchLoading ? (
                                            <div className="p-4 text-center text-gray-400 text-sm">Aranıyor...</div>
                                        ) : searchResults.length > 0 ? (
                                            <ul>
                                                {searchResults.map((item) => (
                                                    <li key={`${item.type}-${item.id}`} className="border-b border-gray-50 last:border-0 hover:bg-[#fffaf4] transition-colors">
                                                        <Link
                                                            to={item.type === 'category' ? `/kategori/${item.slug}` : `/products/${item.slug}`}
                                                            onClick={() => { setShowDropdown(false); setSearchQuery(''); }}
                                                            className="flex items-center gap-3 p-3"
                                                        >
                                                            {item.type === 'category' ? (
                                                                <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
                                                                    <span className="text-xs font-bold">#</span>
                                                                </div>
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0">
                                                                    {item.product_images?.[0]?.url ? (
                                                                        <img
                                                                            src={item.product_images[0].url}
                                                                            alt={item.name}
                                                                            loading="lazy"
                                                                            width={32}
                                                                            height={32}
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">📦</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm font-medium text-gray-800 truncate">
                                                                    {item.name}
                                                                </div>
                                                                <div className="text-xs text-gray-400 capitalize">
                                                                    {item.type === 'category' ? 'Kategori' : 'Ürün'}
                                                                </div>
                                                            </div>
                                                            <ChevronRight className="w-4 h-4 text-gray-300" />
                                                        </Link>
                                                    </li>
                                                ))}
                                                <li className="p-2 bg-gray-50 text-center">
                                                    <button onClick={handleSearchSubmit} className="text-xs font-bold text-[#f0c961] hover:underline">
                                                        Tüm Sonuçları Gör ({searchResults.length}+)
                                                    </button>
                                                </li>
                                            </ul>
                                        ) : (
                                            <div className="p-4 text-center text-gray-400 text-sm">Sonuç bulunamadı.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right: Icons Group */}
                        <div className="flex items-center gap-2 md:gap-5 shrink-0">
                            {/* Heart */}
                            <button className="hidden sm:block text-gray-600 hover:text-[#f0c961] transition-colors">
                                <Heart className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2} />
                            </button>

                            {/* User */}
                            <Link to={session ? "/account" : "/login"} className="text-gray-600 hover:text-[#f0c961] transition-colors">
                                <User className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2} />
                            </Link>

                            {/* Cart */}
                            <Link to="/cart" className="relative text-gray-600 hover:text-[#f0c961] transition-colors">
                                <ShoppingCart className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2} />
                                {cartCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 md:w-4 md:h-4 bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full border border-white">
                                        {cartCount}
                                    </span>
                                )}
                            </Link>
                        </div>
                    </div>

                    {/* ROW 2: Search Bar (Mobile Only) - Compact */}
                    <div className="w-full mt-2 md:hidden pb-1">
                        <div className="relative group">
                            <input
                                type="text"
                                placeholder="Ürün ara..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-800 placeholder-gray-400 focus:border-[#f0c961] outline-none text-xs"
                            />
                            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                                <Search className="w-3.5 h-3.5" />
                            </div>
                        </div>
                    </div>


                </div>

                {/* DESKTOP MENU (Hidden on Mobile) */}
                <div className="hidden md:block border-t border-gray-100 bg-[#fffaf4] relative">
                    <div className="container mx-auto px-4">
                        <nav className="flex items-center justify-center gap-4 lg:gap-8 xl:gap-12">
                            {menuItems.map((item) => (
                                <div key={item.id} className="relative group">
                                    <Link
                                        to={`/kategori/${item.slug}`}
                                        className="py-4 text-[11px] lg:text-[12px] font-bold text-gray-600 hover:text-[#f0c961] whitespace-nowrap transition-colors tracking-wider flex items-center gap-1"
                                    >
                                        {item.name.toUpperCase()}
                                        {item.children.length > 0 && <ChevronDown className="w-3 h-3" />}
                                    </Link>
                                    {/* Dropdown - Referans sitedeki gibi */}
                                    {item.children.length > 0 && (
                                        <div className="absolute top-full left-0 min-w-[220px] bg-white shadow-xl py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-[9999]" style={{ marginTop: '0px' }}>
                                            {item.children.map((child: any) => (
                                                <Link
                                                    key={child.id}
                                                    to={`/kategori/${child.slug}`}
                                                    className="block px-5 py-3 text-sm text-gray-700 hover:text-[#f0c961] hover:bg-[#fffaf4] transition-colors whitespace-nowrap border-b border-gray-50 last:border-0"
                                                >
                                                    {child.name}
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                            <Link to="/bayi-basvuru" className="py-4 text-[11px] lg:text-[12px] font-bold text-gray-600 hover:text-[#f0c961] whitespace-nowrap transition-colors tracking-wider">
                                BAYİLİK BAŞVURUSU
                            </Link>
                            <Link to="/hakkimizda" className="py-4 text-[11px] lg:text-[12px] font-bold text-gray-600 hover:text-[#f0c961] whitespace-nowrap transition-colors tracking-wider">
                                HAKKIMIZDA
                            </Link>
                            <Link to="/iletisim" className="py-4 text-[11px] lg:text-[12px] font-bold text-gray-600 hover:text-[#f0c961] whitespace-nowrap transition-colors tracking-wider">
                                İLETİŞİM
                            </Link>
                        </nav>
                    </div>
                </div>

                {/* MOBILE MENU DRAWER */}
                <div className={`fixed inset-0 z-[100] md:hidden transition-transform duration-300 ease-in-out transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    {/* Backdrop */}
                    <div className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setIsMobileMenuOpen(false)}></div>

                    {/* Drawer Content */}
                    <div className="relative w-[300px] h-full bg-white shadow-2xl flex flex-col overflow-y-auto">
                        {/* Drawer Header */}
                        <div className="p-4 flex items-center justify-between border-b border-gray-100 bg-[#fffcf7]">
                            <span className="text-xl font-black text-[#1a1a1a] tracking-tight">MENÜ</span>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 text-gray-500 hover:text-red-500 transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Mobile Search (Inside Drawer as well, optional but user didn't explicitly ask to remove it, but they have it on Navbar now. I'll keep it just in case or remove to avoid duplicate. User said "Search Bar...Logo satırının HEMEN ALTINA". So it's on the main view. I can remove it from drawer to keep it clean, or keep it. I'll remove it from drawer to match the "clean" reference, assuming the one on navbar is enough.) */}

                        {/* Mobile Navigation Links */}
                        <nav className="flex-1 p-4 space-y-1">
                            {menuItems.map((item) => (
                                <div key={item.id} className="border-b border-gray-50 last:border-0">
                                    <div className="flex items-center justify-between py-3 group">
                                        <Link
                                            to={`/kategori/${item.slug}`}
                                            className="font-bold text-gray-800 flex-1 hover:text-[#f0c961] transition-colors text-sm"
                                            onClick={() => !item.children.length && setIsMobileMenuOpen(false)}
                                        >
                                            {item.name}
                                        </Link>
                                        {item.children.length > 0 && (
                                            <button
                                                onClick={() => toggleSubMenu(item.id)}
                                                className="p-2 text-gray-400 group-hover:text-[#f0c961] transition-colors"
                                            >
                                                <ChevronDown className={`w-4 h-4 transform transition-transform duration-300 ${openSubMenu === item.id ? 'rotate-180' : ''}`} />
                                            </button>
                                        )}
                                    </div>
                                    {/* Mobile Submenu (Accordion) */}
                                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openSubMenu === item.id ? 'max-h-96 opacity-100 mb-2' : 'max-h-0 opacity-0'}`}>
                                        <div className="pl-4 space-y-2 bg-gray-50/50 rounded-lg py-2">
                                            {item.children.map((child: any) => (
                                                <Link
                                                    key={child.id}
                                                    to={`/kategori/${child.slug}`}
                                                    className="block py-1.5 text-sm text-gray-600 hover:text-[#f0c961] flex items-center gap-2"
                                                    onClick={() => setIsMobileMenuOpen(false)}
                                                >
                                                    <ChevronRight className="w-3 h-3 text-gray-300" />
                                                    {child.name}
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <div className="pt-4 space-y-2">
                                <Link to="/products" className="block py-3 font-bold text-gray-800 border-b border-gray-100 hover:text-[#f0c961] text-sm">TÜM ÜRÜNLER</Link>
                                <Link to="/bayi-basvuru" className="block py-3 font-bold text-gray-800 border-b border-gray-100 hover:text-[#f0c961] text-sm">BAYİLİK BAŞVURUSU</Link>
                                <Link to="/hakkimizda" className="block py-3 font-bold text-gray-800 border-b border-gray-100 hover:text-[#f0c961] text-sm">HAKKIMIZDA</Link>
                                <Link to="/iletisim" className="block py-3 font-bold text-gray-800 hover:text-[#f0c961] text-sm">İLETİŞİM</Link>
                            </div>
                        </nav>

                        {/* Mobile Footer (Account) */}
                        <div className="p-4 bg-white border-t border-gray-100 mt-auto">
                            {session ? (
                                <Link to="/account" className="flex items-center gap-3 w-full p-3 bg-gray-50 rounded-lg border border-gray-100" onClick={() => setIsMobileMenuOpen(false)}>
                                    <div className="w-8 h-8 bg-[#f0c961]/20 text-[#f0c961] rounded-full flex items-center justify-center">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-900 text-sm">Hesabım</div>
                                        <div className="text-[10px] text-gray-500">Siparişlerini yönet</div>
                                    </div>
                                </Link>
                            ) : (
                                <Link to="/login" className="flex items-center justify-center gap-2 w-full py-3 bg-[#1a1a1a] text-white rounded-lg shadow hover:bg-[#333] transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                                    <User className="w-4 h-4" />
                                    <span className="font-bold text-sm">Giriş Yap / Kayıt Ol</span>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </header>
        </>
    );
}
