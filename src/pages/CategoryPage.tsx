import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import ProductCard from '../components/ProductCard';
import type { Product } from '../components/ProductCard';
import { ArrowUpDown } from 'lucide-react';

interface Category {
    id: string; // UUID
    parent_id: string | null;
    name: string;
    slug: string;
    description?: string;
}

// interface Product removed as it is imported

const CategoryPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const [category, setCategory] = useState<Category | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [originalProducts, setOriginalProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [allCategories, setAllCategories] = useState<Category[]>([]);
    const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
    const [sortOption, setSortOption] = useState<string>('price-asc'); // Default: Ucuzdan Pahalıya

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Fetch all categories to build tree client-side (efficient for small catalog)
                const { data: catsData } = await supabase
                    .from('categories')
                    .select('id, parent_id, name, slug')
                    .eq('is_active', true);

                const cats = catsData || [];
                setAllCategories(cats);

                // 2. Find current category
                const currentCat = cats.find(c => c.slug === slug);
                if (!currentCat) {
                    setCategory(null);
                    setLoading(false);
                    return;
                }
                setCategory(currentCat);

                // 3. Find all descendant IDs (Recursive)
                const getDescendantIds = (parentId: string): string[] => {
                    const children = cats.filter(c => c.parent_id === parentId);
                    let ids = children.map(c => c.id);
                    children.forEach(child => {
                        ids = [...ids, ...getDescendantIds(child.id)];
                    });
                    return ids;
                };

                const targetIds = [currentCat.id, ...getDescendantIds(currentCat.id)];

                // 4. Fetch Products for these categories (including discount fields)
                const { data: productsData } = await supabase
                    .from('products')
                    .select('*, product_images(url, is_primary), product_variants(id, name, base_price, stock, discount_percentage, discount_start_date, discount_end_date)')
                    .in('category_id', targetIds)
                    .eq('is_active', true);

                let finalProducts = productsData || [];

                // --- B2B PRICING LOGIC START ---
                // Check User Role
                const { data: { session } } = await supabase.auth.getSession();
                let userRole = 'b2c';

                if (session) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', session.user.id)
                        .maybeSingle();
                    userRole = profile?.role || 'b2c';
                }

                // If B2B, fetch global discount rate
                let b2bDiscount = 0;
                if (userRole === 'b2b') {
                    const { data: settingsData } = await supabase
                        .from('app_settings')
                        .select('value')
                        .eq('key', 'b2b_discount_percentage')
                        .maybeSingle();
                    b2bDiscount = settingsData?.value?.percentage || 0;
                }

                // Apply pricing + discounts (unified for B2B and B2C)
                const now = new Date();
                finalProducts = finalProducts.map(p => ({
                    ...p,
                    product_variants: (p.product_variants || []).map((v: any) => {
                        if (userRole === 'b2b') {
                            const b2bPrice = v.base_price * (1 - b2bDiscount / 100);
                            return {
                                ...v,
                                price: b2bPrice,
                                originalPrice: v.base_price,
                                hasDiscount: b2bDiscount > 0,
                                discount_percentage: b2bDiscount
                            };
                        }
                        const discountActive = (v.discount_percentage || 0) > 0 &&
                            (!v.discount_start_date || new Date(v.discount_start_date) <= now) &&
                            (!v.discount_end_date || new Date(v.discount_end_date) >= now);
                        const finalPrice = discountActive
                            ? v.base_price * (1 - v.discount_percentage / 100)
                            : v.base_price;
                        return {
                            ...v,
                            price: finalPrice,
                            originalPrice: v.base_price,
                            hasDiscount: discountActive,
                            discount_percentage: v.discount_percentage || 0
                        };
                    })
                }));
                // --- B2B PRICING LOGIC END ---

                // Calculate display price for each product to make sorting easier
                finalProducts = finalProducts.map(p => {
                    const prices = (p.product_variants || []).map((v: any) => v.price || 0);
                    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
                    return { ...p, displayPrice: minPrice };
                });

                setOriginalProducts(finalProducts);
                // Initial setProducts will be handled by the useEffect dependent on originalProducts

            } catch (error) {
                console.error("Error fetching category data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [slug]);

    // Sorting Logic
    useEffect(() => {
        if (originalProducts.length === 0) {
            setProducts([]);
            return;
        }

        let sorted = [...originalProducts];

        switch (sortOption) {
            case 'price-asc':
                sorted.sort((a: any, b: any) => a.displayPrice - b.displayPrice);
                break;
            case 'price-desc':
                sorted.sort((a: any, b: any) => b.displayPrice - a.displayPrice);
                break;
            case 'newest':
                sorted.sort((a, b) => {
                    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                    return dateB - dateA;
                });
                break;
            case 'default':
            default:
                // Original order (usually DB ID or as fetched)
                break;
        }

        setProducts(sorted);
    }, [sortOption, originalProducts]);

    if (loading) return <div className="min-h-[60vh] flex items-center justify-center">Yükleniyor...</div>;
    if (!category) return <div className="min-h-[60vh] flex items-center justify-center text-xl">Kategori bulunamadı.</div>;

    // Breadcrumb Helper
    const getBreadcrumbs = (current: Category): Category[] => {
        const crumbs = [current];
        let parentId = current.parent_id;
        while (parentId) {
            const parent = allCategories.find(c => c.id === parentId);
            if (parent) {
                crumbs.unshift(parent);
                parentId = parent.parent_id;
            } else {
                break;
            }
        }
        return crumbs;
    };

    const breadcrumbs = getBreadcrumbs(category);

    // Sidebar: Show Subcategories or Siblings
    // Logic: If has children, show children. If no children, show siblings (same parent).
    const children = allCategories.filter(c => c.parent_id === category.id);
    const siblings = category.parent_id
        ? allCategories.filter(c => c.parent_id === category.parent_id)
        : allCategories.filter(c => c.parent_id === null);

    const sidebarCategories = children.length > 0 ? children : siblings;
    const sidebarTitle = children.length > 0 ? category.name : (category.parent_id ? 'Diğer Kategoriler' : 'Ana Kategoriler');


    return (
        <div className="bg-gray-50 min-h-screen pb-20">
            {/* Header / Title Section */}
            <div className="bg-white shadow-sm border-b border-gray-100">
                <div className="container mx-auto px-4 py-8">
                    <nav className="text-xs text-gray-500 mb-4 flex gap-2 items-center flex-wrap">
                        <Link to="/" className="hover:text-[#f0c961]">Ana Sayfa</Link>
                        {breadcrumbs.map(crumb => (
                            <React.Fragment key={crumb.id}>
                                <span>/</span>
                                <Link to={`/kategori/${crumb.slug}`} className={`hover:text-[#f0c961] ${crumb.id === category.id ? 'font-bold text-gray-800' : ''}`}>
                                    {crumb.name}
                                </Link>
                            </React.Fragment>
                        ))}
                    </nav>

                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <h1 className="text-3xl font-bold text-gray-900">{category.name}</h1>

                        <div className="flex items-center gap-4">
                            {/* Desktop Sorting Dropdown */}
                            <div className="relative group min-w-[180px]">
                                <div className="flex items-center gap-2 mb-1">
                                    <ArrowUpDown size={14} className="text-gray-400" />
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">SIRALAMA</span>
                                </div>
                                <select
                                    value={sortOption}
                                    onChange={(e) => setSortOption(e.target.value)}
                                    className="w-full bg-white border border-gray-200 text-gray-700 py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f0c961] focus:border-transparent text-sm appearance-none cursor-pointer"
                                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: '2.5rem' }}
                                >
                                    <option value="price-asc">Ucuzdan Pahalıya</option>
                                    <option value="price-desc">Pahalıdan Ucuza</option>
                                    <option value="newest">En Yeni</option>
                                    <option value="default">Varsayılan</option>
                                </select>
                            </div>

                            {/* Mobile Filter Toggle */}
                            <button
                                onClick={() => setIsMobileFiltersOpen(true)}
                                className="lg:hidden flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm text-sm font-bold text-gray-700 hover:bg-gray-50 h-[42px] mt-auto"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                                Filtrele
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Desktop Sidebar */}
                <aside className="hidden lg:block relative">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sticky top-28">
                        <h3 className="font-bold text-gray-900 mb-4 text-sm uppercase tracking-wider border-b border-gray-100 pb-2">{sidebarTitle}</h3>
                        <ul className="space-y-2">
                            {sidebarCategories.map(cat => (
                                <li key={cat.id}>
                                    <Link
                                        to={`/kategori/${cat.slug}`}
                                        className={`block text-sm py-1 transition-colors ${cat.id === category.id ? 'text-[#f0c961] font-bold' : 'text-gray-600 hover:text-[#f0c961]'}`}
                                    >
                                        {cat.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </aside>

                {/* Mobile Sidebar Modal/Drawer */}
                {isMobileFiltersOpen && (
                    <div className="fixed inset-0 z-[100] lg:hidden">
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileFiltersOpen(false)}></div>
                        <div className="absolute bottom-0 left-0 w-full bg-white rounded-t-3xl shadow-2xl p-6 max-h-[80vh] overflow-y-auto animate-slide-up-mobile">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-gray-900">{sidebarTitle}</h3>
                                <button onClick={() => setIsMobileFiltersOpen(false)} className="p-2 bg-gray-100 rounded-full text-gray-500">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <ul className="space-y-3">
                                {sidebarCategories.map(cat => (
                                    <li key={cat.id}>
                                        <Link
                                            to={`/kategori/${cat.slug}`}
                                            onClick={() => setIsMobileFiltersOpen(false)}
                                            className={`block p-3 rounded-lg border transition-colors ${cat.id === category.id ? 'bg-[#fffaf4] border-[#f0c961] text-[#1a1a1a] font-bold' : 'border-gray-100 text-gray-600 hover:border-gray-300'}`}
                                        >
                                            {cat.name}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {/* Product Grid */}
                <div className="lg:col-span-3">
                    <div className="mb-4 lg:hidden flex justify-between items-center">
                        <span className="text-sm text-gray-500">{products.length} Ürün Listelendi</span>
                    </div>

                    {products.length === 0 ? (
                        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Ürün Bulunamadı</h3>
                            <p className="text-gray-500">Bu kategoride henüz ürün bulunmuyor.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                            {products.map(product => (
                                <div key={product.id} className="h-full">
                                    <ProductCard product={product} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CategoryPage;
