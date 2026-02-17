import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { fetchUserRole, calculateVariantPrice } from '../lib/pricing';
import { useCurrency } from '../hooks/useCurrency';
import { TURKEY_DATA } from '../constants/turkey-data';
import SearchableSelect from '../components/SearchableSelect';

interface CheckoutItem {
    id: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    productName: string;
    product_variants: any;
}

const CheckoutPage: React.FC = () => {
    const { formatPrice, convertPrice } = useCurrency();
    const navigate = useNavigate();
    const [cartItems, setCartItems] = useState<CheckoutItem[]>([]);
    const [cartTotal, setCartTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isGuest, setIsGuest] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [guestInfo, setGuestInfo] = useState({ fullName: '', email: '', phone: '' });

    const [addresses, setAddresses] = useState<any[]>([]);
    const [selectedAddressId, setSelectedAddressId] = useState<string>('');
    const [showAddressForm, setShowAddressForm] = useState(false);
    const [newAddress, setNewAddress] = useState({
        type: 'shipping',
        full_name: '',
        phone: '',
        country: 'Türkiye',
        city: '',
        district: '',
        address_line: '',
        postal_code: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        fetchCheckoutData();
    }, []);

    const fetchCheckoutData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            let cartData;

            if (user) {
                // LOGGED IN USER
                setIsGuest(false);
                setUserId(user.id);

                // Fetch user addresses
                const { data: addressData } = await supabase
                    .from('addresses')
                    .select('*')
                    .eq('profile_id', user.id);
                setAddresses(addressData || []);

                // Fetch cart by user_id
                const { data } = await supabase
                    .from('carts')
                    .select('id')
                    .eq('profile_id', user.id)
                    .eq('status', 'active')
                    .maybeSingle();
                cartData = data;
            } else {
                // GUEST USER
                setIsGuest(true);
                setShowAddressForm(true); // Guest always needs to enter address

                const sessionId = localStorage.getItem('guest_session_id');
                if (!sessionId) {
                    setError("Sepetiniz boş. Lütfen ürün ekleyin.");
                    setLoading(false);
                    return;
                }

                // Fetch cart by session_id
                const { data } = await supabase
                    .from('carts')
                    .select('id')
                    .eq('session_id', sessionId)
                    .eq('status', 'active')
                    .maybeSingle();
                cartData = data;
            }

            if (!cartData) {
                setError("Aktif sepet yok.");
                setLoading(false);
                return;
            }

            // Fetch cart items
            const { data: itemsData } = await supabase
                .from('cart_items')
                .select(`
                    id, 
                    quantity, 
                    product_variants (
                        id, 
                        name, 
                        sku, 
                        base_price, 
                        stock,
                        discount_percentage,
                        discount_start_date,
                        discount_end_date,
                        products (
                            name, 
                            slug
                        )
                    )
                `)
                .eq('cart_id', cartData.id);

            // Price calculation
            const userRole = user ? await fetchUserRole() : 'customer';

            if (itemsData) {
                const itemsWithTotals = await Promise.all(itemsData.map(async (item: any) => {
                    const variant = item.product_variants;
                    const unitPrice = await calculateVariantPrice(
                        variant.id, variant.base_price, userRole,
                        variant.discount_percentage || 0,
                        variant.discount_start_date,
                        variant.discount_end_date
                    );

                    return {
                        ...item,
                        unitPrice,
                        lineTotal: unitPrice * item.quantity,
                        productName: variant.products?.name
                    } as CheckoutItem;
                }));
                setCartItems(itemsWithTotals);
                setCartTotal(itemsWithTotals.reduce((sum, item) => sum + (item.lineTotal || 0), 0));
            }
        } catch (err) {
            console.error(err);
            setError("Hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAddress = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isGuest) {
            // Guest does not save to DB immediately
            // Just update UI to look like it's saved or keep form open?
            // User requested inline validation.
            // If the form is required, we can just keep values in state.
            // But if they click "Save" on address form as guest, we might just hide the form?
            // Actually guest flow: Address form is always visible or we simulate save?
            // Let's assume guest enters details in the visible form directly.
            // But if I hid the form, then guest can't see it.
            // Simplified: Guest sees the form always. We don't need to "save" it to DB.
            return;
        }

        if (!userId) return;

        try {
            const { error } = await supabase.from('addresses').insert({ profile_id: userId, ...newAddress });
            if (error) throw error;
            setNewAddress({ type: 'shipping', full_name: '', phone: '', country: 'Türkiye', city: '', district: '', address_line: '', postal_code: '' });
            setShowAddressForm(false);
            const { data: addressData } = await supabase.from('addresses').select('*').eq('profile_id', userId);
            setAddresses(addressData || []);
            if (addressData && addressData.length > 0) setSelectedAddressId(addressData[addressData.length - 1].id);
        } catch (error) {
            console.error(error);
            alert("Adres eklenirken hata.");
        }
    };

    const generateOrderNo = () => `ORB-${new Date().getFullYear()}${Math.floor(1000 + Math.random() * 9000)}`;

    const handleCompleteOrder = async () => {
        setFormError(null);

        // Validation
        if (isGuest) {
            if (!guestInfo.email || !guestInfo.email.includes('@')) {
                setFormError("Lütfen geçerli bir email adresi giriniz.");
                return;
            }
            if (!guestInfo.fullName || guestInfo.fullName.length < 3) {
                setFormError("Lütfen adınızı ve soyadınızı eksiksiz giriniz.");
                return;
            }
            if (!guestInfo.phone || guestInfo.phone.length < 10) {
                setFormError("Lütfen geçerli bir telefon numarası giriniz.");
                return;
            }

            if (!newAddress.full_name || !newAddress.phone || !newAddress.city || !newAddress.district || !newAddress.address_line) {
                setFormError("Lütfen teslimat adresi bilgilerini eksiksiz doldurunuz.");
                return;
            }
        } else {
            if (!selectedAddressId) {
                setFormError("Lütfen mevcut adreslerinizden birini seçiniz veya yeni adres ekleyiniz.");
                return;
            }
        }

        if (isSubmitting) return;

        setIsSubmitting(true);
        setLoading(true);

        try {
            const userRole = !isGuest ? await fetchUserRole() : 'customer';

            // RE-FETCH ACTIVE CART
            let activeCart;

            if (isGuest) {
                const sessionId = localStorage.getItem('guest_session_id');
                const { data, error } = await supabase
                    .from('carts')
                    .select('id')
                    .eq('session_id', sessionId)
                    .eq('status', 'active')
                    .maybeSingle();
                if (error || !data) throw new Error("Aktif sepet bulunamadı.");
                activeCart = data;
            } else {
                const { data, error } = await supabase
                    .from('carts')
                    .select('id')
                    .eq('profile_id', userId)
                    .eq('status', 'active')
                    .maybeSingle();
                if (error || !data) throw new Error("Aktif sepet bulunamadı.");
                activeCart = data;
            }

            // RE-FETCH CART ITEMS
            const { data: dbItems, error: dbItemsError } = await supabase
                .from('cart_items')
                .select(`
                    quantity,
                    variant_id,
                    product_variants (
                        id, name, sku, stock, base_price, is_active,
                        discount_percentage,
                        discount_start_date,
                        discount_end_date,
                        products (
                            id,
                            name, 
                            slug
                        )
                    )
                `)
                .eq('cart_id', activeCart.id);

            if (dbItemsError || !dbItems || dbItems.length === 0) throw new Error("Sepetiniz boş.");

            // VALIDATION & PRICE CALCULATION
            const finalOrderItems = [];
            let calculatedSubtotal = 0;

            for (const item of dbItems) {
                const variantRaw = item.product_variants;
                const variant = Array.isArray(variantRaw) ? variantRaw[0] : variantRaw;
                const qty = item.quantity;

                if (!variant) throw new Error("Sepetteki bir ürünün kaydı bulunamadı.");
                if (!variant.is_active) throw new Error(`"${variant.name}" ürünü şu anda satışa kapalı.`);
                if (variant.stock < qty) throw new Error(`"${variant.name}" için yeterli stok yok. Mevcut: ${variant.stock}`);

                const unitPriceUSD = await calculateVariantPrice(
                    variant.id, variant.base_price, userRole,
                    variant.discount_percentage || 0,
                    variant.discount_start_date,
                    variant.discount_end_date
                );
                const lineTotalUSD = unitPriceUSD * qty;

                // CONVERT TO TL AT THIS POINT TO ENSURE ORDER IS IN TL
                const unitPriceTL = convertPrice(unitPriceUSD);
                const lineTotalTL = convertPrice(lineTotalUSD);

                calculatedSubtotal += lineTotalTL;

                finalOrderItems.push({
                    variant_id: variant.id,
                    product_id: (Array.isArray(variant.products) ? variant.products[0] : variant.products)?.id,
                    quantity: qty,
                    unit_price_snapshot: unitPriceTL,
                    line_total: lineTotalTL,
                    product_name_snapshot: variant.name,
                    sku_snapshot: variant.sku || '',
                    attributes_snapshot: {}
                });
            }

            // CREATE ORDER
            const orderNo = generateOrderNo();

            // Prepare shipping address JSONB
            let shippingAddress;
            if (isGuest) {
                shippingAddress = {
                    full_name: newAddress.full_name || guestInfo.fullName,
                    phone: newAddress.phone || guestInfo.phone,
                    address_line: newAddress.address_line,
                    city: newAddress.city,
                    district: newAddress.district,
                    country: newAddress.country,
                    postal_code: newAddress.postal_code
                };
            } else {
                const selectedAddr = addresses.find(a => a.id === selectedAddressId);
                if (selectedAddr) {
                    shippingAddress = {
                        full_name: selectedAddr.full_name,
                        phone: selectedAddr.phone,
                        address_line: selectedAddr.address_line,
                        city: selectedAddr.city,
                        district: selectedAddr.district,
                        country: selectedAddr.country,
                        postal_code: selectedAddr.postal_code
                    };
                }
            }

            const orderPayload: any = {
                order_no: orderNo,
                status: 'pending_payment',
                currency: 'TRY',
                subtotal: calculatedSubtotal,
                discount_total: 0,
                shipping_total: 0,
                grand_total: calculatedSubtotal,
                shipping_address: shippingAddress
            };

            if (isGuest) {
                orderPayload.is_guest = true;
                orderPayload.guest_email = guestInfo.email;
                orderPayload.guest_name = guestInfo.fullName;
                orderPayload.guest_phone = guestInfo.phone;
            } else {
                orderPayload.user_id = userId;
                orderPayload.is_guest = false;
            }

            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .insert(orderPayload)
                .select()
                .single();

            if (orderError) throw orderError;

            const itemsPayload = finalOrderItems.map(item => ({
                order_id: orderData.id,
                ...item
            }));

            const { error: itemsError } = await supabase.from('order_items').insert(itemsPayload);
            if (itemsError) throw itemsError;

            // CLOSE CART
            await supabase
                .from('carts')
                .update({ status: 'converted', updated_at: new Date().toISOString() })
                .eq('id', activeCart.id);

            if (isGuest) {
                localStorage.removeItem('guest_session_id');
            }

            navigate(`/payment/${orderData.id}`);

        } catch (error: any) {
            console.error("Sipariş Hatası:", error);
            setFormError(error.message || "Sipariş oluşturulurken beklenmedik bir hata oluştu.");
            setLoading(false);
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="flex justify-center h-screen items-center bg-[#fefcf5]"><div className="animate-spin h-12 w-12 border-4 border-[#6D4C41] rounded-full border-t-transparent"></div></div>;

    if (error && cartItems.length === 0) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-[#fefcf5]">
                <div className="max-w-md w-full bg-white p-12 rounded-2xl shadow-lg text-center">
                    <div className="text-6xl mb-6">🛒</div>
                    <h2 className="text-2xl font-bold mb-4">Sepetiniz Boş</h2>
                    <p className="text-gray-500 mb-8">{error}</p>
                    <Link to="/products" className="bg-[#6D4C41] text-white px-8 py-4 rounded-lg font-bold hover:bg-[#5D4037] transition-colors inline-block">
                        Alışverişe Başla
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8f9fa] py-12">
            <div className="container mx-auto px-4 max-w-7xl">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Sipariş Bilgileri</h1>
                    <p className="text-gray-500">
                        {isGuest ? 'Misafir olarak alışverişi tamamlayabilirsiniz.' : 'Lütfen teslimat adresinizi seçin.'}
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Address/Info */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* GUEST INFO SECTION */}
                        {isGuest && (
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                                <h2 className="text-xl font-bold text-gray-900 mb-6">İletişim Bilgileriniz</h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">Email *</label>
                                        <input
                                            type="email"
                                            required
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6D4C41] focus:border-transparent"
                                            value={guestInfo.email}
                                            onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })}
                                            placeholder="ornek@email.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">Ad Soyad *</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6D4C41] focus:border-transparent"
                                            value={guestInfo.fullName}
                                            onChange={(e) => setGuestInfo({ ...guestInfo, fullName: e.target.value })}
                                            placeholder="Adınız Soyadınız"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">Telefon *</label>
                                        <input
                                            type="tel"
                                            required
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6D4C41] focus:border-transparent"
                                            value={guestInfo.phone}
                                            onChange={(e) => setGuestInfo({ ...guestInfo, phone: e.target.value })}
                                            placeholder="05XX XXX XX XX"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ADDRESS SECTION */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <h2 className="text-xl font-bold text-gray-900 mb-6">Teslimat Adresi</h2>

                            {!isGuest && addresses.length > 0 && !showAddressForm && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    {addresses.map((addr) => (
                                        <div
                                            key={addr.id}
                                            onClick={() => setSelectedAddressId(addr.id)}
                                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedAddressId === addr.id
                                                ? 'border-[#6D4C41] bg-[#6D4C41]/5'
                                                : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <div className="font-bold text-gray-900 mb-2">{addr.full_name}</div>
                                            <div className="text-sm text-gray-600">
                                                {addr.address_line}<br />
                                                {addr.district} / {addr.city}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {(!isGuest && (showAddressForm || addresses.length === 0)) || isGuest ? (
                                <form onSubmit={handleCreateAddress} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 mb-2 block">Ad Soyad *</label>
                                            <input
                                                type="text"
                                                required
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6D4C41]"
                                                value={newAddress.full_name}
                                                onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 mb-2 block">Telefon *</label>
                                            <input
                                                type="tel"
                                                required
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6D4C41]"
                                                value={newAddress.phone}
                                                onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">Açık Adres *</label>
                                        <textarea
                                            rows={3}
                                            required
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6D4C41]"
                                            value={newAddress.address_line}
                                            onChange={(e) => setNewAddress({ ...newAddress, address_line: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 mb-2 block">İl *</label>
                                            <SearchableSelect
                                                options={TURKEY_DATA.map(c => c.name).sort()}
                                                value={newAddress.city}
                                                onChange={(val) => setNewAddress({ ...newAddress, city: val, district: '' })}
                                                placeholder="İl Seçiniz"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 mb-2 block">İlçe *</label>
                                            <SearchableSelect
                                                options={newAddress.city ? (TURKEY_DATA.find(c => c.name === newAddress.city)?.districts.sort() || []) : []}
                                                value={newAddress.district}
                                                onChange={(val) => setNewAddress({ ...newAddress, district: val })}
                                                placeholder="İlçe Seçiniz"
                                                disabled={!newAddress.city}
                                            />
                                        </div>
                                    </div>

                                    {!isGuest && (
                                        <div className="flex justify-end gap-3">
                                            {addresses.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAddressForm(false)}
                                                    className="px-6 py-2 text-gray-600 hover:text-gray-900"
                                                >
                                                    İptal
                                                </button>
                                            )}
                                            <button
                                                type="submit"
                                                className="px-6 py-2 bg-[#6D4C41] text-white rounded-lg font-medium hover:bg-[#5D4037]"
                                            >
                                                Kaydet
                                            </button>
                                        </div>
                                    )}
                                </form>
                            ) : (
                                !isGuest && (
                                    <button
                                        onClick={() => setShowAddressForm(true)}
                                        className="text-[#6D4C41] font-medium hover:underline"
                                    >
                                        + Yeni Adres Ekle
                                    </button>
                                )
                            )}
                        </div>
                    </div>

                    {/* Right: Summary */}
                    <div className="lg:col-span-1">
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 sticky top-4">
                            <h3 className="font-bold text-gray-900 mb-6 text-lg">Sipariş Özeti</h3>

                            <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
                                {cartItems.map(item => (
                                    <div key={item.id} className="flex justify-between text-sm">
                                        <div className="flex-1">
                                            <div className="font-medium text-gray-900">{item.product_variants.name}</div>
                                            <div className="text-gray-500 text-xs">x{item.quantity}</div>
                                        </div>
                                        <div className="font-bold text-gray-900">{formatPrice(item.lineTotal || 0)}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-gray-200 pt-4 space-y-2 mb-6">
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>Ara Toplam</span>
                                    <span className="font-medium">{formatPrice(cartTotal)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>Kargo</span>
                                    <span className="font-medium text-gray-900">Alıcı Ödemeli</span>
                                </div>
                            </div>

                            <div className="flex justify-between text-xl font-bold text-gray-900 mb-6 pt-4 border-t-2">
                                <span>Toplam</span>
                                <span className="text-[#6D4C41]">{formatPrice(cartTotal)}</span>
                            </div>

                            {formError && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2">
                                    <span className="text-lg">⚠️</span>
                                    <span>{formError}</span>
                                </div>
                            )}

                            <button
                                onClick={handleCompleteOrder}
                                disabled={isSubmitting}
                                className="w-full bg-[#6D4C41] text-white font-bold py-4 rounded-lg shadow-md hover:bg-[#5D4037] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? 'İşleniyor...' : 'Siparişi Tamamla'}
                            </button>

                            <p className="text-xs text-gray-400 text-center mt-4">
                                Siparişinizi tamamlayarak Mesafeli Satış Sözleşmesi'ni kabul etmiş olursunuz.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CheckoutPage;
