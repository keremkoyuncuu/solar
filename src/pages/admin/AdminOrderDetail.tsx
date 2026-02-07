import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useParams, Link } from 'react-router-dom';
import { formatOrderStatus, formatDate, formatCurrency } from '../../utils/formatters';

interface OrderDetail {
    id: string;
    order_no: string;
    user_id: string;
    grand_total: number;
    status: string;
    created_at: string;
    // Guest sipariş bilgileri
    guest_name?: string;
    guest_email?: string;
    guest_phone?: string;
    // Teslimat adresi (JSON)
    shipping_address?: {
        full_name?: string;
        phone?: string;
        city?: string;
        district?: string;
        address_line?: string;
    };
    profiles: {
        email: string;
        role: string;
        phone: string | null;
        full_name?: string;
    } | null;
    order_items: {
        id: string;
        product_name_snapshot: string;
        sku_snapshot: string;
        unit_price_snapshot: number;
        quantity: number;
        line_total: number;
    }[];
}



const AdminOrderDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [updating, setUpdating] = useState<boolean>(false);

    useEffect(() => {
        const fetchOrder = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('orders')
                    .select(`
                        id, order_no, user_id, grand_total, status, created_at,
                        guest_name, guest_email, guest_phone, shipping_address,
                        profiles:user_id ( email, role, phone, full_name ),
                        order_items ( id, product_name_snapshot, sku_snapshot, unit_price_snapshot, quantity, line_total )
                    `)
                    .eq('id', id)
                    .single();

                if (error) throw error;

                // Format data to handle profiles array wrap if present
                const formatted: OrderDetail = {
                    ...data,
                    profiles: Array.isArray(data.profiles) ? data.profiles[0] : data.profiles
                };

                setOrder(formatted);
            } catch (error) {
                console.error("Error fetching order detail:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchOrder();
    }, [id]);

    const handleStatusChange = async (newStatus: string) => {
        if (!order) return;

        // Tracking Number Logic
        let trackingNumber = '';
        if (newStatus === 'shipped') {
            const input = prompt("Lütfen kargo takip numarasını giriniz:");
            if (input === null) return; // Cancelled
            trackingNumber = input;
        }

        setUpdating(true);
        try {
            // 1. Update Status in DB
            const { error } = await supabase
                .from('orders')
                .update({ status: newStatus }) // If we had a tracking_number column, we would update it here too
                .eq('id', order.id);

            if (error) throw error;

            setOrder({ ...order, status: newStatus });
            alert("Sipariş durumu güncellendi.");

            // 2. Trigger Email Notification (Non-blocking)
            supabase.functions.invoke('send-order-email', {
                body: {
                    orderId: order.id,
                    orderNo: order.order_no,
                    status: newStatus,
                    customerEmail: order.profiles?.email,
                    customerName: order.profiles?.full_name || 'Sayın Müşteri', // Assuming full_name exists or fallback
                    trackingNumber: trackingNumber,
                    grandTotal: order.grand_total
                }
            }).then(({ data, error }) => {
                if (error) console.error("Email send error:", error);
                else console.log("Email sent:", data);
            });

        } catch (error) {
            console.error("Status update error:", error);
            alert("Durum güncellenemedi.");
        } finally {
            setUpdating(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Yükleniyor...</div>;
    if (!order) return <div className="p-8 text-center text-red-500">Sipariş bulunamadı.</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <Link to="/admin/orders" className="text-gray-500 hover:text-gray-900 text-sm mb-2 inline-flex items-center transition-colors">
                            <span className="mr-1">&larr;</span> Sipariş Listesine Dön
                        </Link>
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Sipariş #{order.order_no}</h1>
                                <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                                    <span>{formatDate(order.created_at)}</span>
                                    <span className="text-gray-300">•</span>
                                    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">ID: {order.id.split('-')[0]}</span>
                                </div>
                            </div>

                            {/* Status Changer */}
                            <div className="flex flex-col items-end gap-2">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sipariş Durumu</label>
                                <div className="relative">
                                    <select
                                        value={order.status}
                                        onChange={(e) => handleStatusChange(e.target.value)}
                                        disabled={updating}
                                        className={`appearance-none pl-4 pr-10 py-2.5 rounded-lg border text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all cursor-pointer ${formatOrderStatus(order.status).color} bg-white`}
                                    >
                                        <option value="pending_payment">Ödeme Bekliyor</option>
                                        <option value="approved">Hazırlanıyor</option>
                                        <option value="shipped">Kargolandı</option>
                                        <option value="delivered">Teslim Edildi</option>
                                        <option value="cancelled">İptal Edildi</option>
                                        <option value="returned">İade Edildi</option>
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Main Content: Order Items */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                                    <h3 className="font-semibold text-gray-900">Sipariş İçeriği</h3>
                                </div>
                                <table className="w-full text-left">
                                    <thead className="bg-white border-b border-gray-100 text-xs text-gray-500 uppercase">
                                        <tr>
                                            <th className="px-6 py-3 font-medium">Ürün</th>
                                            <th className="px-6 py-3 font-medium text-center">Adet</th>
                                            <th className="px-6 py-3 font-medium text-right">Birim Fiyat</th>
                                            <th className="px-6 py-3 font-medium text-right">Toplam</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-sm">
                                        {order.order_items.map((item) => (
                                            <tr key={item.id}>
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-gray-900">{item.product_name_snapshot}</div>
                                                    <div className="text-gray-500 text-xs font-mono">{item.sku_snapshot}</div>
                                                </td>
                                                <td className="px-6 py-4 text-center">{item.quantity}</td>
                                                <td className="px-6 py-4 text-right">{formatCurrency(item.unit_price_snapshot)}</td>
                                                <td className="px-6 py-4 text-right font-medium">
                                                    {formatCurrency(item.line_total)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50 font-semibold text-gray-900">
                                        <tr>
                                            <td colSpan={3} className="px-6 py-4 text-right">Genel Toplam</td>
                                            <td className="px-6 py-4 text-right text-lg">
                                                {formatCurrency(order.grand_total)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* Sidebar: Customer Info & Address */}
                        <div className="space-y-6">
                            {/* Müşteri Bilgileri */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                <h3 className="font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    Müşteri Bilgileri
                                </h3>
                                <div className="space-y-4 text-sm">
                                    {/* İsim */}
                                    <div>
                                        <span className="block text-gray-500 text-xs uppercase tracking-wide mb-1">Ad Soyad</span>
                                        <div className="font-medium text-gray-900">
                                            {order.shipping_address?.full_name || order.guest_name || order.profiles?.full_name || '-'}
                                        </div>
                                    </div>
                                    {/* Email */}
                                    <div>
                                        <span className="block text-gray-500 text-xs uppercase tracking-wide mb-1">E-posta</span>
                                        <div className="font-medium text-gray-900">
                                            {order.guest_email || order.profiles?.email || '-'}
                                        </div>
                                    </div>
                                    {/* Telefon */}
                                    <div>
                                        <span className="block text-gray-500 text-xs uppercase tracking-wide mb-1">Telefon</span>
                                        <div className="font-medium text-gray-900">
                                            {order.shipping_address?.phone || order.guest_phone || order.profiles?.phone || '-'}
                                        </div>
                                    </div>
                                    {/* Hesap Tipi */}
                                    <div>
                                        <span className="block text-gray-500 text-xs uppercase tracking-wide mb-1">Hesap Tipi</span>
                                        <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wide">
                                            {order.user_id ? (order.profiles?.role || 'Üye') : 'Misafir'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Teslimat Adresi */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                <h3 className="font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    Teslimat Adresi
                                </h3>
                                {order.shipping_address ? (
                                    <div className="text-sm text-gray-700 space-y-2">
                                        <div className="font-medium text-gray-900">{order.shipping_address.full_name}</div>
                                        <div>{order.shipping_address.address_line}</div>
                                        <div>{order.shipping_address.district} / {order.shipping_address.city}</div>
                                        {order.shipping_address.phone && (
                                            <div className="text-gray-500 pt-2 border-t border-gray-100">
                                                📞 {order.shipping_address.phone}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-400 italic">Adres bilgisi bulunamadı</div>
                                )}
                            </div>

                            {/* Sipariş Özeti */}
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl shadow-sm border border-amber-200 p-6">
                                <h3 className="font-semibold text-amber-900 mb-4 pb-2 border-b border-amber-200 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    Sipariş Özeti
                                </h3>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-amber-700">Ürün Sayısı</span>
                                        <span className="font-medium text-amber-900">{order.order_items.length} adet</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-amber-700">Toplam Adet</span>
                                        <span className="font-medium text-amber-900">
                                            {order.order_items.reduce((acc, item) => acc + item.quantity, 0)} adet
                                        </span>
                                    </div>
                                    <div className="flex justify-between pt-3 border-t border-amber-200">
                                        <span className="font-bold text-amber-900">Genel Toplam</span>
                                        <span className="font-bold text-lg text-amber-900">{formatCurrency(order.grand_total)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminOrderDetail;
