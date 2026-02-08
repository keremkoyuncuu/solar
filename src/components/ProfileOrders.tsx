import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ChevronDown, ChevronUp, Package, Clock, CheckCircle, XCircle, Truck } from 'lucide-react';
import { formatOrderStatus, formatDate, formatCurrency } from '../utils/formatters';

interface ProfileOrdersProps {
    userId: string;
}

interface OrderItem {
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    product_name_snapshot?: string;
    products?: {
        name: string;
        product_images: {
            url: string;
        }[];
    } | null;
}

interface Order {
    id: string;
    order_no?: string;
    user_id: string;
    created_at: string;
    status: string;
    grand_total: number;
    tracking_number?: string;
    order_items: OrderItem[];
}

const ProfileOrders: React.FC<ProfileOrdersProps> = ({ userId }) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

    useEffect(() => {
        if (userId) {
            fetchOrders();
        }
    }, [userId]);

    const fetchOrders = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (
                    *,
                    products (
                        name,
                        product_images (
                           url
                        )
                    )
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching orders:', error);
        } else {
            setOrders(data || []);
        }
        setLoading(false);
    };

    const toggleOrder = (orderId: string) => {
        setExpandedOrder(expandedOrder === orderId ? null : orderId);
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending':
            case 'pending_payment': return <Clock className="w-4 h-4" />;
            case 'processing':
            case 'processed':
            case 'approved': return <Package className="w-4 h-4" />;
            case 'shipped': return <Truck className="w-4 h-4" />;
            case 'delivered': return <CheckCircle className="w-4 h-4" />;
            case 'cancelled': return <XCircle className="w-4 h-4" />;
            default: return <Clock className="w-4 h-4" />;
        }
    };

    if (loading) return <div className="text-center py-10 text-gray-400">Yükleniyor...</div>;

    if (orders.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Package className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Henüz siparişiniz yok</h3>
                <p className="text-gray-500 mb-6">Sipariş verdiğinizde buradan takip edebilirsiniz.</p>
                <a href="/products" className="inline-block px-6 py-2 bg-[#f0c961] hover:bg-[#e0b850] text-black font-bold rounded-lg transition-colors">
                    Alışverişe Başla
                </a>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Sipariş Geçmişim</h2>
            {orders.map((order) => (
                <div key={order.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    {/* Header */}
                    <div className="p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer bg-gray-50/50" onClick={() => toggleOrder(order.id)}>
                        <div className="flex items-center gap-4 md:gap-8 flex-1">
                            <div>
                                <div className="text-xs text-gray-500 uppercase font-bold mb-1">Sipariş Tarihi</div>
                                <div className="font-medium text-gray-900">
                                    {formatDate(order.created_at)}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500 uppercase font-bold mb-1">Sipariş No</div>
                                <div className="font-mono text-gray-900">#{order.order_no || (order.id || '').slice(0, 8)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500 uppercase font-bold mb-1">Tutar</div>
                                <div className="font-bold text-[#1a1a1a]">
                                    {formatCurrency(order.grand_total)}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-bold ${formatOrderStatus(order.status).color}`}>
                                {getStatusIcon(order.status)}
                                <span>{formatOrderStatus(order.status).label}</span>
                            </div>
                            <button className="text-gray-400 hover:text-gray-600 transition-colors">
                                {expandedOrder === order.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                        </div>

                        {/* Kargo Takip Numarası */}
                        {order.tracking_number && ['shipped', 'delivered', 'kargolandi', 'teslim_edildi'].includes(order.status) && (
                            <div className="w-full px-4 pb-4 md:px-6 md:pb-4 bg-gray-50/50">
                                <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                    <Truck className="w-5 h-5 text-purple-600" />
                                    <div>
                                        <span className="text-xs text-purple-600 font-bold block">Kargo Takip No:</span>
                                        <span className="font-mono font-bold text-purple-800">{order.tracking_number}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Details (Accordion) */}
                    {expandedOrder === order.id && (
                        <div className="border-t border-gray-100 p-4 md:p-6 bg-white animate-fade-in">
                            <h4 className="font-bold text-sm text-gray-700 mb-4">Sipariş İçeriği</h4>
                            <div className="space-y-4">
                                {order.order_items.map((item) => (
                                    <div key={item.id} className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                                        <div className="w-16 h-16 bg-white border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                                            {item.products?.product_images?.[0]?.url ? (
                                                <img
                                                    src={item.products.product_images[0].url}
                                                    alt={item.products.name}
                                                    loading="lazy"
                                                    width={64}
                                                    height={64}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs text-center p-1">Görsel Yok</div>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-bold text-gray-900 text-sm line-clamp-1">
                                                {item.products?.name || item.product_name_snapshot || 'Ürün Bilgisine Ulaşılamadı'}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">Stok Kodu: {(item.product_id || '').slice(0, 6)}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-gray-900">
                                                {formatCurrency(item.line_total || item.unit_price)}
                                            </div>
                                            <div className="text-xs text-gray-500">x {item.quantity} Adet</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default ProfileOrders;
