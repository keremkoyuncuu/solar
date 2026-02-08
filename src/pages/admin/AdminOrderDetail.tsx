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
    guest_name?: string;
    guest_email?: string;
    guest_phone?: string;
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

        let trackingNumber = '';
        if (newStatus === 'shipped') {
            const input = prompt("Lütfen kargo takip numarasını giriniz:");
            if (input === null) return;
            trackingNumber = input;
        }

        setUpdating(true);
        try {
            const updatePayload: any = { status: newStatus };
            if (newStatus === 'shipped' && trackingNumber) {
                updatePayload.tracking_number = trackingNumber;
            }

            const { error } = await supabase
                .from('orders')
                .update(updatePayload)
                .eq('id', order.id);

            if (error) throw error;

            setOrder({ ...order, status: newStatus });
            alert("Sipariş durumu güncellendi.");

            supabase.functions.invoke('send-order-email', {
                body: {
                    orderId: order.id,
                    orderNo: order.order_no,
                    status: newStatus,
                    customerEmail: order.profiles?.email,
                    customerName: order.profiles?.full_name || 'Sayın Müşteri',
                    trackingNumber: trackingNumber,
                    grandTotal: order.grand_total
                }
            }).then(({ error }) => {
                if (error) console.error("Email send error:", error);
            });

        } catch (error: any) {
            console.error("Status update error:", error);
            alert(`Durum güncellenemedi: ${error.message || error}`);
        } finally {
            setUpdating(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Yükleniyor...</div>;
    if (!order) return <div className="p-8 text-center text-red-500">Sipariş bulunamadı.</div>;

    const customerName = order.shipping_address?.full_name || order.guest_name || order.profiles?.full_name || '-';
    const customerEmail = order.guest_email || order.profiles?.email || '-';
    const customerPhone = order.shipping_address?.phone || order.guest_phone || order.profiles?.phone || '-';

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Header Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <Link to="/admin/orders" className="text-gray-500 hover:text-gray-900 text-sm mb-4 inline-flex items-center">
                        <span className="mr-2">←</span> Sipariş Listesine Dön
                    </Link>

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mt-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Sipariş #{order.order_no}</h1>
                            <p className="text-sm text-gray-500 mt-1">{formatDate(order.created_at)}</p>
                        </div>

                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Sipariş Durumu</label>
                            <select
                                value={order.status}
                                onChange={(e) => handleStatusChange(e.target.value)}
                                disabled={updating}
                                className={`px-4 py-2 rounded-lg border text-sm font-bold ${formatOrderStatus(order.status).color} bg-white`}
                            >
                                <option value="pending_payment">Ödeme Bekliyor</option>
                                <option value="paid">Ödeme Alındı</option>
                                <option value="preparing">Hazırlanıyor</option>
                                <option value="shipped">Kargolandı</option>
                                <option value="delivered">Teslim Edildi</option>
                                <option value="cancelled">İptal Edildi</option>
                                <option value="refunded">İade Edildi</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Müşteri Bilgileri */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Müşteri Bilgileri
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <span className="block text-xs text-gray-500 uppercase mb-1">Ad Soyad</span>
                            <p className="font-medium text-gray-900">{customerName}</p>
                        </div>
                        <div>
                            <span className="block text-xs text-gray-500 uppercase mb-1">E-posta</span>
                            <p className="font-medium text-gray-900">{customerEmail}</p>
                        </div>
                        <div>
                            <span className="block text-xs text-gray-500 uppercase mb-1">Telefon</span>
                            <p className="font-medium text-gray-900">{customerPhone}</p>
                        </div>
                        <div>
                            <span className="block text-xs text-gray-500 uppercase mb-1">Hesap Tipi</span>
                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                                {order.user_id ? 'Üye' : 'Misafir'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Teslimat Adresi */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Teslimat Adresi
                    </h3>
                    {order.shipping_address ? (
                        <div className="text-gray-700 space-y-1">
                            <p className="font-medium">{order.shipping_address.full_name}</p>
                            <p>{order.shipping_address.address_line}</p>
                            <p>{order.shipping_address.district} / {order.shipping_address.city}</p>
                            {order.shipping_address.phone && <p className="text-gray-500 mt-2">📞 {order.shipping_address.phone}</p>}
                        </div>
                    ) : (
                        <p className="text-gray-400 italic">Adres bilgisi bulunamadı</p>
                    )}
                </div>

                {/* Sipariş İçeriği */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b bg-gray-50">
                        <h3 className="font-semibold text-gray-900">Sipariş İçeriği</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-white border-b text-xs text-gray-500 uppercase">
                                <tr>
                                    <th className="px-6 py-3">Ürün</th>
                                    <th className="px-6 py-3 text-center">Adet</th>
                                    <th className="px-6 py-3 text-right">Birim Fiyat</th>
                                    <th className="px-6 py-3 text-right">Toplam</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y text-sm">
                                {order.order_items.map((item) => (
                                    <tr key={item.id}>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{item.product_name_snapshot}</div>
                                            <div className="text-gray-500 text-xs">{item.sku_snapshot}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center">{item.quantity}</td>
                                        <td className="px-6 py-4 text-right">{formatCurrency(item.unit_price_snapshot)}</td>
                                        <td className="px-6 py-4 text-right font-medium">{formatCurrency(item.line_total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-6 py-4 bg-gray-50 border-t flex justify-between items-center">
                        <span className="font-semibold text-gray-900">Genel Toplam</span>
                        <span className="text-xl font-bold text-gray-900">{formatCurrency(order.grand_total)}</span>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AdminOrderDetail;
