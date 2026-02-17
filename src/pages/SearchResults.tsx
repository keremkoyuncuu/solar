import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import ProductCard from '../components/ProductCard';
import type { Product } from '../components/ProductCard';

const SearchResults: React.FC = () => {
    const [searchParams] = useSearchParams();
    const rawQuery = searchParams.get('q') || '';
    const query = rawQuery.trim();

    const [products, setProducts] = useState<Product[]>([]);
    const [suggestedProducts, setSuggestedProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Old fetch function removed


        // Refined Fetch Function to avoid closure stale state issues logic above
        const run = async () => {
            setLoading(true);
            try {
                let results: Product[] = [];
                if (query) {
                    const { data } = await supabase
                        .from('products')
                        .select('*, product_images(url, is_primary), product_variants(id, name, base_price, stock, sku, discount_percentage, discount_start_date, discount_end_date)')
                        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
                        .eq('is_active', true);
                    results = data || [];
                }

                // Pricing Helper — unified for B2B and B2C
                const applyPricing = async (list: Product[]) => {
                    const { data: { session } } = await supabase.auth.getSession();
                    let userRole = 'b2c';
                    if (session) {
                        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
                        userRole = profile?.role || 'b2c';
                    }

                    // B2B: fetch global discount rate
                    let b2bDiscount = 0;
                    if (userRole === 'b2b') {
                        const { data: settingsData } = await supabase
                            .from('app_settings')
                            .select('value')
                            .eq('key', 'b2b_discount_percentage')
                            .maybeSingle();
                        b2bDiscount = settingsData?.value?.percentage || 0;
                    }

                    const now = new Date();
                    return list.map(p => ({
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
                };

                if (results.length > 0) {
                    const priced = await applyPricing(results);
                    setProducts(priced);
                    setSuggestedProducts([]);
                } else {
                    setProducts([]);
                    const { data: sugg } = await supabase.from('products').select('*, product_images(url, is_primary), product_variants(id, name, base_price, stock, sku, discount_percentage, discount_start_date, discount_end_date)').eq('is_active', true).limit(4);
                    if (sugg) {
                        const pricedSugg = await applyPricing(sugg);
                        setSuggestedProducts(pricedSugg);
                    }
                }

            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        run();
    }, [query]);

    return (
        <div className="bg-[#fffaf4] min-h-screen py-12">
            <div className="container mx-auto px-4">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Arama Sonuçları</h1>
                    <p className="text-gray-500">"{query}" için sonuçlar listeleniyor</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#f0c961] border-t-transparent"></div>
                    </div>
                ) : products.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {products.map(product => (
                            <div key={product.id} className="h-full">
                                <ProductCard product={product} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl p-12 text-center shadow-sm max-w-4xl mx-auto border border-gray-100">
                        <div className="text-6xl mb-4 opacity-20">🔍</div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Sonuç Bulunamadı</h3>
                        <p className="text-gray-500 mb-8">Aradığınız <strong>"{query}"</strong> kelimesine uygun ürün bulunamadı. Lütfen farklı anahtar kelimeler deneyin.</p>

                        {suggestedProducts.length > 0 && (
                            <div className="mt-12 text-left">
                                <h4 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">İlginizi Çekebilecek Ürünler</h4>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    {suggestedProducts.map(p => (
                                        <ProductCard key={p.id} product={p} />
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mt-8">
                            <Link to="/" className="inline-block bg-[#f0c961] text-[#1a1a1a] font-bold px-6 py-3 rounded-lg hover:bg-[#e0b950] transition-colors">
                                Tüm Ürünlere Dön
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchResults;
