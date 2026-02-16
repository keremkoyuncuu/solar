import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip
} from 'recharts';
import {
    DollarSign,
    Package,
    Users,
    AlertTriangle,
    ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        pendingOrders: 0,
        totalCustomers: 0,
        criticalStockCount: 0
    });
    const [chartData, setChartData] = useState<any[]>([]);
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [criticalStockItems, setCriticalStockItems] = useState<any[]>([]);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);

            const [
                revenueRes,
                pendingRes,
                customersRes,
                criticalStockCountRes,
                chartRes,
                recentOrdersRes,
                criticalStockItemsRes
            ] = await Promise.all([
                // 1. Toplam Ciro (Sadece ödemesi alınmış siparişler)
                supabase.from('orders').select('grand_total').in('status', ['paid', 'approved', 'shipped', 'delivered']),

                // 2. Bekleyen Siparişler (Ödemesi alınmış veya hazırlanıyor)
                supabase.from('orders').select('id', { count: 'exact' }).in('status', ['paid', 'approved']),

                // 3. Toplam Müşteri
                supabase.from('profiles').select('id', { count: 'exact' }),

                // 4. Kritik Stok Sayısı (Count from Variants)
                supabase.from('product_variants').select('id', { count: 'exact' }).lt('stock', 5),

                // 5. Grafik Verisi (Son 30 gün - Sadece ödemesi alınmışlar)
                supabase.from('orders')
                    .select('created_at, grand_total')
                    .in('status', ['paid', 'approved', 'shipped', 'delivered'])
                    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
                    .order('created_at', { ascending: true }),

                // 6. Son Siparişler (Siparişler sayfası ile aynı mantık - Tümü)
                supabase.from('orders')
                    .select('id, created_at, grand_total, status, profiles(full_name, email)')
                    .neq('status', 'pending_payment')
                    .neq('status', 'pending')
                    .order('created_at', { ascending: false })
                    .limit(5),

                // 7. Kritik Stok Ürünleri (İlk 5 - Variants)
                supabase.from('product_variants')
                    .select('id, name, stock, products(name)')
                    .lt('stock', 5)
                    .limit(5)
            ]);

            // Hesaplamalar
            // Calculate revenue from array of orders
            const totalRevenue = revenueRes.data?.reduce((sum, order) => sum + (order.grand_total || 0), 0) || 0;

            // Grafik Verisi İşleme
            const dailySales: Record<string, number> = {};
            chartRes.data?.forEach(order => {
                const date = new Date(order.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
                dailySales[date] = (dailySales[date] || 0) + (order.grand_total || 0);
            });

            const processedChartData = Object.keys(dailySales).map(date => ({
                name: date,
                satis: dailySales[date]
            }));

            setStats({
                totalRevenue,
                pendingOrders: pendingRes.count || 0,
                totalCustomers: customersRes.count || 0,
                criticalStockCount: criticalStockCountRes.count || 0
            });
            setChartData(processedChartData);
            setRecentOrders(recentOrdersRes.data || []);
            setCriticalStockItems(criticalStockItemsRes.data || []);

        } catch (error) {
            console.error("Dashboard data fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            pending_payment: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            paid: 'bg-indigo-100 text-indigo-800 border-indigo-200',
            approved: 'bg-blue-100 text-blue-800 border-blue-200',
            shipped: 'bg-purple-100 text-purple-800 border-purple-200',
            delivered: 'bg-green-100 text-green-800 border-green-200',
            cancelled: 'bg-red-100 text-red-800 border-red-200',
            returned: 'bg-gray-100 text-gray-800 border-gray-200'
        };

        const labels: Record<string, string> = {
            pending_payment: 'Ödeme Bekliyor',
            paid: 'Ödeme Alındı',
            approved: 'Hazırlanıyor',
            shipped: 'Kargolandı',
            delivered: 'Teslim Edildi',
            cancelled: 'İptal Edildi',
            returned: 'İade Edildi'
        };

        return (
            <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
                {labels[status] || status}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse p-6">
                <div className="h-8 bg-gray-200 w-1/4 rounded mb-8"></div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
                    ))}
                </div>
                <div className="h-96 bg-gray-200 rounded-xl mt-8"></div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                    <div className="h-64 bg-gray-200 rounded-xl"></div>
                    <div className="h-64 bg-gray-200 rounded-xl"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 p-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Revenue Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="p-3 bg-green-50 rounded-lg text-green-600">
                        <DollarSign className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Toplam Ciro</p>
                        <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{formatCurrency(stats.totalRevenue)}</h3>
                    </div>
                </div>

                {/* Pending Orders Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="p-3 bg-yellow-50 rounded-lg text-yellow-600">
                        <Package className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Bekleyen Sipariş</p>
                        <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{stats.pendingOrders}</h3>
                    </div>
                </div>

                {/* Customers Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                        <Users className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Toplam Müşteri</p>
                        <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{stats.totalCustomers}</h3>
                    </div>
                </div>

                {/* Critical Stock Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className={`p-3 rounded-lg ${stats.criticalStockCount > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Kritik Stok</p>
                        <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{stats.criticalStockCount}</h3>
                    </div>
                </div>
            </div>

            {/* Sales Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Son 30 Günlük Satış Grafiği</h3>
                {chartData.length > 0 ? (
                    <div className="w-full overflow-x-auto">
                        <AreaChart width={900} height={350} data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f0c961" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#f0c961" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#6B7280', fontSize: 12 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#6B7280', fontSize: 12 }}
                                tickFormatter={(value) => `${value / 1000}k`}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                itemStyle={{ color: '#111827', fontWeight: 'bold' }}
                                formatter={(value: any) => [formatCurrency(value), 'Satış']}
                                cursor={{ stroke: '#f0c961', strokeWidth: 2 }}
                            />
                            <Area
                                type="monotone"
                                dataKey="satis"
                                stroke="#f0c961"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorSales)"
                                activeDot={{ r: 8, strokeWidth: 0, fill: '#d4af37' }}
                            />
                        </AreaChart>
                    </div>
                ) : (
                    <div className="h-[350px] w-full flex items-center justify-center text-gray-400">
                        <div className="text-center">
                            <p className="text-lg font-medium">Son 30 günde satış verisi bulunmuyor.</p>
                            <p className="text-sm mt-2">Sipariş oluşturuldukça grafik güncellenecektir.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Section: Recent Orders & Stock */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Orders */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
                        <h3 className="font-bold text-gray-900">Son Siparişler</h3>
                        <Link to="/admin/orders" className="text-sm text-[#d4af37] font-medium hover:underline flex items-center gap-1 transition-colors">
                            Tümünü Gör <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-medium">
                                <tr>
                                    <th className="px-6 py-3 whitespace-nowrap">Sipariş No</th>
                                    <th className="px-6 py-3 whitespace-nowrap">Müşteri</th>
                                    <th className="px-6 py-3 text-right whitespace-nowrap">Tutar</th>
                                    <th className="px-6 py-3 text-right whitespace-nowrap">Durum</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {recentOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                            Henüz sipariş bulunmuyor.
                                        </td>
                                    </tr>
                                ) : (
                                    recentOrders.map((order) => (
                                        <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-mono text-gray-600 font-medium whitespace-nowrap box-border">
                                                {order.id ? `#${order.id.slice(0, 8)}` : '-'}
                                                {/* Fallback to order_no if available in select? No, selecting id, created_at... */}
                                                {/* Wait, select doesn't have order_no. Adding order_no to select would be better visually but id slice is fine too */}
                                            </td>
                                            <td className="px-6 py-4 text-gray-900 font-medium whitespace-nowrap">
                                                {order.profiles?.full_name || order.profiles?.email || 'Misafir'}
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-600 font-bold whitespace-nowrap">
                                                {formatCurrency(order.grand_total)}
                                            </td>
                                            <td className="px-6 py-4 text-right whitespace-nowrap">
                                                {getStatusBadge(order.status)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Critical Stock */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-gray-100 bg-white sticky top-0 z-10">
                        <h3 className="font-bold text-gray-900">Kritik Stok Uyarıları</h3>
                    </div>
                    <div className="p-0 flex-1">
                        {criticalStockItems.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center h-full">
                                <div className="bg-green-100 p-4 rounded-full text-green-600 mb-4 inline-block">
                                    <Package className="w-8 h-8" />
                                </div>
                                <p className="font-medium text-gray-900">Stok Durumu İyi</p>
                                <p className="text-xs mt-1">Kritik seviyenin (5) altında ürün yok.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500 font-medium">
                                    <tr>
                                        <th className="px-6 py-3 whitespace-nowrap">Ürün/Varyant</th>
                                        <th className="px-6 py-3 text-center whitespace-nowrap">Stok</th>
                                        <th className="px-6 py-3 text-right whitespace-nowrap">İşlem</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {criticalStockItems.map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900 line-clamp-1">{item.products?.name || 'Ürün'}</div>
                                                <div className="text-xs text-gray-500">{item.name}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-red-600 bg-red-50/50">
                                                {item.stock} <span className="text-[10px] font-normal text-red-400">Adet</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {/* Use product ID if available, or just products link */}
                                                <Link
                                                    to={`/admin/products`}
                                                    className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:text-gray-900 hover:border-gray-400 text-xs font-semibold transition-all inline-block shadow-sm"
                                                >
                                                    Stok Güncelle
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
