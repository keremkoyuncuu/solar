import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Home, Phone, Mail } from 'lucide-react';

const PaymentSuccess: React.FC = () => {
    const { orderNo } = useParams<{ orderNo: string }>();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
                {/* Success Header with gradient */}
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-center">
                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <CheckCircle className="w-16 h-16 text-green-600" strokeWidth={2.5} />
                    </div>
                    <h1 className="text-4xl font-black text-white mb-2 uppercase tracking-tight">
                        Sipariş Alındı!
                    </h1>
                    <p className="text-green-50 text-lg font-medium">
                        Siparişiniz başarıyla oluşturuldu
                    </p>
                </div>

                {/* Content */}
                <div className="p-8">
                    {/* Order Number Card */}
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-8 mb-8 border-2 border-gray-200 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500 opacity-5 rounded-full -mt-16 -mr-16"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500 opacity-5 rounded-full -mb-12 -ml-12"></div>

                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 text-center">
                            Sipariş Numaranız
                        </p>
                        <div className="relative">
                            <p className="text-4xl font-mono font-black text-gray-900 tracking-wider text-center select-all bg-white rounded-xl py-4 shadow-sm border border-gray-200">
                                {orderNo}
                            </p>
                        </div>
                        <p className="text-xs text-gray-500 text-center mt-3">
                            Bu numarayı kaydedin, sipariş takibi için kullanabilirsiniz
                        </p>
                    </div>

                    {/* Info Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Phone className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 mb-1">Telefon Desteği</h3>
                                    <p className="text-sm text-gray-600">
                                        Sorularınız için bizi arayın
                                    </p>
                                    <p className="text-sm font-bold text-blue-600 mt-2">
                                        0538 767 70 71
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Mail className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 mb-1">E-posta</h3>
                                    <p className="text-sm text-gray-600">
                                        Detaylı bilgi için yazın
                                    </p>
                                    <p className="text-sm font-bold text-purple-600 mt-2">
                                        info@icelsolarmarket.com
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Status Info */}
                    <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-6 mb-8">
                        <div className="flex gap-3">
                            <div className="text-3xl">📦</div>
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 mb-2">Siparişiniz Hazırlanıyor</h3>
                                <p className="text-sm text-gray-700 leading-relaxed">
                                    Siparişiniz onaylandı ve en kısa sürede kargoya verilecek.
                                    Kargo takip numaranız hazır olduğunda tarafınıza bildirilecektir.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                        <button
                            onClick={() => navigate('/')}
                            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3 group"
                        >
                            <Home className="w-6 h-6 group-hover:scale-110 transition-transform" />
                            Ana Sayfaya Dön
                        </button>

                        <button
                            onClick={() => navigate('/products')}
                            className="w-full border-2 border-gray-300 text-gray-700 py-4 rounded-xl font-semibold hover:border-gray-400 hover:bg-gray-50 transition-all"
                        >
                            Alışverişe Devam Et
                        </button>
                    </div>

                    {/* Footer Note */}
                    <p className="text-xs text-center text-gray-500 mt-8 leading-relaxed">
                        Siparişinizle ilgili herhangi bir sorunuz varsa,
                        <button onClick={() => navigate('/iletisim')} className="text-green-600 hover:underline font-medium ml-1">
                            bizimle iletişime geçebilirsiniz
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PaymentSuccess;
