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
    payment_method?: string;
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
                        id, order_no, user_id, grand_total, status, created_at, payment_method,
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
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <Link to="/admin/orders" className="text-gray-500 hover:text-gray-900 text-sm inline-flex items-center group">
                            <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span> Sipariş Listesine Dön
                        </Link>
                        <div className="text-right">
                            <span className="text-xs text-gray-500 block mb-1">Sipariş Tarihi</span>
                            <span className="font-medium text-gray-900">{formatDate(order.created_at)}</span>
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-gray-100">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">Sipariş #{order.order_no}</h1>
                            <div className="flex items-center gap-2">
                                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${formatOrderStatus(order.status).color}`}>
                                    {formatOrderStatus(order.status).label}
                                </span>
                                {order.user_id ? (
                                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                        Üye Müşteri
                                    </span>
                                ) : (
                                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-50 text-gray-600 border border-gray-200">
                                        Misafir Müşteri
                                    </span>
                                )}
                                {order.payment_method === 'eft' && (
                                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                        🏦 Havale/EFT
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 min-w-[300px]">
                            <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Sipariş Durumunu Güncelle</label>
                            <div className="flex gap-2">
                                <select
                                    value={order.status}
                                    onChange={(e) => handleStatusChange(e.target.value)}
                                    disabled={updating}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                >
                                    <option value="pending_payment">Ödeme Bekliyor</option>
                                    <option value="pending_approval">Havale Onayı Bekliyor</option>
                                    <option value="paid">Ödeme Alındı</option>
                                    <option value="preparing">Hazırlanıyor</option>
                                    <option value="shipped">Kargolandı</option>
                                    <option value="delivered">Teslim Edildi</option>
                                    <option value="cancelled">İptal Edildi</option>
                                    <option value="refunded">İade Edildi</option>
                                </select>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                Durum değişikliği müşteriye e-posta ile bildirilir.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                        {/* Müşteri Bilgileri */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                Müşteri Bilgileri
                            </h3>
                            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                <div>
                                    <span className="block text-xs text-gray-500">Ad Soyad</span>
                                    <span className="font-medium text-gray-900 block">{customerName}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-gray-500">E-posta</span>
                                    <a href={`mailto:${customerEmail}`} className="font-medium text-indigo-600 hover:text-indigo-800 block break-all">{customerEmail}</a>
                                </div>
                                <div>
                                    <span className="block text-xs text-gray-500">Telefon</span>
                                    <a href={`tel:${customerPhone}`} className="font-medium text-gray-900 block">{customerPhone}</a>
                                </div>
                            </div>
                        </div>

                        {/* Teslimat Adresi */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Teslimat Adresi
                            </h3>
                            <div className="bg-gray-50 rounded-lg p-4 h-full">
                                {order.shipping_address ? (
                                    <div className="text-gray-900 space-y-1">
                                        <p className="font-medium">{order.shipping_address.full_name}</p>
                                        <p className="text-sm leading-relaxed">{order.shipping_address.address_line}</p>
                                        <p className="text-sm font-medium mt-2">{order.shipping_address.district} / {order.shipping_address.city}</p>
                                        {order.shipping_address.phone && (
                                            <p className="text-sm text-gray-500 mt-2 pt-2 border-t border-gray-200">
                                                İletişim: {order.shipping_address.phone}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-gray-400 italic text-sm">Adres bilgisi bulunamadı</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sipariş İçeriği */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-900">Sipariş İçeriği</h3>
                        <span className="text-sm text-gray-500">{order.order_items.length} Ürün</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-white border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Ürün Detayı</th>
                                    <th className="px-6 py-3 font-medium text-center">Birim Fiyat</th>
                                    <th className="px-6 py-3 font-medium text-center">Adet</th>
                                    <th className="px-6 py-3 font-medium text-right">Toplam</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {order.order_items.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{item.product_name_snapshot}</div>
                                            <div className="text-gray-500 text-xs mt-0.5 font-mono bg-gray-100 inline-block px-1.5 py-0.5 rounded">
                                                SKU: {item.sku_snapshot}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-600">
                                            {formatCurrency(item.unit_price_snapshot)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center justify-center bg-gray-100 text-gray-800 font-bold px-2.5 py-0.5 rounded text-xs">
                                                {item.quantity}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-gray-900">
                                            {formatCurrency(item.line_total)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                        <div className="flex flex-col items-end gap-2">
                            <div className="flex justify-between w-full md:w-64 text-sm text-gray-600">
                                <span>Ara Toplam</span>
                                <span>{formatCurrency(order.grand_total / 1.2)}</span>
                            </div>
                            <div className="flex justify-between w-full md:w-64 text-sm text-gray-600">
                                <span>KDV (%20)</span>
                                <span>{formatCurrency(order.grand_total - (order.grand_total / 1.2))}</span>
                            </div>
                            <div className="w-full md:w-64 border-t border-gray-200 my-1"></div>
                            <div className="flex justify-between w-full md:w-64 text-lg font-bold text-gray-900">
                                <span>Genel Toplam</span>
                                <span>{formatCurrency(order.grand_total)}</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AdminOrderDetail;
