import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { XCircle, Home, RefreshCw, Phone, Mail } from 'lucide-react';

const PaymentFailed: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const errorCode = searchParams.get('code') || '';
    const errorMessage = searchParams.get('msg') || 'Ödeme işlemi başarısız oldu.';
    const transactionId = searchParams.get('txid') || '';

    // Kullanıcı dostu hata mesajları
    const getErrorMessage = (code: string, msg: string): string => {
        const errorMap: Record<string, string> = {
            '05': 'Kartınız onaylanmadı. Lütfen bankanızla iletişime geçin.',
            '12': 'Geçersiz işlem. Lütfen tekrar deneyin.',
            '14': 'Geçersiz kart numarası. Bilgilerinizi kontrol edin.',
            '41': 'Kayıp kart. Bankanızla iletişime geçin.',
            '43': 'Çalıntı kart. Bankanızla iletişime geçin.',
            '51': 'Yetersiz bakiye.',
            '54': 'Kart son kullanma tarihi geçmiş.',
            '57': 'Bu işlem kartınıza tanımlı değil.',
            '58': 'Terminal bu işleme izinli değil.',
            '62': 'Kart kısıtlı.',
            '65': 'Günlük limit aşıldı.',
            '75': 'PIN denemesi aşıldı.',
            '82': '3D Secure doğrulama başarısız.',
            '91': 'Banka şu anda yanıt vermiyor. Lütfen daha sonra tekrar deneyin.',
            '96': 'Sistem hatası. Lütfen daha sonra tekrar deneyin.',
        };

        return errorMap[code] || msg || 'Ödeme işlemi sırasında bir hata oluştu.';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
                {/* Error Header */}
                <div className="bg-gradient-to-r from-red-500 to-rose-600 p-8 text-center">
                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <XCircle className="w-16 h-16 text-red-600" strokeWidth={2.5} />
                    </div>
                    <h1 className="text-4xl font-black text-white mb-2 uppercase tracking-tight">
                        Ödeme Başarısız
                    </h1>
                    <p className="text-red-100 text-lg font-medium">
                        İşlem tamamlanamadı
                    </p>
                </div>

                {/* Content */}
                <div className="p-8">
                    {/* Error Message Card */}
                    <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl p-6 mb-8 border-2 border-red-200">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <XCircle className="w-6 h-6 text-red-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 mb-2">Hata Detayı</h3>
                                <p className="text-gray-700">
                                    {getErrorMessage(errorCode, decodeURIComponent(errorMessage))}
                                </p>
                                {errorCode && (
                                    <p className="text-xs text-gray-500 mt-2">
                                        Hata Kodu: {errorCode}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* What to do */}
                    <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-6 mb-8">
                        <h3 className="font-bold text-gray-900 mb-3">Ne Yapabilirsiniz?</h3>
                        <ul className="text-sm text-gray-700 space-y-2">
                            <li className="flex items-start gap-2">
                                <span className="text-amber-600">•</span>
                                Kart bilgilerinizi kontrol edip tekrar deneyin
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-amber-600">•</span>
                                Farklı bir kart kullanmayı deneyin
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-amber-600">•</span>
                                Bankanızı arayarak kartınızın durumunu kontrol edin
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-amber-600">•</span>
                                Internet bağlantınızı kontrol edin ve tekrar deneyin
                            </li>
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Phone className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 mb-1">Telefon Desteği</h3>
                                    <p className="text-sm font-bold text-blue-600">
                                        0538 767 70 71
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Mail className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 mb-1">E-posta</h3>
                                    <p className="text-sm font-bold text-purple-600">
                                        info@icelsolarmarket.com
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-4 rounded-xl font-bold text-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3 group"
                        >
                            <RefreshCw className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
                            Tekrar Dene
                        </button>

                        <button
                            onClick={() => navigate('/')}
                            className="w-full border-2 border-gray-300 text-gray-700 py-4 rounded-xl font-semibold hover:border-gray-400 hover:bg-gray-50 transition-all flex items-center justify-center gap-3"
                        >
                            <Home className="w-5 h-5" />
                            Ana Sayfaya Dön
                        </button>
                    </div>

                    {/* Transaction Reference */}
                    {transactionId && (
                        <p className="text-xs text-center text-gray-400 mt-6">
                            İşlem Referans: {transactionId.substring(0, 8)}...
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PaymentFailed;
